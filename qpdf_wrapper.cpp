#include <qpdf/QPDF.hh>
#include <qpdf/QPDFWriter.hh>
#include <qpdf/QPDFObjectHandle.hh>
#include <qpdf/Buffer.hh>
#include <emscripten/bind.h>
#include <vector>
#include <string>

using namespace emscripten;

// ---------------------------------------------------------------------------
// PDFCompressor — Phase 7A production WASM wrapper
//
// Exposed API (via Embind):
//   PDFCompressor(Uint8Array pdfData)
//     Constructor — loads PDF from memory.
//
//   val inspectImages()
//     Returns a JS array of image XObject descriptors. Each descriptor has:
//       objectId, generation, width, height, bitsPerComponent,
//       colorSpace, filter, hasMask, streamLength, filterIsArray
//
//   void replaceImage(int objId, int gen, Uint8Array jpegData, int newWidth, int newHeight)
//     Replaces the stream data of an image XObject with new JPEG bytes.
//     Updates Width/Height in the image dict when dimensions change.
//
//   val structuralOptimize()
//     Runs QPDFWriter with object-stream generation + flate recompression.
//     Returns a new Uint8Array of the optimised PDF bytes.
//     Does NOT mutate the in-memory pdf object — caller must reload if needed.
//
//   val save()
//     Saves the current in-memory PDF state (after replaceImage calls)
//     with stream-data=preserve. Use this between optimization passes.
//
//   int getPageCount()
//     Returns the document page count, for validation.
// ---------------------------------------------------------------------------

class PDFCompressor {
private:
    // The pdf_buffer must outlive the QPDF object (processMemoryFile does not copy).
    std::vector<uint8_t> pdf_buffer;
    QPDF pdf;

public:
    PDFCompressor(val pdf_data) {
        pdf_buffer = vecFromJSArray<uint8_t>(pdf_data);
        pdf.processMemoryFile(
            "input.pdf",
            reinterpret_cast<const char*>(pdf_buffer.data()),
            pdf_buffer.size(),
            "" // no password
        );
    }

    // -----------------------------------------------------------------------
    // inspectImages
    // -----------------------------------------------------------------------
    val inspectImages() {
        val result = val::array();

        for (auto& obj : pdf.getAllObjects()) {
            if (!obj.isStream()) continue;

            QPDFObjectHandle dict = obj.getDict();

            // Must be an Image XObject
            if (!dict.hasKey("/Subtype")) continue;
            if (!dict.getKey("/Subtype").isName()) continue;
            if (dict.getKey("/Subtype").getName() != "/Image") continue;

            val info = val::object();
            info.set("objectId",   obj.getObjectID());
            info.set("generation", obj.getGeneration());

            // Dimensions
            int width  = dict.hasKey("/Width")  ? (int)dict.getKey("/Width").getNumericValue()  : 0;
            int height = dict.hasKey("/Height") ? (int)dict.getKey("/Height").getNumericValue() : 0;
            info.set("width",  width);
            info.set("height", height);

            // Bits per component
            int bpc = dict.hasKey("/BitsPerComponent")
                ? (int)dict.getKey("/BitsPerComponent").getNumericValue()
                : 0;
            info.set("bitsPerComponent", bpc);

            // Color space — only surface the top-level name for simple spaces
            if (dict.hasKey("/ColorSpace")) {
                auto cs = dict.getKey("/ColorSpace");
                if (cs.isName()) {
                    info.set("colorSpace", cs.getName());
                } else {
                    // Array or indirect: surface as empty so classifier skips it
                    info.set("colorSpace", std::string(""));
                }
            } else {
                info.set("colorSpace", std::string(""));
            }

            // Filter
            bool filterIsArray = false;
            if (dict.hasKey("/Filter")) {
                auto filter = dict.getKey("/Filter");
                if (filter.isName()) {
                    info.set("filter", filter.getName());
                    filterIsArray = false;
                } else if (filter.isArray()) {
                    filterIsArray = true;
                    // Surface the first filter name for logging, but flag as array
                    if (filter.getArrayNItems() > 0 && filter.getArrayItem(0).isName()) {
                        info.set("filter", filter.getArrayItem(0).getName());
                    } else {
                        info.set("filter", std::string(""));
                    }
                } else {
                    info.set("filter", std::string(""));
                }
            } else {
                info.set("filter", std::string(""));
            }
            info.set("filterIsArray", filterIsArray);

            // Masks
            bool hasMask = dict.hasKey("/Mask") || dict.hasKey("/SMask");
            info.set("hasMask", hasMask);

            // Stream length (/Length key in the dict)
            int streamLen = 0;
            if (dict.hasKey("/Length")) {
                auto lenKey = dict.getKey("/Length");
                // getKey already resolves indirect references in modern qpdf
                if (lenKey.isInteger()) {
                    streamLen = (int)lenKey.getIntValue();
                }
            }
            // Custom /Decode array check
            bool hasCustomDecode = false;
            if (dict.hasKey("/Decode")) {
                auto decode = dict.getKey("/Decode");
                if (decode.isArray()) {
                    int n = decode.getArrayNItems();
                    if (n == 2) {
                        double d0 = decode.getArrayItem(0).getNumericValue();
                        double d1 = decode.getArrayItem(1).getNumericValue();
                        if (d0 != 0.0 || d1 != 1.0) {
                            hasCustomDecode = true;
                        }
                    } else if (n == 6) {
                        for (int i = 0; i < 6; i += 2) {
                            double d0 = decode.getArrayItem(i).getNumericValue();
                            double d1 = decode.getArrayItem(i + 1).getNumericValue();
                            if (d0 != 0.0 || d1 != 1.0) {
                                hasCustomDecode = true;
                                break;
                            }
                        }
                    } else {
                        hasCustomDecode = true;
                    }
                } else {
                    hasCustomDecode = true;
                }
            }
            info.set("hasCustomDecode", hasCustomDecode);

            result.call<void>("push", info);
        }

        return result;
    }

    // -----------------------------------------------------------------------
    // Memory ownership bridge helper:
    // typed_memory_view is only a non-owning pointer into WASM heap.
    // If the underlying C++ Buffer is destroyed upon function return,
    // the pointer becomes dangling (Use-After-Free).
    // By constructing a new Uint8Array(view) synchronously before the
    // C++ Buffer is destroyed, V8 allocates its own JS ArrayBuffer and copies
    // the bytes, guaranteeing complete JS memory ownership and safety.
    // -----------------------------------------------------------------------
    static val makeSafeJsBuffer(const uint8_t* data, size_t size) {
        val Uint8Array = val::global("Uint8Array");
        val view = val(typed_memory_view(size, data));
        return Uint8Array.new_(view);
    }

    // -----------------------------------------------------------------------
    // getStreamData — exact raw bytes of the stream (safe JS-owned Uint8Array)
    // -----------------------------------------------------------------------
    val getStreamData(int obj_id, int gen) {
        QPDFObjectHandle obj = pdf.getObjectByID(obj_id, gen);
        if (!obj.isStream()) {
            return val::null();
        }

        std::shared_ptr<Buffer> buf = obj.getRawStreamData();
        if (!buf) {
            return val::null();
        }

        return makeSafeJsBuffer(buf->getBuffer(), buf->getSize());
    }

    // -----------------------------------------------------------------------
    // getDecodedStreamData — uncompressed bytes (safe JS-owned Uint8Array)
    // -----------------------------------------------------------------------
    val getDecodedStreamData(int obj_id, int gen) {
        QPDFObjectHandle obj = pdf.getObjectByID(obj_id, gen);
        if (!obj.isStream()) {
            return val::null();
        }

        std::shared_ptr<Buffer> buf = obj.getStreamData(qpdf_dl_all);
        if (!buf) {
            return val::null();
        }

        return makeSafeJsBuffer(buf->getBuffer(), buf->getSize());
    }

    // -----------------------------------------------------------------------
    // replaceImage — replace JPEG stream, optionally update dimensions
    // -----------------------------------------------------------------------
    void replaceImage(int obj_id, int gen, val new_data, int new_width, int new_height) {
        QPDFObjectHandle obj = pdf.getObjectByID(obj_id, gen);
        if (!obj.isStream()) return;

        std::vector<uint8_t> buf = vecFromJSArray<uint8_t>(new_data);
        std::string data_str(reinterpret_cast<const char*>(buf.data()), buf.size());

        // Force /DCTDecode filter for the replacement JPEG.
        // decode_parms is null — JPEG (DCTDecode) does not use /DecodeParms.
        auto filter      = QPDFObjectHandle::newName("/DCTDecode");
        auto decode_parms = QPDFObjectHandle::newNull();
        obj.replaceStreamData(data_str, filter, decode_parms);

        // Update image dictionary after stream replacement.
        QPDFObjectHandle dict = obj.getDict();

        // Dimensions: update only if changed.
        if (new_width > 0 && new_width != (int)dict.getKey("/Width").getNumericValue()) {
            dict.replaceKey("/Width",  QPDFObjectHandle::newInteger(new_width));
        }
        if (new_height > 0 && new_height != (int)dict.getKey("/Height").getNumericValue()) {
            dict.replaceKey("/Height", QPDFObjectHandle::newInteger(new_height));
        }

        // ColorSpace: the Canvas API always encodes ImageData as RGB JPEG,
        // regardless of the original colorspace (DeviceGray images are expanded
        // to RGBA before passing to ImageData, so the output JPEG is always RGB).
        // Correct the dict to /DeviceRGB so it matches the actual JPEG data.
        dict.replaceKey("/ColorSpace", QPDFObjectHandle::newName("/DeviceRGB"));

        // Remove /DecodeParms if present (carried over from FlateDecode images).
        // JPEG (DCTDecode) does not use /DecodeParms; leaving it would be malformed.
        if (dict.hasKey("/DecodeParms")) {
            dict.removeKey("/DecodeParms");
        }

        // Remove /Decode if present (replacement JPEG assumes default [0, 1, ...]).
        if (dict.hasKey("/Decode")) {
            dict.removeKey("/Decode");
        }
    }

    // -----------------------------------------------------------------------
    // structuralOptimize — write with full compression flags, return safe bytes
    // -----------------------------------------------------------------------
    val structuralOptimize() {
        QPDFWriter writer(pdf);
        writer.setObjectStreamMode(qpdf_o_generate);   // --object-streams=generate
        writer.setStreamDataMode(qpdf_s_compress);     // --stream-data=compress
        writer.setRecompressFlate(true);               // --recompress-flate
        writer.setOutputMemory();
        writer.write();

        std::shared_ptr<Buffer> buf = writer.getBufferSharedPointer();
        return makeSafeJsBuffer(buf->getBuffer(), buf->getSize());
    }

    // -----------------------------------------------------------------------
    // save — write current state with stream-data=preserve (return safe bytes)
    // -----------------------------------------------------------------------
    val save() {
        QPDFWriter writer(pdf);
        writer.setObjectStreamMode(qpdf_o_generate);
        writer.setStreamDataMode(qpdf_s_preserve);
        writer.setOutputMemory();
        writer.write();

        std::shared_ptr<Buffer> buf = writer.getBufferSharedPointer();
        return makeSafeJsBuffer(buf->getBuffer(), buf->getSize());
    }

    // -----------------------------------------------------------------------
    // getPageCount — for output validation
    // -----------------------------------------------------------------------
    int getPageCount() {
        return (int)pdf.getAllPages().size();
    }
};

// ---------------------------------------------------------------------------
// Emscripten bindings
// ---------------------------------------------------------------------------
EMSCRIPTEN_BINDINGS(qpdf_wrapper) {
    class_<PDFCompressor>("PDFCompressor")
        .constructor<val>()
        .function("inspectImages",       &PDFCompressor::inspectImages)
        .function("getStreamData",       &PDFCompressor::getStreamData)
        .function("getDecodedStreamData",&PDFCompressor::getDecodedStreamData)
        .function("replaceImage",        &PDFCompressor::replaceImage)
        .function("structuralOptimize",  &PDFCompressor::structuralOptimize)
        .function("save",                &PDFCompressor::save)
        .function("getPageCount",        &PDFCompressor::getPageCount);
}
