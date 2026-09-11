/**
 * CompressionClient — Phase 7A
 *
 * Main-thread facade over the compression Web Worker.
 * Handles request/response multiplexing and transferable ArrayBuffer ownership.
 */

import type { CompressionOptions, CompressionResult } from './CompressionEngine';
import type { WorkerRequest, WorkerResponse } from '../../workers/compression.worker';
import CompressionWorker from '../../workers/compression.worker?worker';

type PendingRequest = {
  resolve: (res: CompressionResult) => void;
  reject: (err: unknown) => void;
  batchId?: string;
};

export class CompressionClient {
  private worker: Worker | null = null;
  private currentId = 0;
  private pendingRequests = new Map<string, PendingRequest>();

  constructor() {
    this.worker = new CompressionWorker();
    this.worker.addEventListener('message', this.handleMessage.bind(this));
    this.worker.addEventListener('error', this.handleError.bind(this));
  }

  private handleMessage(event: MessageEvent<WorkerResponse>) {
    const data = event.data;
    if (data.type === 'result') {
      const pending = this.pendingRequests.get(data.id);
      if (pending) {
        this.pendingRequests.delete(data.id);
        pending.resolve(data.result);
      }
    }
  }

  private handleError(event: ErrorEvent) {
    // Reject all pending requests on unhandled worker error
    const errorResult: CompressionResult = {
      ok: false,
      reason: 'compression_error',
      message: event.message || 'Worker error',
    };
    for (const pending of this.pendingRequests.values()) {
      pending.resolve(errorResult);
    }
    this.pendingRequests.clear();
  }

  public async compress(
    input: Uint8Array,
    options: CompressionOptions = { mode: 'balanced' },
    batchId?: string,
  ): Promise<CompressionResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = String(++this.currentId);
      this.pendingRequests.set(id, { resolve, reject, batchId });

      // Clone the buffer before transfer — the caller may still reference
      // the Uint8Array after calling compress().
      const inputCopy = input.slice(0).buffer as ArrayBuffer;

      const req: WorkerRequest = {
        type: 'compress',
        id,
        batchId,
        input: inputCopy,
        options,
      };

      // Transfer the cloned buffer (zero-copy to worker)
      this.worker.postMessage(req, [inputCopy]);
    });
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    const errorResult: CompressionResult = {
      ok: false,
      reason: 'compression_error',
      message: 'Worker terminated',
    };
    for (const pending of this.pendingRequests.values()) {
      pending.resolve(errorResult);
    }
    this.pendingRequests.clear();
  }
}
