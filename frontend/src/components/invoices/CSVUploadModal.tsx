import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { useNotification } from '../../hooks/useNotification';

interface CSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CSVUploadModal: React.FC<CSVUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
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

  const handleUpload = async () => {
    if (!file) {
      addToast({ type: 'error', message: 'Please select a file' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/invoices/csv-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast({ type: 'success', message: `${res.data.count || 0} invoices imported successfully` });
      setFile(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Invoices from CSV" size="md">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Upload a CSV file with columns: <code className="bg-gray-100 dark:bg-white/[0.03] px-2 py-1 rounded text-xs">customer_name, customer_email, amount, currency, due_date</code>
          </p>
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
