import type { CompressionResult } from '../compression/CompressionEngine';

export type JobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'skipped'
  | 'failed'
  | 'cancelled';

export type BatchJob = {
  id: string;
  file: File;
  name: string;
  outName: string;
  size: number;
  status: JobStatus;
  result?: Extract<CompressionResult, { ok: true }>;
  errorMessage?: string;
  skipReason?: string;
};
