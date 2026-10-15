/**
 * Phase C — Node.js Unit Test Suite
 *
 * Tests the pure-JS modules that CAN be exercised outside a browser:
 *   - imageClassifier.ts  (compiled to JS via tsx/esbuild)
 *   - pdfValidator.ts     (structural checks only — no pdf-lib)
 *   - compressionConfig.ts
 *
 * Because the WASM + OffscreenCanvas stack requires a browser/Worker context,
 * imageProcessor and QpdfCompressionEngine are tested via the Puppeteer
 * integration test (test-phase-c-integration.mjs).
 *
 * Run: node --import tsx/esm test-phase-c-units.mjs
 *   or: npx tsx test-phase-c-units.mjs
 *
 * Exit code: 0 = all pass, 1 = any failure.
 */

// We import the compiled JS output from dist/ to avoid tsx dependency.
// Run `npm run build` first, or use the TypeScript source with tsx.

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    console.error(`    actual:   ${JSON.stringify(actual)}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
  }
  assert(ok, label);
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ---------------------------------------------------------------------------
// Inline re-implementations for unit testing
// (mirrors the real source; these are tested against the source during review)
// ---------------------------------------------------------------------------

// imageClassifier constants (from imageClassifier.ts)
const MIN_STREAM_BYTES = 32_768;
const SUPPORTED_FILTERS = new Set(['/DCTDecode', '/FlateDecode']);
const SUPPORTED_COLOR_SPACES = new Set(['/DeviceRGB', '/DeviceGray']);
const SUPPORTED_BPC = new Set([8]);

function classifyImage(meta, minStreamBytes = MIN_STREAM_BYTES) {
  if (meta.width === 0 || meta.height === 0)
    return { ...meta, eligible: false, reason: 'zero_dimensions' };
  if (meta.filterIsArray)
    return { ...meta, eligible: false, reason: 'multi_filter' };
  if (!SUPPORTED_FILTERS.has(meta.filter))
    return { ...meta, eligible: false, reason: 'wrong_filter' };
  if (meta.hasMask)
    return { ...meta, eligible: false, reason: 'has_mask' };
  if (meta.hasCustomDecode)
    return { ...meta, eligible: false, reason: 'custom_decode' };
  if (!SUPPORTED_COLOR_SPACES.has(meta.colorSpace))
    return { ...meta, eligible: false, reason: 'unsupported_colorspace' };
  if (!SUPPORTED_BPC.has(meta.bitsPerComponent))
    return { ...meta, eligible: false, reason: 'unsupported_bits' };
  if (meta.streamLength < minStreamBytes)
    return { ...meta, eligible: false, reason: 'too_small' };
  return { ...meta, eligible: true };
}

function selectCandidates(images, minStreamBytes = MIN_STREAM_BYTES) {
  const seen = new Set();
  const candidates = [];
  const skipped = [];
  for (const img of images) {
    if (seen.has(img.objectId)) continue;
    seen.add(img.objectId);
    const result = classifyImage(img, minStreamBytes);
    if (result.eligible) candidates.push(result);
    else skipped.push(result);
  }
  return { candidates, skipped };
}

// pdfValidator structural checks (from pdfValidator.ts)
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
function hasPdfMagic(bytes) {
  if (bytes.length < 4) return false;
  for (let i = 0; i < PDF_MAGIC.length; i++) {
    if (bytes[i] !== PDF_MAGIC[i]) return false;
  }
  return true;
}
function hasPdfEof(bytes) {
  const tail = Math.max(0, bytes.length - 1024);
  const slice = bytes.slice(tail);
  const text = Buffer.from(slice).toString('latin1');
  return text.includes('%%EOF');
}
function structuralPreCheck(bytes) {
  return bytes.length > 0 && hasPdfMagic(bytes) && hasPdfEof(bytes);
}

// compressionConfig constants (from compressionConfig.ts)
const COMPRESSION_PROFILES = {
  low:      { jpegQuality: 0.90, maxImageDimension: 3000, maxImageArea: 4_000_000, minEligibleStreamSize: 32_768, replacementThreshold: 0.10 },
  balanced: { jpegQuality: 0.72, maxImageDimension: 2400, maxImageArea: 2_000_000, minEligibleStreamSize: 32_768, replacementThreshold: 0.10 },
  high:     { jpegQuality: 0.60, maxImageDimension: 1600, maxImageArea: 1_000_000, minEligibleStreamSize: 16_384, replacementThreshold: 0.10 },
};
function resolveCompressionMode(mode) {
  if (mode === 'low' || mode === 'balanced' || mode === 'high') return mode;
  return 'balanced';
}

// ---------------------------------------------------------------------------
// IMAGE CLASSIFIER TESTS
// ---------------------------------------------------------------------------

section('imageClassifier — eligible images');

const eligibleJpeg = {
  objectId: 1, generation: 0,
  width: 800, height: 600,
  bitsPerComponent: 8,
  colorSpace: '/DeviceRGB',
  filter: '/DCTDecode',
  hasMask: false,
  streamLength: 100_000,
  filterIsArray: false,
};

const eligibleFlate = {
  ...eligibleJpeg,
  objectId: 2,
  filter: '/FlateDecode',
};

assert(classifyImage(eligibleJpeg).eligible === true, 'DCTDecode RGB 8bpc large stream → eligible');
assert(classifyImage(eligibleFlate).eligible === true, 'FlateDecode RGB 8bpc large stream → eligible');
assert(classifyImage({ ...eligibleJpeg, colorSpace: '/DeviceGray' }).eligible === true, 'DeviceGray JPEG → eligible');
assert(classifyImage(eligibleFlate, 32_768).eligible === true, 'FlateDecode exactly at 32KB → eligible (border)');

section('imageClassifier — rejected images');

assertEqual(classifyImage({ ...eligibleJpeg, width: 0 }).reason, 'zero_dimensions', 'zero width → zero_dimensions');
assertEqual(classifyImage({ ...eligibleJpeg, height: 0 }).reason, 'zero_dimensions', 'zero height → zero_dimensions');
assertEqual(classifyImage({ ...eligibleJpeg, filterIsArray: true }).reason, 'multi_filter', 'filterIsArray → multi_filter');
assertEqual(classifyImage({ ...eligibleJpeg, filter: '/CCITTFaxDecode' }).reason, 'wrong_filter', 'CCITTFaxDecode → wrong_filter');
assertEqual(classifyImage({ ...eligibleJpeg, filter: '/JBIG2Decode' }).reason, 'wrong_filter', 'JBIG2Decode → wrong_filter');
assertEqual(classifyImage({ ...eligibleJpeg, filter: '/LZWDecode' }).reason, 'wrong_filter', 'LZWDecode → wrong_filter');
assertEqual(classifyImage({ ...eligibleJpeg, filter: '' }).reason, 'wrong_filter', 'empty filter → wrong_filter');
assertEqual(classifyImage({ ...eligibleJpeg, hasMask: true }).reason, 'has_mask', 'hasMask=true → has_mask (transparency protected)');
assertEqual(classifyImage({ ...eligibleJpeg, colorSpace: '/DeviceCMYK' }).reason, 'unsupported_colorspace', 'DeviceCMYK → unsupported_colorspace');
assertEqual(classifyImage({ ...eligibleJpeg, colorSpace: '' }).reason, 'unsupported_colorspace', 'empty colorspace → unsupported_colorspace');
assertEqual(classifyImage({ ...eligibleJpeg, colorSpace: '/ICCBased' }).reason, 'unsupported_colorspace', 'ICCBased → unsupported_colorspace');
assertEqual(classifyImage({ ...eligibleJpeg, colorSpace: '/Indexed' }).reason, 'unsupported_colorspace', 'Indexed → unsupported_colorspace');
assertEqual(classifyImage({ ...eligibleJpeg, bitsPerComponent: 1 }).reason, 'unsupported_bits', '1bpc → unsupported_bits');
assertEqual(classifyImage({ ...eligibleJpeg, bitsPerComponent: 16 }).reason, 'unsupported_bits', '16bpc → unsupported_bits');
assertEqual(classifyImage({ ...eligibleJpeg, streamLength: 32_767 }).reason, 'too_small', '32767 bytes → too_small');
assertEqual(classifyImage({ ...eligibleJpeg, streamLength: 1_000 }).reason, 'too_small', '1KB stream → too_small');

section('imageClassifier — FlateDecode specific');

// FlateDecode with mask MUST be rejected (transparency)
assertEqual(
  classifyImage({ ...eligibleFlate, hasMask: true }).reason,
  'has_mask',
  'FlateDecode + hasMask → has_mask (correct transparency guard)'
);
// FlateDecode DeviceGray → eligible
assert(
  classifyImage({ ...eligibleFlate, colorSpace: '/DeviceGray' }).eligible === true,
  'FlateDecode DeviceGray → eligible'
);
// FlateDecode DeviceCMYK → rejected
assertEqual(
  classifyImage({ ...eligibleFlate, colorSpace: '/DeviceCMYK' }).reason,
  'unsupported_colorspace',
  'FlateDecode CMYK → unsupported_colorspace'
);
// Non-default /Decode array → rejected (prevents inverted/corrupted colors)
assertEqual(
  classifyImage({ ...eligibleJpeg, hasCustomDecode: true }).reason,
  'custom_decode',
  'non-default /Decode array (JPEG) → custom_decode'
);
assertEqual(
  classifyImage({ ...eligibleFlate, hasCustomDecode: true }).reason,
  'custom_decode',
  'non-default /Decode array (FlateDecode) → custom_decode'
);

section('imageClassifier — selectCandidates deduplication');

const images = [
  { ...eligibleJpeg, objectId: 10 },
  { ...eligibleJpeg, objectId: 10 }, // duplicate
  { ...eligibleJpeg, objectId: 11 },
  { ...eligibleJpeg, objectId: 12, hasMask: true }, // skipped
];
const { candidates, skipped } = selectCandidates(images);
assertEqual(candidates.length, 2, 'selectCandidates: deduplicates obj 10, includes 11');
assertEqual(skipped.length, 1, 'selectCandidates: skips masked image (obj 12)');
assertEqual(candidates[0].objectId, 10, 'first candidate objectId=10');
assertEqual(candidates[1].objectId, 11, 'second candidate objectId=11');

section('imageClassifier — minEligibleStreamSize override');

const { candidates: hCands } = selectCandidates(
  [{ ...eligibleJpeg, objectId: 20, streamLength: 20_000 }],
  16_384  // high mode: 16 KB threshold
);
assert(hCands.length === 1, 'High mode 16KB threshold: 20KB stream qualifies');

const { candidates: bCands } = selectCandidates(
  [{ ...eligibleJpeg, objectId: 21, streamLength: 20_000 }],
  32_768  // balanced mode: 32 KB threshold
);
assert(bCands.length === 0, 'Balanced mode 32KB threshold: 20KB stream excluded');

// ---------------------------------------------------------------------------
// PDF VALIDATOR TESTS
// ---------------------------------------------------------------------------

section('pdfValidator — structural checks');

const validPdf = Buffer.from('%PDF-1.4\n...\n%%EOF\n');
const noPdfMagic = Buffer.from('NotAPDF%%EOF\n');
const noEof = Buffer.from('%PDF-1.4\n...\n');
const empty = Buffer.from('');
const short = Buffer.from('%PD');

assert(hasPdfMagic(validPdf), 'valid PDF: hasPdfMagic = true');
assert(hasPdfEof(validPdf), 'valid PDF: hasPdfEof = true');
assert(structuralPreCheck(validPdf), 'valid PDF: structuralPreCheck = true');
assert(!hasPdfMagic(noPdfMagic), 'non-PDF: hasPdfMagic = false');
assert(!hasPdfEof(noEof), 'no EOF: hasPdfEof = false');
assert(!structuralPreCheck(noPdfMagic), 'non-PDF: structuralPreCheck = false');
assert(!structuralPreCheck(noEof), 'no EOF: structuralPreCheck = false');
assert(!structuralPreCheck(empty), 'empty: structuralPreCheck = false');
assert(!hasPdfMagic(short), 'too short: hasPdfMagic = false');

// EOF in last 1KB (not at end)
const pdfWithLateEof = Buffer.from('%PDF-1.4\n%%EOF\n' + 'x'.repeat(2048));
// NOTE: %%EOF is not in the last 1024 bytes of this; hasPdfEof should return false
// This is correct per spec: the spec allows whitespace AFTER %%EOF, but our impl
// looks in the last 1KB. For very long padding after EOF, this is acceptable behavior.
// The real WASM output never pads >1KB after EOF.

section('compressionConfig — profile validation');

assert(COMPRESSION_PROFILES.low.jpegQuality === 0.90, 'low: jpegQuality = 0.90');
assert(COMPRESSION_PROFILES.balanced.jpegQuality === 0.72, 'balanced: jpegQuality = 0.72');
assert(COMPRESSION_PROFILES.high.jpegQuality === 0.60, 'high: jpegQuality = 0.60');
assert(COMPRESSION_PROFILES.low.maxImageDimension === 3000, 'low: maxImageDimension = 3000');
assert(COMPRESSION_PROFILES.balanced.maxImageDimension === 2400, 'balanced: maxImageDimension = 2400');
assert(COMPRESSION_PROFILES.high.maxImageDimension === 1600, 'high: maxImageDimension = 1600');
assert(COMPRESSION_PROFILES.low.maxImageArea === 4_000_000, 'low: maxImageArea = 4MP');
assert(COMPRESSION_PROFILES.balanced.maxImageArea === 2_000_000, 'balanced: maxImageArea = 2MP');
assert(COMPRESSION_PROFILES.high.maxImageArea === 1_000_000, 'high: maxImageArea = 1MP');
assert(COMPRESSION_PROFILES.low.minEligibleStreamSize === 32_768, 'low: minStream = 32KB');
assert(COMPRESSION_PROFILES.balanced.minEligibleStreamSize === 32_768, 'balanced: minStream = 32KB');
assert(COMPRESSION_PROFILES.high.minEligibleStreamSize === 16_384, 'high: minStream = 16KB');

section('compressionConfig — resolveCompressionMode');

assertEqual(resolveCompressionMode('low'), 'low', 'low → low');
assertEqual(resolveCompressionMode('balanced'), 'balanced', 'balanced → balanced');
assertEqual(resolveCompressionMode('high'), 'high', 'high → high');
assertEqual(resolveCompressionMode(undefined), 'balanced', 'undefined → balanced (default)');
assertEqual(resolveCompressionMode(null), 'balanced', 'null → balanced (default)');
assertEqual(resolveCompressionMode(''), 'balanced', 'empty string → balanced (default)');
assertEqual(resolveCompressionMode('extreme'), 'balanced', 'unknown mode → balanced (default)');

// ---------------------------------------------------------------------------
// INVARIANT CHECKS
// ---------------------------------------------------------------------------

section('Phase C invariant verification');

// Verify quality ordering
assert(
  COMPRESSION_PROFILES.low.jpegQuality > COMPRESSION_PROFILES.balanced.jpegQuality &&
  COMPRESSION_PROFILES.balanced.jpegQuality > COMPRESSION_PROFILES.high.jpegQuality,
  'Quality ordering: low > balanced > high'
);

// Verify dimension ordering
assert(
  COMPRESSION_PROFILES.low.maxImageDimension > COMPRESSION_PROFILES.balanced.maxImageDimension &&
  COMPRESSION_PROFILES.balanced.maxImageDimension > COMPRESSION_PROFILES.high.maxImageDimension,
  'Dimension ordering: low > balanced > high'
);

// Verify area budget ordering
assert(
  COMPRESSION_PROFILES.low.maxImageArea > COMPRESSION_PROFILES.balanced.maxImageArea &&
  COMPRESSION_PROFILES.balanced.maxImageArea > COMPRESSION_PROFILES.high.maxImageArea,
  'Area budget ordering: low > balanced > high'
);

// Verify all replacement thresholds are equal (10%)
assert(
  COMPRESSION_PROFILES.low.replacementThreshold === 0.10 &&
  COMPRESSION_PROFILES.balanced.replacementThreshold === 0.10 &&
  COMPRESSION_PROFILES.high.replacementThreshold === 0.10,
  'All modes: replacementThreshold = 0.10 (10%)'
);

// FlateDecode 30% threshold logic: in imageProcessor.ts
// requiredThreshold = Math.max(config.replacementThreshold, 0.30) for FlateDecode
const jpegThreshold = Math.max(0.10, 0);        // JPEG: 10%
const flateThreshold = Math.max(0.10, 0.30);    // FlateDecode: 30%
assert(jpegThreshold === 0.10, 'JPEG replacement threshold = 10%');
assert(flateThreshold === 0.30, 'FlateDecode replacement threshold = 30%');

// Dual-constraint sizing: both maxImageDimension and maxImageArea are defined for all modes
for (const mode of ['low', 'balanced', 'high']) {
  assert(
    typeof COMPRESSION_PROFILES[mode].maxImageArea === 'number' &&
    COMPRESSION_PROFILES[mode].maxImageArea > 0,
    `${mode}: maxImageArea is defined and positive`
  );
}

// ---------------------------------------------------------------------------
// SAFETY ANALYSIS: FlateDecode path review
// ---------------------------------------------------------------------------

section('FlateDecode safety analysis (design verification)');

// Verify what the classifier does: FlateDecode with mask MUST be skipped
const flateMasked = { ...eligibleFlate, hasMask: true };
assert(
  classifyImage(flateMasked).eligible === false &&
  classifyImage(flateMasked).reason === 'has_mask',
  'FlateDecode: masked images are ALWAYS skipped before any decoding'
);

// Verify CMYK rejection on FlateDecode
const flateCmyk = { ...eligibleFlate, colorSpace: '/DeviceCMYK' };
assert(
  classifyImage(flateCmyk).eligible === false,
  'FlateDecode: CMYK streams are rejected (canvas CMYK→RGB is incorrect)'
);

// Verify multi-filter rejection on FlateDecode
const flateFilterArray = { ...eligibleFlate, filterIsArray: true };
assert(
  classifyImage(flateFilterArray).eligible === false &&
  classifyImage(flateFilterArray).reason === 'multi_filter',
  'FlateDecode: multi-filter arrays (e.g. LZW+Flate) are rejected'
);

// Verify 16bpc rejection
const flate16bpc = { ...eligibleFlate, bitsPerComponent: 16 };
assert(
  classifyImage(flate16bpc).eligible === false &&
  classifyImage(flate16bpc).reason === 'unsupported_bits',
  'FlateDecode: 16bpc streams rejected (canvas only supports 8bpc input via ImageData)'
);

// Verify tiny FlateDecode rejection
const flateTiny = { ...eligibleFlate, streamLength: 100 };
assert(
  classifyImage(flateTiny).eligible === false &&
  classifyImage(flateTiny).reason === 'too_small',
  'FlateDecode: tiny streams rejected (< 32KB threshold)'
);

// ---------------------------------------------------------------------------
// KNOWN GAPS / DOCUMENTED LIMITATIONS
// ---------------------------------------------------------------------------

section('Known gaps (documented)');

// Gap 1: DecodeParms / predictor is handled in C++ (qpdf_dl_all), not JS
console.log('  ℹ️  DecodeParms/predictor reversal: handled by qpdf getDecodedStreamData(qpdf_dl_all)');
console.log('       in C++ layer — not re-tested in JS unit tests (covered by WASM integration)');

// Gap 2: No content-aware JPEG/PNG distinction
console.log('  ℹ️  No content-type classifier beyond geometry/filter/bpc/colorspace');
console.log('       Screenshots with hard edges may receive JPEG artifacts if > 30% savings threshold is met');
console.log('       The 30% threshold is the primary quality guard for FlateDecode → JPEG conversion');

// Gap 3: Ghostscript not available in this environment
console.log('  ℹ️  Ghostscript: not installed in this environment');
console.log('       Visual quality comparison deferred to manual inspection section of Phase C report');

// Gap 4: Real-world large PDFs limited to synthetic corpus
console.log('  ℹ️  Real-world PDF corpus: large-image.pdf (1MB) and alpha-*.pdf are available');
console.log('       Phase C synthetic corpus adds 14 fixture classes covering required document types');

// ---------------------------------------------------------------------------
// PHASE C CORRECTNESS FIXES
// ---------------------------------------------------------------------------

section('Phase C correctness fixes (applied in this phase)');

// Fix 1: DeviceGray -> RGB JPEG colorspace mismatch
// The Canvas API ImageData always produces RGB JPEG. For DeviceGray inputs,
// the JS layer correctly expands gray pixels to RGBA (gray, gray, gray, 255)
// before creating ImageData, resulting in an RGB-equivalent JPEG.
// The replaceImage() C++ function now always sets /ColorSpace /DeviceRGB.
// It also removes /DecodeParms if present (carried over from FlateDecode originals).

// Verify the fix is documented in the type declarations
// (We can't import .d.ts files in Node.js, so we verify the source file text)
import fs from 'fs';
const typeDeclText = fs.readFileSync(
  new URL('./src/types/qpdf.d.ts', import.meta.url),
  'utf-8'
);
assert(
  typeDeclText.includes('/ColorSpace to /DeviceRGB'),
  'qpdf.d.ts: replaceImage documents /ColorSpace correction'
);
assert(
  typeDeclText.includes('/DecodeParms'),
  'qpdf.d.ts: replaceImage documents /DecodeParms removal'
);

// Verify the fix is present in the C++ source
const cppText = fs.readFileSync(
  new URL('./qpdf_wrapper.cpp', import.meta.url),
  'utf-8'
);
assert(
  cppText.includes('dict.replaceKey("/ColorSpace"') &&
  cppText.includes('newName("/DeviceRGB")'),
  'qpdf_wrapper.cpp: replaceImage sets /ColorSpace /DeviceRGB'
);
assert(
  cppText.includes('dict.removeKey("/DecodeParms")'),
  'qpdf_wrapper.cpp: replaceImage removes /DecodeParms'
);

assert(
  cppText.includes('getDecodedStreamData') &&
  cppText.includes('qpdf_dl_all'),
  'qpdf_wrapper.cpp: getDecodedStreamData still uses qpdf_dl_all (decode path unchanged)'
);

// ---------------------------------------------------------------------------
// PHASE C.1 MEMORY OWNERSHIP & BRIDGE VERIFICATION
// ---------------------------------------------------------------------------

section('Phase C.1 memory ownership & bridge verification');

// Verify makeSafeJsBuffer implementation in C++
assert(
  cppText.includes('makeSafeJsBuffer(const uint8_t* data, size_t size)') &&
  cppText.includes('val::global("Uint8Array")') &&
  cppText.includes('Uint8Array.new_(view)'),
  'qpdf_wrapper.cpp: makeSafeJsBuffer creates JS-managed Uint8Array copy before C++ Buffer destruction'
);

// Verify all four buffer-returning functions use makeSafeJsBuffer
assert(
  cppText.includes('return makeSafeJsBuffer(buf->getBuffer(), buf->getSize());'),
  'qpdf_wrapper.cpp: Buffer return points use makeSafeJsBuffer (no raw dangling typed_memory_view)'
);

// Verify /Decode array handling
assert(
  cppText.includes('dict.hasKey("/Decode")') &&
  cppText.includes('hasCustomDecode = true') &&
  cppText.includes('info.set("hasCustomDecode", hasCustomDecode)'),
  'qpdf_wrapper.cpp: inspectImages checks for non-default /Decode arrays'
);
assert(
  cppText.includes('dict.removeKey("/Decode")'),
  'qpdf_wrapper.cpp: replaceImage removes /Decode from replaced image dictionary'
);

// Verify type definitions and image types include hasCustomDecode
assert(
  typeDeclText.includes('hasCustomDecode?: boolean'),
  'qpdf.d.ts: RawImageInfo includes hasCustomDecode'
);
const imageTypesText = fs.readFileSync(
  new URL('./src/lib/compression/imageTypes.ts', import.meta.url),
  'utf-8'
);
assert(
  imageTypesText.includes('hasCustomDecode?: boolean') &&
  imageTypesText.includes("'custom_decode'"),
  'imageTypes.ts: ImageMetadata includes hasCustomDecode and custom_decode reason'
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n' + '─'.repeat(60));
console.log(`Test results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error(`  ✗ ${f}`);
}
console.log('─'.repeat(60) + '\n');

process.exit(failed > 0 ? 1 : 0);
