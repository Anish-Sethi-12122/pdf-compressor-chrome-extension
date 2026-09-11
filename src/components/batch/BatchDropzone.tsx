import { useEffect } from 'react';
import { useBatchCoordinator } from '../../lib/batch/useBatchCoordinator';
import { BatchJobRow } from './BatchJobRow';
import { BatchSummary } from './BatchSummary';
import type { CompressionMode } from '../../lib/compression/compressionConfig';
import type { BatchJob } from '../../lib/batch/BatchJob';
import { RotateCcw } from 'lucide-react';

type Props = {
  files: File[];
  mode: CompressionMode;
  onReset: () => void;
};

export function BatchDropzone({ files, mode, onReset }: Props) {
  const { jobs, startBatch, cancelBatch, clearJobOutput } = useBatchCoordinator();

  useEffect(() => {
    startBatch(files, mode);
    return () => cancelBatch();
  }, [files, mode, startBatch, cancelBatch]);

  const handleDownload = (job: BatchJob) => {
    if (!job.result?.output) return;
    const blob = new Blob([job.result.output as any], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = job.outName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    
    // Clear output buffer immediately after triggering download to free memory
    clearJobOutput(job.id);
  };

  const handleDownloadAll = () => {
    const downloadableJobs = jobs.filter(j => j.status === 'completed' && j.result?.changed && !!j.result.output);
    for (const job of downloadableJobs) {
      handleDownload(job);
    }
  };

  const handleStartOver = () => {
    cancelBatch();
    onReset();
  };

  const total = jobs.length;
  const finishedCount = jobs.filter(j => j.status !== 'queued' && j.status !== 'processing').length;
  const isDone = total > 0 && finishedCount === total;

  return (
    <div className="batch-container">
      <div className="batch-header">
        <h2 className="batch-title">Batch Processing ({files.length} PDFs)</h2>
        {isDone && (
          <button className="secondary-button" onClick={handleStartOver} autoFocus={jobs.filter(j => j.status === 'completed' && j.result?.changed && !!j.result.output).length === 0}>
            <RotateCcw size={14} /> Start over
          </button>
        )}
      </div>
      
      <div className="batch-job-list" role="list" aria-label="PDF processing queue">
        {jobs.map(job => (
          <BatchJobRow key={job.id} job={job} onDownload={handleDownload} />
        ))}
      </div>
      
      {jobs.length > 0 && (
        <BatchSummary 
          jobs={jobs} 
          onCancel={cancelBatch} 
          onDownloadAll={handleDownloadAll} 
        />
      )}
    </div>
  );
}
