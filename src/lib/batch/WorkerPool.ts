import { CompressionClient } from '../compression/CompressionClient';

export class WorkerPool {
  private clients: CompressionClient[] = [];
  private idle: CompressionClient[] = [];
  private waiting: Array<(client: CompressionClient) => void> = [];
  private maxWorkers: number;
  private destroyed = false;

  constructor() {
    // @ts-ignore
    const hw = window.__BENCHMARK_CONCURRENCY || navigator.hardwareConcurrency || 4;
    this.maxWorkers = Math.min(Math.max(1, Math.floor(hw / 2)), 4);
    // @ts-ignore
    if (window.__FORCE_CONCURRENCY) this.maxWorkers = window.__FORCE_CONCURRENCY;
  }

  public get capacity(): number {
    return this.maxWorkers;
  }

  public async acquire(): Promise<CompressionClient> {
    if (this.destroyed) {
      throw new Error('WorkerPool destroyed');
    }

    if (this.idle.length > 0) {
      return this.idle.shift()!;
    }

    if (this.clients.length < this.maxWorkers) {
      const client = new CompressionClient();
      this.clients.push(client);
      return client;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  public release(client: CompressionClient, failed: boolean = false) {
    if (this.destroyed) return;

    if (failed) {
      client.terminate();
      this.clients = this.clients.filter((c) => c !== client);
    } else {
      this.idle.push(client);
    }

    if (this.waiting.length > 0 && !failed) {
      const resolve = this.waiting.shift()!;
      this.acquire().then(resolve);
    } else if (this.waiting.length > 0 && this.clients.length < this.maxWorkers) {
      const resolve = this.waiting.shift()!;
      this.acquire().then(resolve);
    }
  }

  public destroy() {
    this.destroyed = true;
    for (const c of this.clients) {
      c.terminate();
    }
    this.clients = [];
    this.idle = [];
    // waiting promises will hang if rejected, which is fine since batch is cancelled
    // and components will unmount. 
    this.waiting = [];
  }
}
