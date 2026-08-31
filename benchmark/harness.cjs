/**
 * Phase 4 Benchmark Harness (CJS, Node-compatible)
 *
 * Strategies:
 *   qpdf-structural   — --recompress-flate --object-streams=generate --compress-streams=y
 *   qpdf-l9           — above + --compression-level=9
 *   qpdf-all          — above + --optimize-images
 *   pdflib-rt         — pdf-lib load + save(useObjectStreams)
 */
'use strict';

const { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } = require('fs');
const { join, basename, resolve } = require('path');
const { performance } = require('perf_hooks');

// ── Patch fetch to serve the WASM binary from the local filesystem ────────────
// @jspawn/qpdf-wasm 0.0.2 calls fetch() with an absolute path even in Node 24
// because it detects a browser-like environment. We intercept and serve the file.

const WASM_PATH = resolve('./node_modules/@jspawn/qpdf-wasm/qpdf.wasm');
const _origFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const bytes = readFileSync(WASM_PATH);
  return {
    ok: true,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    [Symbol.toStringTag]: 'Response',
  };
};

// ── Paths ─────────────────────────────────────────────────────────────────────

const CORPUS_DIR = resolve('./benchmark/corpus');
const OUTPUT_DIR = resolve('./benchmark/results');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── qpdf singleton ────────────────────────────────────────────────────────────

let _qpdf = null;
let _qpdfInitMs = 0;

async function getQpdf() {
  if (_qpdf) return _qpdf;
  const initQpdf = require('@jspawn/qpdf-wasm/qpdf.js');
  const t0 = performance.now();
  _qpdf = await initQpdf();
  _qpdfInitMs = Math.round(performance.now() - t0);
  return _qpdf;
}

async function runQpdf(inputBytes, args) {
  const qpdf = await getQpdf();
  const FS = qpdf.FS;
  FS.writeFile('/input.pdf', inputBytes);
  try {
    qpdf.callMain([...args, '/input.pdf', '/output.pdf']);
  } catch (e) {
    const s = String(e);
    if (!s.includes('exit') && !s.includes('Exit') && !s.includes('ExitStatus')) throw e;
  }
  const output = FS.readFile('/output.pdf');
  try { FS.unlink('/input.pdf'); } catch {}
  try { FS.unlink('/output.pdf'); } catch {}
  return output;
}

// ── pdf-lib round-trip ────────────────────────────────────────────────────────

async function pdfLibRoundTrip(inputBytes) {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(inputBytes);
  return await doc.save({ useObjectStreams: true });
}

// ── Strategies ────────────────────────────────────────────────────────────────

const strategies = [
  {
    id: 'qpdf-structural',
    name: 'qpdf: structural',
    run: (b) => runQpdf(b, ['--recompress-flate', '--object-streams=generate', '--compress-streams=y']),
  },
  {
    id: 'qpdf-l9',
    name: 'qpdf: structural+l9',
    run: (b) => runQpdf(b, ['--recompress-flate', '--object-streams=generate', '--compress-streams=y', '--compression-level=9']),
  },
  {
    id: 'qpdf-all',
    name: 'qpdf: all+opt-images',
    run: (b) => runQpdf(b, ['--recompress-flate', '--object-streams=generate', '--compress-streams=y', '--compression-level=9', '--optimize-images']),
  },
  {
    id: 'pdflib-rt',
    name: 'pdf-lib: round-trip',
    run: pdfLibRoundTrip,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

async function runOne(filePath, strategy) {
  const inputBytes = readFileSync(filePath);
  const inputSize = inputBytes.length;
  const t0 = performance.now();
  let outputBytes, error;
  try {
    outputBytes = await strategy.run(inputBytes);
  } catch (e) {
    error = (e && e.message) ? e.message.slice(0, 120) : String(e).slice(0, 120);
  }
  const elapsed = Math.round(performance.now() - t0);
  if (error) return { ok: false, error, inputSize, elapsed };

  const outputSize = outputBytes.length;
  const saved = inputSize - outputSize;
  const reduction = (saved / inputSize) * 100;

  const outName = basename(filePath, '.pdf') + '_' + strategy.id + '.pdf';
  writeFileSync(join(OUTPUT_DIR, outName), outputBytes);

  return { ok: true, inputSize, outputSize, saved, reduction, elapsed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  process.stdout.write('Initialising qpdf-wasm... ');
  await getQpdf();
  console.log('done (' + _qpdfInitMs + 'ms cold start)\n');

  const files = readdirSync(CORPUS_DIR)
    .filter(f => f.endsWith('.pdf'))
    .sort()
    .map(f => join(CORPUS_DIR, f));

  const allRows = [];

  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('  Phase 4 — Benchmark Results');
  console.log('══════════════════════════════════════════════════════════════════════');

  for (const file of files) {
    const name = basename(file);
    const inputSize = statSync(file).size;
    console.log('\n  ── ' + name + '  (' + fmt(inputSize) + ')');

    for (const s of strategies) {
      process.stdout.write('     ' + s.name.padEnd(26));
      const r = await runOne(file, s);

      if (!r.ok) {
        console.log('FAILED: ' + r.error);
        allRows.push({ file: name, strategy: s.id, ok: false, error: r.error, inputSize: r.inputSize });
      } else {
        const reductionFmt = (r.reduction >= 0)
          ? r.reduction.toFixed(1) + '% smaller  '
          : Math.abs(r.reduction).toFixed(1) + '% LARGER   ';
        const sizeFmt = fmt(r.inputSize) + ' → ' + fmt(r.outputSize);
        console.log(reductionFmt + '(' + sizeFmt + ')   ' + r.elapsed + 'ms');
        allRows.push({ file: name, strategy: s.id, strategyName: s.name, ok: true, ...r });
      }
    }
  }

  // Summary
  const ok = allRows.filter(r => r.ok);
  console.log('\n\n══════════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY TABLE');
  console.log('══════════════════════════════════════════════════════════════════════');
  const pad = (s, n, r = false) => r ? String(s).padStart(n) : String(s).padEnd(n);
  const hdr = pad('Strategy', 26) + pad('File', 26) + pad('Input', 10, true) + pad('Output', 10, true) + pad('Δ%', 8, true) + pad('ms', 7, true);
  console.log(hdr);
  console.log('─'.repeat(hdr.length));
  for (const r of allRows) {
    if (!r.ok) {
      console.log(pad(r.strategy, 26) + pad(r.file, 26) + 'FAILED'.padStart(10));
    } else {
      console.log(
        pad(r.strategy, 26) + pad(r.file, 26) +
        pad(fmt(r.inputSize), 10, true) + pad(fmt(r.outputSize), 10, true) +
        pad(r.reduction.toFixed(1) + '%', 8, true) + pad(r.elapsed + 'ms', 7, true)
      );
    }
  }

  console.log('\nqpdf-wasm cold start: ' + _qpdfInitMs + 'ms');
  writeFileSync(join(OUTPUT_DIR, 'results.json'), JSON.stringify(allRows, null, 2));
  console.log('Wrote benchmark/results/results.json');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
