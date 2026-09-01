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
            info.set("streamLength", streamLen);

            result.call<void>("push", info);
        }

        return result;
    }

    // -----------------------------------------------------------------------
    // getStreamData — exact raw bytes of the stream
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

        return val(typed_memory_view(buf->getSize(), buf->getBuffer()));
    }

    // -----------------------------------------------------------------------
    // replaceImage — replace JPEG stream, optionally update dimensions
    // -----------------------------------------------------------------------
    void replaceImage(int obj_id, int gen, val new_data, int new_width, int new_height) {
        QPDFObjectHandle obj = pdf.getObjectByID(obj_id, gen);
        if (!obj.isStream()) return;

        std::vector<uint8_t> buf = vecFromJSArray<uint8_t>(new_data);
        std::string data_str(reinterpret_cast<const char*>(buf.data()), buf.size());

        // Force /DCTDecode filter for the replacement JPEG
        auto filter      = QPDFObjectHandle::newName("/DCTDecode");
        auto decode_parms = QPDFObjectHandle::newNull();
        obj.replaceStreamData(data_str, filter, decode_parms);

        // Update dictionary if dimensions changed
        QPDFObjectHandle dict = obj.getDict();
        if (new_width > 0 && new_width != (int)dict.getKey("/Width").getNumericValue()) {
            dict.replaceKey("/Width",  QPDFObjectHandle::newInteger(new_width));
        }
        if (new_height > 0 && new_height != (int)dict.getKey("/Height").getNumericValue()) {
            dict.replaceKey("/Height", QPDFObjectHandle::newInteger(new_height));
        }
    }

    // -----------------------------------------------------------------------
    // structuralOptimize — write with full compression flags, return new bytes
    // -----------------------------------------------------------------------
    val structuralOptimize() {
        QPDFWriter writer(pdf);
        writer.setObjectStreamMode(qpdf_o_generate);   // --object-streams=generate
        writer.setStreamDataMode(qpdf_s_compress);     // --stream-data=compress
        writer.setRecompressFlate(true);               // --recompress-flate
        writer.setOutputMemory();
        writer.write();

        std::shared_ptr<Buffer> buf = writer.getBufferSharedPointer();
        return val(typed_memory_view(buf->getSize(), buf->getBuffer()));
    }

    // -----------------------------------------------------------------------
    // save — write current state with stream-data=preserve (for mid-pipeline)
    // -----------------------------------------------------------------------
    val save() {
        QPDFWriter writer(pdf);
        writer.setObjectStreamMode(qpdf_o_generate);
        writer.setStreamDataMode(qpdf_s_preserve);
        writer.setOutputMemory();
        writer.write();

        std::shared_ptr<Buffer> buf = writer.getBufferSharedPointer();
        return val(typed_memory_view(buf->getSize(), buf->getBuffer()));
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
        .function("replaceImage",        &PDFCompressor::replaceImage)
        .function("structuralOptimize",  &PDFCompressor::structuralOptimize)
        .function("save",                &PDFCompressor::save)
        .function("getPageCount",        &PDFCompressor::getPageCount);
}
