import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';

async function createRealPdf() {
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  
  // Read our test JPEGs
  const img1Bytes = fs.readFileSync('img1.jpg');
  const img2Bytes = fs.readFileSync('img2.jpg');
  const img3Bytes = fs.readFileSync('img3_shared.jpg');
  
  const img1 = await pdfDoc.embedJpg(img1Bytes);
  const img2 = await pdfDoc.embedJpg(img2Bytes);
  const img3 = await pdfDoc.embedJpg(img3Bytes);

  // Page 1
  const page1 = pdfDoc.addPage();
  page1.drawText("Page 1 Text", { x: 50, y: 700, font: timesRomanFont });
  page1.drawImage(img1, { x: 50, y: 400, width: 400, height: 250 });

  // Page 2
  const page2 = pdfDoc.addPage();
  page2.drawText("Page 2 Text", { x: 50, y: 700, font: timesRomanFont });
  page2.drawImage(img2, { x: 50, y: 400, width: 400, height: 250 });

  // Page 3 (Shared Image)
  const page3 = pdfDoc.addPage();
  page3.drawText("Page 3 - Shared Image", { x: 50, y: 700, font: timesRomanFont });
  page3.drawImage(img3, { x: 50, y: 400, width: 400, height: 250 });

  // Page 4 (Shared Image again)
  const page4 = pdfDoc.addPage();
  page4.drawText("Page 4 - Shared Image again", { x: 50, y: 700, font: timesRomanFont });
  page4.drawImage(img3, { x: 50, y: 400, width: 400, height: 250 });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('test_fixture.pdf', pdfBytes);
  console.log('Created test_fixture.pdf:', pdfBytes.length, 'bytes');
}

createRealPdf();
