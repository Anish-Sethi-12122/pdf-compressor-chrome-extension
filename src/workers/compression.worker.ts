/**
 * Compression Web Worker — Phase 7A
 *
 * Receives ArrayBuffer from the main thread, runs the full Balanced
 * compression pipeline inside the worker, and posts back the result.
 *
 * The main thread is responsible for UI only.
 * All qpdf WASM + image processing happens here.
 */

import { QpdfCompressionEngine } from '../lib/compression/QpdfCompressionEngine';
import type { CompressionOptions, CompressionResult } from '../lib/compression/CompressionEngine';

export type WorkerRequest = {
  type: 'compress';
  id: string;
  input: ArrayBuffer;
  options?: CompressionOptions;
  batchId?: string;
};

export type WorkerResponse = {
  type: 'result';
  id: string;
  result: CompressionResult;
  batchId?: string;
};

const engine = new QpdfCompressionEngine();

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;

  if (req.type === 'compress') {
    const options: CompressionOptions = req.options ?? { mode: 'balanced' };

    try {
      const inputArr = new Uint8Array(req.input);
      const result = await engine.compress(inputArr, options);

      const response: WorkerResponse = {
        type: 'result',
        id: req.id,
        batchId: req.batchId,
        result,
      };

      if (result.ok && result.changed) {
        // Transfer the output buffer back — avoid copying large ArrayBuffers
        (self as unknown as Worker).postMessage(response, [result.output.buffer]);
      } else {
        // Error result or unchanged original — no transferable needed
        (self as unknown as Worker).postMessage(response);
      }
    } catch (err: unknown) {
      const errorResult: CompressionResult = {
        ok: false,
        reason: 'compression_error',
        message: err instanceof Error ? err.message : 'Worker exception',
      };
      const response: WorkerResponse = {
        type: 'result',
        id: req.id,
        batchId: req.batchId,
        result: errorResult,
      };
      (self as unknown as Worker).postMessage(response);
    }
  }
});
