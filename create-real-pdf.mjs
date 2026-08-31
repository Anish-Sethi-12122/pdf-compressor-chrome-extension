import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';

async function createRealPdf() {
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 30;
  
  // Add some text to make it have stream data
  for (let i = 0; i < 50; i++) {
    page.drawText(`Creating a real PDF! Line ${i}`, {
      x: 50,
      y: height - 4 * fontSize - i * 15,
      size: fontSize / 2,
      font: timesRomanFont,
      color: rgb(0, 0.53, 0.71),
    });
  }
  
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('test-fixtures/real.pdf', pdfBytes);
  console.log('Created real.pdf:', pdfBytes.length, 'bytes');
}

createRealPdf();
