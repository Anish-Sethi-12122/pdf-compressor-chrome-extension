import fs from 'fs';
import createQpdfModule from './qpdf_wrapper.js';

async function run() {
    const Module = await createQpdfModule();
    const pdfData = fs.readFileSync('test_fixture.pdf');
    const compressor = new Module.PDFCompressor(new Uint8Array(pdfData));
    const images = compressor.inspectImages();
    console.log(images);
}
run().catch(console.error);
