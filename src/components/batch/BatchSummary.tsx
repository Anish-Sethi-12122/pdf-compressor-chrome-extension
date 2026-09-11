import type { BatchJob } from '../../lib/batch/BatchJob';

type Props = {
  jobs: BatchJob[];
  onCancel: () => void;
  onDownloadAll: () => void;
};

export function BatchSummary({ jobs, onCancel, onDownloadAll }: Props) {
  const total = jobs.length;
  const completed = jobs.filter(j => j.status === 'completed').length;
  const skipped = jobs.filter(j => j.status === 'skipped').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  const cancelled = jobs.filter(j => j.status === 'cancelled').length;
  
  const finishedCount = completed + skipped + failed + cancelled;
  const isDone = total > 0 && finishedCount === total;
  
  const changedOutputsCount = jobs.filter(j => j.status === 'completed' && j.result?.changed && !!j.result.output).length;

  return (
    <div className="batch-summary">
      <div className="batch-summary-text" aria-live="polite">
        {finishedCount} / {total} completed
        {skipped > 0 && ` · ${skipped} skipped`}
        {failed > 0 && ` · ${failed} failed`}
      </div>
      <div className="batch-summary-actions">
        {!isDone && (
          <button className="secondary-button" onClick={onCancel} aria-label="Cancel batch processing">
            Cancel
          </button>
        )}
        {isDone && changedOutputsCount > 0 && (
          <button className="primary-button batch-download-all" onClick={onDownloadAll} autoFocus aria-label={`Download all ${changedOutputsCount} compressed PDFs`}>
            Download All ({changedOutputsCount})
          </button>
        )}
      </div>
    </div>
  );
}
