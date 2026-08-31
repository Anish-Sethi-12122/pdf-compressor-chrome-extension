/**
 * Phase 4 Benchmark Harness
 * ============================================================
 * Tests compression strategies against the synthetic corpus.
 *
 * Strategies benchmarked:
 *   A — qpdf-wasm: structural (--recompress-flate --object-streams=generate)
 *   B — qpdf-wasm: structural + compression-level=9
 *   C — qpdf-wasm: all flags (+ --optimize-images)
 *   D — pdf-lib: round-trip re-save with useObjectStreams
 *
 * Strategies NOT benchmarked here (licensing or runtime constraints):
 *   Ghostscript WASM — AGPL license; benchmarked manually via external CLI
 *   MuPDF WASM      — AGPL license; excluded from automated benchmark
 *   Full raster     — Requires browser Canvas API; documented separately
 *
 * Usage:
 *   node benchmark/harness.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, basename, resolve } from 'path';
import { performance } from 'perf_hooks';
import { PDFDocument } from 'pdf-lib';

// ── Node fetch polyfill for qpdf-wasm WASM loading ──────────────────────────

const QPDF_WASM_PATH = resolve('node_modules/@jspawn/qpdf-wasm/qpdf.wasm');

if (!globalThis.fetch) {
  globalThis.fetch = async (_url) => {
    const data = readFileSync(QPDF_WASM_PATH);
    return {
      ok: true,
      arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    };
  };
}

// ── Paths ────────────────────────────────────────────────────────────────────

const CORPUS_DIR = 'benchmark/corpus';
const OUTPUT_DIR = 'benchmark/results';
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── qpdf-wasm loader (singleton) ─────────────────────────────────────────────

let _qpdf = null;
let _qpdfInitMs = 0;

async function getQpdf() {
  if (_qpdf) return _qpdf;
  const { default: initQpdf } = await import('@jspawn/qpdf-wasm');
  const t0 = performance.now();
  _qpdf = await initQpdf();
  _qpdfInitMs = Math.round(performance.now() - t0);
  return _qpdf;
}

// ── qpdf CLI runner ───────────────────────────────────────────────────────────

async function runQpdf(inputBytes, args) {
  const qpdf = await getQpdf();
  const FS = qpdf.FS;
  FS.writeFile('/input.pdf', inputBytes);
  try {
    qpdf.callMain([...args, '/input.pdf', '/output.pdf']);
  } catch (e) {
    if (!String(e).includes('exit') && !String(e).includes('Exit')) throw e;
  }
  const output = FS.readFile('/output.pdf');
  try { FS.unlink('/input.pdf'); } catch {}
  try { FS.unlink('/output.pdf'); } catch {}
  return output;
}

// ── pdf-lib round-trip ────────────────────────────────────────────────────────

async function pdfLibRoundTrip(inputBytes) {
  const doc = await PDFDocument.load(inputBytes);
  return await doc.save({ useObjectStreams: true });
}

// ── Strategies ────────────────────────────────────────────────────────────────

const strategies = [
  {
    id: 'qpdf-structural',
    name: 'qpdf: structural',
    flags: '--recompress-flate --object-streams=generate --compress-streams=y',
    run: (b) => runQpdf(b, ['--recompress-flate', '--object-streams=generate', '--compress-streams=y']),
  },
  {
    id: 'qpdf-l9',
    name: 'qpdf: structural + level-9',
    flags: '+ --compression-level=9',
    run: (b) => runQpdf(b, ['--recompress-flate', '--object-streams=generate', '--compress-streams=y', '--compression-level=9']),
  },
  {
    id: 'qpdf-all',
    name: 'qpdf: all + optimize-images',
    flags: '+ --optimize-images',
    run: (b) => runQpdf(b, ['--recompress-flate', '--object-streams=generate', '--compress-streams=y', '--compression-level=9', '--optimize-images']),
  },
  {
    id: 'pdflib-rt',
    name: 'pdf-lib: round-trip',
    flags: 'load+save(useObjectStreams)',
    run: pdfLibRoundTrip,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// ── Benchmark runner ──────────────────────────────────────────────────────────

async function runBenchmark(filePath, strategy) {
  const inputBytes = readFileSync(filePath);
  const inputSize = inputBytes.length;
  const t0 = performance.now();
  let outputBytes;
  let error = null;

  try {
    outputBytes = await strategy.run(inputBytes);
  } catch (e) {
    error = e.message || String(e);
  }

  const elapsed = Math.round(performance.now() - t0);
  if (error) return { ok: false, error, inputSize, elapsed };

  const outputSize = outputBytes.length;
  const saved = inputSize - outputSize;
  const reduction = ((saved / inputSize) * 100).toFixed(1);

  const outFile = join(OUTPUT_DIR, `${basename(filePath, '.pdf')}_${strategy.id}.pdf`);
  writeFileSync(outFile, outputBytes);

  return { ok: true, inputSize, outputSize, saved, reduction: parseFloat(reduction), elapsed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Pre-init qpdf-wasm and record cost
  process.stdout.write('Loading qpdf-wasm... ');
  await getQpdf();
  console.log(`done (${_qpdfInitMs}ms init cost)`);
  console.log();

  const corpusFiles = readdirSync(CORPUS_DIR)
    .filter(f => f.endsWith('.pdf'))
    .sort()
    .map(f => join(CORPUS_DIR, f));

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  Phase 4 Benchmark Results');
  console.log('═══════════════════════════════════════════════════════════════════════');

  const rows = [];

  for (const file of corpusFiles) {
    const name = basename(file);
    const inputSize = statSync(file).size;
    console.log(`\n  ── ${name}  (${fmt(inputSize)}) ────`);

    for (const strategy of strategies) {
      process.stdout.write(`     ${strategy.name.padEnd(30)}`);
      const r = await runBenchmark(file, strategy);

      if (!r.ok) {
        console.log(`FAILED: ${r.error.slice(0, 80)}`);
        rows.push({ file: name, ...strategy, ok: false, error: r.error, inputSize: r.inputSize });
      } else {
        const direction = r.saved >= 0
          ? `${r.reduction}% saved  (${fmt(inputSize)} → ${fmt(r.outputSize)}, ‑${fmt(Math.abs(r.saved))})`
          : `${Math.abs(r.reduction)}% LARGER (${fmt(inputSize)} → ${fmt(r.outputSize)}, +${fmt(Math.abs(r.saved))})`;
        console.log(`${direction}   ${r.elapsed}ms`);
        rows.push({ file: name, strategy: strategy.id, name: strategy.name, ok: true, ...r });
      }
    }
  }

  // ── Summary table ──────────────────────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY TABLE');
  console.log('═══════════════════════════════════════════════════════════════════════');
  const col = (s, n) => String(s).padStart(n);
  const colL = (s, n) => String(s).padEnd(n);
  const hdr = colL('Strategy', 28) + colL('File', 28) + col('Input', 10) + col('Output', 10) + col('Δ%', 8) + col('ms', 7);
  console.log(hdr);
  console.log('─'.repeat(hdr.length));
  for (const r of rows) {
    if (!r.ok) {
      console.log(colL(r.strategy || r.id, 28) + colL(r.file, 28) + 'FAILED'.padStart(10));
    } else {
      console.log(
        colL(r.strategy, 28) + colL(r.file, 28) +
        col(fmt(r.inputSize), 10) + col(fmt(r.outputSize), 10) +
        col(r.reduction + '%', 8) + col(r.elapsed + 'ms', 7)
      );
    }
  }

  writeFileSync(join(OUTPUT_DIR, 'results.json'), JSON.stringify(rows, null, 2));
  console.log(`\nqpdf-wasm init cost: ${_qpdfInitMs}ms (one-time per worker/session)`);
  console.log('Full results: benchmark/results/results.json');
  console.log('Compressed files: benchmark/results/*.pdf');
}

main().catch(e => { console.error(e); process.exit(1); });
