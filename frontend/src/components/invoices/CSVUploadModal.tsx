import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { useNotification } from '../../hooks/useNotification';

interface CSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  setImportJobId: (jobId: string) => void;
}

export const CSVUploadModal: React.FC<CSVUploadModalProps> = ({ isOpen, onClose, setImportJobId }) => {
  const { addToast } = useNotification();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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

  const handleDownloadSample = () => {
    const csvContent = `company_name,email,amount,due_date,currency,issued_date,phone
TechFlow Inc,billing@techflow.com,25000.00,2026-02-15,USD,2026-01-15,+1-555-1234
GrowthCo,accounting@growthco.com,32000.00,2026-01-20,EUR,2026-01-05,+33-1-4567-8900
Acme Corp,invoices@acmecorp.com,21000.00,2026-01-15,GBP,2026-01-01,+44-20-7946-0958
Innovate LLC,finance@innovate.com,28000.00,2025-12-28,USD,2025-11-28,+1-555-5678
Momentum Labs,billing@momentum.com,33000.00,2026-01-08,USD,2025-12-08,+1-555-9012`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_invoices.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      setImportJobId(newJobId); // Pass to parent component
      setFile(null);
      onClose(); // Close modal immediately
      addToast({ type: 'info', message: `Importing ${res.data.total} invoices... You can access other tabs while this completes.` });
    } catch (err: any) {
      // Check if it's a CSV validation error
      const backendData = err.response?.data;
      if (backendData?.error === 'CSV_VALIDATION_FAILED') {
        const errors = backendData.errors || [];

        if (errors.length === 0) {
          addToast({ type: 'error', message: 'CSV validation failed', duration: 8000 });
          return;
        }

        // Group errors by field type
        const errorGroups: Record<string, number> = {};
        const errorMessages: Record<string, string> = {};

        for (const error of errors) {
          const field = error.field;
          errorGroups[field] = (errorGroups[field] || 0) + 1;
          if (!errorMessages[field]) {
            errorMessages[field] = error.message;
          }
        }

        // Build professional summary message
        const summaryLines: string[] = [];

        for (const [field, count] of Object.entries(errorGroups)) {
          if (field === 'email_conflict') {
            summaryLines.push(`• ${errorMessages[field]}`);
          } else if (field === 'email') {
            summaryLines.push(`• ${count} invalid email format${count > 1 ? 's' : ''}`);
          } else if (field === 'company_name') {
            summaryLines.push(`• ${count} row${count > 1 ? 's' : ''} missing company name`);
          } else if (field === 'amount') {
            summaryLines.push(`• ${count} invalid amount${count > 1 ? 's' : ''}`);
          } else if (field === 'due_date') {
            summaryLines.push(`• ${count} invalid date format${count > 1 ? 's' : ''}`);
          }
        }

        const finalMessage = summaryLines.join('\n');

        addToast({
          type: 'error',
          message: finalMessage,
          duration: 12000
        });
      } else {
        console.error('Upload error:', err);
        addToast({ type: 'error', message: err.message || 'Upload failed' });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Invoices from CSV" size="md">
      <div className="space-y-4">
        <div>
          <div className="mb-4 space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload a CSV with columns:
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
              Required: <code className="bg-gray-100 dark:bg-white/[0.03] px-2 py-1 rounded text-xs">company_name, email, amount, due_date</code>
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
              Optional: <code className="bg-gray-100 dark:bg-white/[0.03] px-2 py-1 rounded text-xs">currency, issued_date, phone</code>
            </p>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium transition-colors"
            >
              📥 Download sample CSV template
            </button>
          </div>
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
      </div>
    </Modal>
  );
};
