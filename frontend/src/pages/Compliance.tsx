import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { ComplianceRequest } from '../types';

const Compliance: React.FC = () => {
  const [requests, setRequests] = useState<ComplianceRequest[]>([]);
  const [exportPayload, setExportPayload] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ComplianceRequest[] }>(API_ENDPOINTS.compliance.requests);
      setRequests(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Compliance — RecoverAI';
    void load();
  }, []);

  const exportData = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ data: Record<string, unknown>; requestId: string }>(API_ENDPOINTS.compliance.export);
      setExportPayload(JSON.stringify(res.data, null, 2));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const requestDelete = async () => {
    const ok = window.confirm('This will permanently delete company data. Continue?');
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(API_ENDPOINTS.compliance.delete, { confirm: true });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compliance Center</h1>

      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Data Rights</h2>
        <div className="flex gap-3">
          <Button loading={busy} onClick={exportData}>Export Company Data</Button>
          <Button variant="danger" loading={busy} onClick={requestDelete}>Delete Company Data</Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Deletion is irreversible. Use only when legally required and approved.</p>
      </Card>

      {exportPayload && (
        <Card>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Latest Export Preview</h2>
          <pre className="text-xs bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 p-3 rounded overflow-auto max-h-96">{exportPayload}</pre>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Compliance Requests</h2>
        {loading ? <p className="text-sm text-gray-500">Loading requests...</p> : (
          <div className="space-y-2">
            {requests.length === 0 && <p className="text-sm text-gray-500">No requests found.</p>}
            {requests.map((r) => (
              <div key={r.id} className="text-sm p-2 rounded bg-gray-50 dark:bg-gray-800">
                {r.request_type} - {r.status} - {new Date(r.requested_at).toLocaleString()}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Compliance;


