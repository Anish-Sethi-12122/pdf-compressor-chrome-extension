#include <qpdf/QPDF.hh>
#include <qpdf/QPDFWriter.hh>
#include <qpdf/QPDFObjectHandle.hh>
#include <qpdf/Buffer.hh>
#include <emscripten/bind.h>

using namespace emscripten;

class PDFCompressor {
private:
    std::vector<uint8_t> pdf_buffer;
    QPDF pdf;
public:
    PDFCompressor(val pdf_data) {
        pdf_buffer = vecFromJSArray<uint8_t>(pdf_data);
        pdf.processMemoryFile("input.pdf", (char*)pdf_buffer.data(), pdf_buffer.size(), "");
    }

    val inspectImages() {
        val result = val::array();
        for (auto& obj : pdf.getAllObjects()) {
            if (obj.isStream()) {
                QPDFObjectHandle dict = obj.getDict();
                if (dict.hasKey("/Subtype") && dict.getKey("/Subtype").isName() && dict.getKey("/Subtype").getName() == "/Image") {
                    val info = val::object();
                    info.set("objectId", obj.getObjectID());
                    info.set("generation", obj.getGeneration());
                    if (dict.hasKey("/Width")) info.set("width", dict.getKey("/Width").getNumericValue());
                    if (dict.hasKey("/Height")) info.set("height", dict.getKey("/Height").getNumericValue());
                    if (dict.hasKey("/ColorSpace")) {
                        auto cs = dict.getKey("/ColorSpace");
                        if (cs.isName()) info.set("colorSpace", cs.getName());
                    }
                    if (dict.hasKey("/Filter")) {
                        auto filter = dict.getKey("/Filter");
                        if (filter.isName()) info.set("filter", filter.getName());
                        else if (filter.isArray() && filter.getArrayNItems() > 0) info.set("filter", filter.getArrayItem(0).getName());
                    }
                    info.set("hasMask", dict.hasKey("/Mask") || dict.hasKey("/SMask"));
                    
                    result.call<void>("push", info);
                }
            }
        }
        return result;
    }

    void replaceImage(int obj_id, int gen, val new_data) {
        QPDFObjectHandle obj = pdf.getObjectByID(obj_id, gen);
        if (obj.isStream()) {
            std::vector<uint8_t> buf = vecFromJSArray<uint8_t>(new_data);
            std::string data_str((char*)buf.data(), buf.size());
            
            auto filter = QPDFObjectHandle::newName("/DCTDecode");
            auto decode_parms = QPDFObjectHandle::newNull();
            obj.replaceStreamData(data_str, filter, decode_parms);
        }
    }

    val save() {
        QPDFWriter writer(pdf);
        writer.setObjectStreamMode(qpdf_o_generate);
        writer.setStreamDataMode(qpdf_s_preserve);
        
        writer.setOutputMemory();
        writer.write();
        
        std::shared_ptr<Buffer> buf = writer.getBufferSharedPointer();
        
        return val(typed_memory_view(buf->getSize(), buf->getBuffer()));
    }
};

EMSCRIPTEN_BINDINGS(my_module) {
    class_<PDFCompressor>("PDFCompressor")
        .constructor<val>()
        .function("inspectImages", &PDFCompressor::inspectImages)
        .function("replaceImage", &PDFCompressor::replaceImage)
        .function("save", &PDFCompressor::save);
}
