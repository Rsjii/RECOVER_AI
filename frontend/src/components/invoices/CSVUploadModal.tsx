import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { useNotification } from '../../hooks/useNotification';

interface CSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportStatus {
  status: 'processing' | 'done' | 'error';
  created: number;
  skipped: number;
  duplicates: number;
  total: number;
  error?: string;
}

export const CSVUploadModal: React.FC<CSVUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { addToast } = useNotification();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      if (f.type !== 'text/csv' && !f.name.endsWith('.csv')) {
        addToast({ type: 'error', message: 'Please select a CSV file' });
        return;
      }
      setFile(f);
    }
  };

  // Poll for job status
  useEffect(() => {
    if (!jobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await api.get(`/api/invoices/csv-import-status/${jobId}`);
        const status = res.data;
        setImportStatus(status);

        if (status.status === 'done') {
          clearInterval(pollInterval);
          const msg = `✅ Import complete: ${status.created} created${status.duplicates > 0 ? `, ${status.duplicates} duplicates skipped` : ''}${status.skipped > 0 ? `, ${status.skipped} invalid` : ''}`;
          addToast({ type: 'success', message: msg });
          setTimeout(() => {
            setFile(null);
            setJobId(null);
            setImportStatus(null);
            onSuccess();
            onClose();
          }, 2000);
        } else if (status.status === 'error') {
          clearInterval(pollInterval);
          addToast({
            type: 'error',
            message: `Import failed: ${status.error || 'Unknown error'}`,
          });
          setJobId(null);
          setImportStatus(null);
          setUploading(false);
        }
      } catch (err: any) {
        console.error('Failed to poll job status:', err);
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [jobId, addToast, onSuccess, onClose]);

  const handleUpload = async () => {
    if (!file) {
      addToast({ type: 'error', message: 'Please select a file' });
      return;
    }

    setUploading(true);
    try {
      const csvText = await file.text();
      const res = await api.post('/api/invoices/csv-upload', csvText, {
        headers: { 'Content-Type': 'text/plain' },
      });

      const newJobId = res.data.jobId;
      setJobId(newJobId);
      setImportStatus({ status: 'processing', created: 0, skipped: 0, duplicates: 0, total: res.data.total });
      // Keep uploading=true while polling
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Upload failed' });
      setUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Invoices from CSV" size="md">
      <div className="space-y-4">
        {jobId ? (
          // Importing state
          <div className="text-center py-6">
            <div className="inline-block">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">Importing invoices...</p>
            {importStatus && (
              <div className="mt-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p>Created: {importStatus.created}</p>
                <p>Skipped: {importStatus.skipped}</p>
                <p>Total: {importStatus.total}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Upload a CSV with columns: <code className="bg-gray-100 dark:bg-white/[0.03] px-2 py-1 rounded text-xs">customer_name, customer_email, amount, currency, due_date</code>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">💡 Tip: Columns are auto-detected. Duplicates are automatically skipped.</p>
              <div
                className="border-2 border-dashed border-gray-300 dark:border-white/[0.08] rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {file ? file.name : 'Click to select CSV file'}
                </p>
                <p className="text-xs text-gray-500 mt-1">or drag and drop</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="button" variant="primary" onClick={handleUpload} loading={uploading} disabled={!file}>
                Import
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
