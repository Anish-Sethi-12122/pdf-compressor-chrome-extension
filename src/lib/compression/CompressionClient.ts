import type { CompressionOptions, CompressionResult } from './CompressionEngine';
import type { WorkerRequest, WorkerResponse } from '../../workers/compression.worker';
import CompressionWorker from '../../workers/compression.worker?worker';

export class CompressionClient {
  private worker: Worker | null = null;
  private currentId = 0;
  private pendingRequests = new Map<string, { resolve: (res: CompressionResult) => void, reject: (err: any) => void }>();

  constructor() {
    this.worker = new CompressionWorker();
    this.worker.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleMessage(event: MessageEvent<WorkerResponse>) {
    const data = event.data;
    if (data.type === 'result') {
      const p = this.pendingRequests.get(data.id);
      if (p) {
        this.pendingRequests.delete(data.id);
        p.resolve(data.result);
      }
    }
  }

  public async compress(input: Uint8Array, options?: CompressionOptions): Promise<CompressionResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }
      const id = String(++this.currentId);
      this.pendingRequests.set(id, { resolve, reject });
      
      const req: WorkerRequest = {
        type: 'compress',
        id,
        input: input.buffer as ArrayBuffer,
        options,
      };
      
      // Transfer the buffer to avoid cloning
      this.worker.postMessage(req, [input.buffer as ArrayBuffer]);
    });
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const p of this.pendingRequests.values()) {
      p.reject(new Error('Worker terminated'));
    }
    this.pendingRequests.clear();
  }
}
