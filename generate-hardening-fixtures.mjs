import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'test-fixtures');

async function writePdf(name, bytes) {
  const outPath = path.join(FIXTURES_DIR, name);
  fs.writeFileSync(outPath, bytes);
  console.log(`✓ Generated ${name}`);
}

async function createFormsAndAnnotations() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  
  // Add some text
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Hardening Test: Forms, Annotations, Links', { x: 50, y: 800, font, size: 20 });
  
  // Add a form
  const form = doc.getForm();
  const textField = form.createTextField('some.text.field');
  textField.setText('Initial Value');
  textField.addToPage(page, { x: 50, y: 700, width: 200, height: 30 });
  
  // Add a checkbox
  const checkBox = form.createCheckBox('some.checkbox');
  checkBox.check();
  checkBox.addToPage(page, { x: 50, y: 650, width: 30, height: 30 });
  
  // Create a link annotation (using raw dict)
  const linkAnnot = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [50, 600, 250, 620],
    Border: [0, 0, 1],
    A: {
      Type: 'Action',
      S: 'URI',
      URI: 'https://example.com'
    }
  });
  const linkRef = doc.context.register(linkAnnot);
  if (!page.node.get(doc.context.obj('Annots'))) {
    page.node.set(doc.context.obj('Annots'), doc.context.obj([]));
  }
  page.node.get(doc.context.obj('Annots')).push(linkRef);

  // Note: Bookmarks are complex in pdf-lib, but we can simulate outline dicts
  const outlineRef = doc.context.register(doc.context.obj({
    Type: 'Outlines',
    Count: 1,
  }));
  const itemRef = doc.context.register(doc.context.obj({
    Title: 'First Bookmark',
    Parent: outlineRef,
    Dest: [page.ref, doc.context.obj('Fit')],
  }));
  doc.context.lookup(outlineRef).set(doc.context.obj('First'), itemRef);
  doc.context.lookup(outlineRef).set(doc.context.obj('Last'), itemRef);
  doc.catalog.set(doc.context.obj('Outlines'), outlineRef);

  const bytes = await doc.save();
  await writePdf('hardening-forms-links-bookmarks.pdf', bytes);
}

async function createUnsupportedImageSpaces() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  
  // Create a raw image XObject with CMYK and Mask
  const streamBytes = new Uint8Array(100); // fake data
  
  const cmykImage = doc.context.flateStream(streamBytes, {
    Type: 'XObject',
    Subtype: 'Image',
    Width: 100,
    Height: 100,
    ColorSpace: 'DeviceCMYK',
    BitsPerComponent: 8,
    Filter: 'DCTDecode',
    Length: 100000 // Fake large length to bypass 32KB threshold
  });
  const cmykRef = doc.context.register(cmykImage);
  
  const maskImage = doc.context.flateStream(streamBytes, {
    Type: 'XObject',
    Subtype: 'Image',
    Width: 100,
    Height: 100,
    ColorSpace: 'DeviceRGB',
    BitsPerComponent: 8,
    Filter: 'DCTDecode',
    Mask: [0, 255, 0, 255, 0, 255],
    Length: 100000 
  });
  const maskRef = doc.context.register(maskImage);
  
  page.node.set(doc.context.obj('Resources'), doc.context.obj({
    XObject: {
      Image1: cmykRef,
      Image2: maskRef
    }
  }));

  const bytes = await doc.save();
  await writePdf('hardening-unsupported-images.pdf', bytes);
}

async function main() {
  await createFormsAndAnnotations();
  await createUnsupportedImageSpaces();
}

main().catch(console.error);
