import { CheckCircle2, AlertCircle, Clock, Loader2, X, Download } from 'lucide-react';
import { formatFileSize } from '../../lib/pdfFile';
import type { BatchJob } from '../../lib/batch/BatchJob';

type Props = {
  job: BatchJob;
  onDownload: (job: BatchJob) => void;
};

export function BatchJobRow({ job, onDownload }: Props) {
  const { name, size, status, result, skipReason, errorMessage } = job;

  const renderStatus = () => {
    switch (status) {
      case 'queued':
        return <div className="batch-status batch-status--queued"><Clock size={16} /> Queued</div>;
      case 'processing':
        return <div className="batch-status batch-status--processing"><Loader2 size={16} className="icon-spin" /> Processing…</div>;
      case 'completed':
        if (result?.changed) {
          return (
            <div className="batch-status batch-status--compressed">
              <CheckCircle2 size={16} /> 
              Compressed {result.stats ? `(-${result.stats.savedPercent.toFixed(0)}%)` : ''}
            </div>
          );
        }
        return <div className="batch-status batch-status--unchanged"><CheckCircle2 size={16} /> Unchanged</div>;
      case 'skipped':
        return <div className="batch-status batch-status--skipped" title={skipReason}><AlertCircle size={16} /> {skipReason || 'Skipped'}</div>;
      case 'failed':
        return <div className="batch-status batch-status--failed" title={errorMessage}><AlertCircle size={16} /> Failed</div>;
      case 'cancelled':
        return <div className="batch-status batch-status--cancelled"><X size={16} /> Cancelled</div>;
    }
  };

  return (
    <div className="batch-job-row" role="listitem">
      <div className="batch-job-info">
        <div className="batch-job-name" title={name}>{name}</div>
        <div className="batch-job-size">{formatFileSize(size)}</div>
      </div>
      <div className="batch-job-actions">
        {renderStatus()}
        {status === 'completed' && result?.changed && result.output && (
          <button 
            className="batch-download-btn" 
            onClick={() => onDownload(job)}
            aria-label={`Download ${job.outName}`}
          >
            <Download size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
