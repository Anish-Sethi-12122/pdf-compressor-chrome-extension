import { QpdfCompressionEngine } from '../lib/compression/QpdfCompressionEngine';
import type { CompressionOptions, CompressionResult } from '../lib/compression/CompressionEngine';

export type WorkerRequest = {
  type: 'compress';
  id: string;
  input: ArrayBuffer;
  options?: CompressionOptions;
};

export type WorkerResponse = {
  type: 'result';
  id: string;
  result: CompressionResult;
};

const engine = new QpdfCompressionEngine();

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  
  if (req.type === 'compress') {
    try {
      const inputArr = new Uint8Array(req.input);
      const result = await engine.compress(inputArr, req.options);
      
      const response: WorkerResponse = {
        type: 'result',
        id: req.id,
        result
      };

      // If compression was successful, transfer the output buffer back
      if (result.ok && result.output.buffer !== req.input) {
        if (result.changed) {
          (self as any).postMessage(response, [result.output.buffer]);
        } else {
          (self as any).postMessage(response, [result.output.buffer]);
        }
      } else if (result.ok) {
        (self as any).postMessage(response, [result.output.buffer]);
      } else {
        (self as any).postMessage(response);
      }
    } catch (e: any) {
      const errorResult: CompressionResult = {
        ok: false,
        reason: 'compression_error',
        message: e?.message || 'Worker exception',
      };
      const response: WorkerResponse = {
        type: 'result',
        id: req.id,
        result: errorResult,
      };
      self.postMessage(response);
    }
  }
});
