import { useState, useRef, useCallback, useEffect } from 'react';
import type { BatchJob } from './BatchJob';
import { WorkerPool } from './WorkerPool';
import { inspectPdf } from '../pdfInspector';
import type { CompressionMode } from '../compression/compressionConfig';
import { analytics } from '../analytics/analytics';

function resolveDeterministicNames(files: File[]): Map<File, string> {
  const nameCounts = new Map<string, number>();
  const results = new Map<File, string>();
  for (const f of files) {
    const lastDot = f.name.lastIndexOf('.');
    const base = lastDot > 0 ? f.name.slice(0, lastDot) : f.name;
    const ext = lastDot > 0 ? f.name.slice(lastDot + 1) : 'pdf';
    
    let outName = `${base}-compressed.${ext}`;
    const count = nameCounts.get(outName) || 0;
    if (count > 0) {
      outName = `${base}-compressed (${count + 1}).${ext}`;
    }
    nameCounts.set(`${base}-compressed.${ext}`, count + 1);
    results.set(f, outName);
  }
  return results;
}

export function useBatchCoordinator() {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const batchIdRef = useRef<string | null>(null);
  const workerPoolRef = useRef<WorkerPool | null>(null);
  
  const jobsRef = useRef<BatchJob[]>([]);

  const updateJob = useCallback((id: string, update: Partial<BatchJob>) => {
    jobsRef.current = jobsRef.current.map(j => j.id === id ? { ...j, ...update } : j);
    setJobs([...jobsRef.current]);
  }, []);

  const cancelBatch = useCallback(() => {
    batchIdRef.current = null; // invalidates all active operations
    if (workerPoolRef.current) {
      workerPoolRef.current.destroy();
      workerPoolRef.current = null;
    }
    jobsRef.current = jobsRef.current.map(j => {
      if (j.status === 'queued' || j.status === 'processing') {
        return { ...j, status: 'cancelled' };
      }
      return j;
    });
    setJobs([...jobsRef.current]);
  }, []);

  useEffect(() => {
    return () => {
      if (workerPoolRef.current) {
        workerPoolRef.current.destroy();
      }
    };
  }, []);

  const startBatch = useCallback(async (files: File[], mode: CompressionMode) => {
    if (workerPoolRef.current) {
      workerPoolRef.current.destroy();
    }
    workerPoolRef.current = new WorkerPool();
    const batchId = crypto.randomUUID();
    batchIdRef.current = batchId;

    const names = resolveDeterministicNames(files);
    
    const initialJobs: BatchJob[] = files.map(file => {
      analytics.pdfSelected();
      return {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        outName: names.get(file)!,
        size: file.size,
        status: 'queued'
      };
    });

    jobsRef.current = initialJobs;
    setJobs([...jobsRef.current]);

    const processNext = async (jobId: string) => {
      if (batchIdRef.current !== batchId) return;
      
      const jobIndex = jobsRef.current.findIndex(j => j.id === jobId);
      if (jobIndex === -1) return;
      const job = jobsRef.current[jobIndex];
      
      if (job.status !== 'queued') return;
      
      const pool = workerPoolRef.current;
      if (!pool) return;
      
      let client;
      try {
        client = await pool.acquire();
      } catch (e) {
        // Pool destroyed during wait
        return;
      }
      
      if (batchIdRef.current !== batchId) {
        pool.release(client);
        return;
      }

      updateJob(job.id, { status: 'processing' });
      analytics.compressionStarted(mode);

      try {
        // 1. Inspect
        const inspectRes = await inspectPdf(job.file);
        if (batchIdRef.current !== batchId) {
           pool.release(client);
           return;
        }

        if (!inspectRes.ok) {
          updateJob(job.id, { 
            status: 'skipped', 
            skipReason: inspectRes.reason === 'encrypted' ? 'Password-protected' : 'Corrupted or invalid PDF'
          });
          pool.release(client);
          return;
        }
        analytics.inspectionCompleted();

        // 2. Compress
        const arrayBuffer = await job.file.arrayBuffer();
        if (batchIdRef.current !== batchId) {
           pool.release(client);
           return;
        }
        
        const uint8 = new Uint8Array(arrayBuffer);
        const result = await client.compress(uint8, { mode }, batchId);
        
        if (batchIdRef.current !== batchId) {
           pool.release(client);
           return;
        }

        if (result.ok) {
           updateJob(job.id, { status: 'completed', result });
           if (result.changed) {
             analytics.compressionCompleted(mode);
           } else {
             analytics.compressionSkipped(mode);
           }
        } else {
           updateJob(job.id, { status: 'failed', errorMessage: result.message || 'Compression failed' });
           analytics.compressionFailed(mode, 'worker_error');
        }
        pool.release(client);

      } catch (e: any) {
        if (batchIdRef.current !== batchId) {
           pool.release(client, true);
           return;
        }
        updateJob(job.id, { status: 'failed', errorMessage: e.message || 'Worker error' });
        analytics.compressionFailed(mode, 'unknown');
        pool.release(client, true); // Terminate worker on throw
      }
    };

    // Dispatch all jobs asynchronously
    for (const job of initialJobs) {
       processNext(job.id);
    }
  }, [updateJob]);

  const clearJobOutput = useCallback((id: string) => {
    updateJob(id, { result: undefined });
  }, [updateJob]);

  return { jobs, startBatch, cancelBatch, clearJobOutput };
}
