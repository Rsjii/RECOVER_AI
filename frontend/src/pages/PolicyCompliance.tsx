import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { AgentPolicy, ComplianceRequest } from '../types';

const defaultPolicy: AgentPolicy = {
  autonomyLevel: 'autonomous',
  maxEmailsPerWeek: 5,
  requireApprovalForHighRisk: true,
  quietHoursStart: 20,
  quietHoursEnd: 8,
  escalationDays: 40,
};

const PolicyCompliance: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'policy' | 'compliance'>('policy');

  // Policy state
  const [policy, setPolicy] = useState<AgentPolicy>(defaultPolicy);
  const [simulation, setSimulation] = useState<Record<string, unknown> | null>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [flags, setFlags] = useState<any[]>([]);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [workingApprovalId, setWorkingApprovalId] = useState<string | null>(null);

  // Compliance state
  const [requests, setRequests] = useState<ComplianceRequest[]>([]);
  const [exportPayload, setExportPayload] = useState<string>('');
  const [loadingCompliance, setLoadingCompliance] = useState(true);
  const [busy, setBusy] = useState(false);

  // Load policy
  const loadPolicy = async () => {
    setLoadingPolicy(true);
    try {
      const [policyRes, approvalsRes, flagsRes] = await Promise.all([
        api.get<{ data: AgentPolicy }>(API_ENDPOINTS.policy.get),
        api.get<{ data: any[] }>(`${API_ENDPOINTS.policy.approvals}?status=pending`),
        api.get<{ data: any[] }>(API_ENDPOINTS.featureFlags.list),
      ]);
      setPolicy(policyRes.data || defaultPolicy);
      setApprovals(approvalsRes.data || []);
      setFlags(flagsRes.data || []);
    } finally {
      setLoadingPolicy(false);
    }
  };

  // Load compliance
  const loadCompliance = async () => {
    setLoadingCompliance(true);
    try {
      const res = await api.get<{ data: ComplianceRequest[] }>(API_ENDPOINTS.compliance.requests);
      setRequests(res.data || []);
    } finally {
      setLoadingCompliance(false);
    }
  };

  useEffect(() => {
    document.title = 'Policy & Compliance — CashOS';
    void loadPolicy();
    void loadCompliance();
  }, []);

  // Policy handlers
  const savePolicy = async () => {
    const res = await api.put<{ data: AgentPolicy }>(API_ENDPOINTS.policy.update, policy);
    setPolicy(res.data || policy);
  };

  const simulatePolicy = async () => {
    const res = await api.post<{ data: Record<string, unknown> }>(API_ENDPOINTS.policy.simulate, {
      ...policy,
      riskScore: 85,
      daysOverdue: 65,
      emailsSentThisWeek: 2,
    });
    setSimulation(res.data || null);
    await loadPolicy();
  };

  const decide = async (approvalId: string, decision: 'approved' | 'rejected') => {
    setWorkingApprovalId(approvalId);
    try {
      await api.post(API_ENDPOINTS.policy.approvalDecision(approvalId), {
        decision,
        note: decision === 'approved' ? 'Approved from policy dashboard.' : 'Rejected from policy dashboard.',
      });
      await loadPolicy();
    } finally {
      setWorkingApprovalId(null);
    }
  };

  const toggleFlag = async (key: string, enabled: boolean) => {
    await api.put(API_ENDPOINTS.featureFlags.update, { key, enabled });
    await loadPolicy();
  };

  // Compliance handlers
  const exportData = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ data: Record<string, unknown>; requestId: string }>(API_ENDPOINTS.compliance.export);
      setExportPayload(JSON.stringify(res.data, null, 2));
      await loadCompliance();
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
      await loadCompliance();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Policy & Compliance</h1>

      {/* Tab navigation */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-white/[0.06]">
        <button
          onClick={() => setActiveTab('policy')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'policy'
              ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Agent Policy
        </button>
        <button
          onClick={() => setActiveTab('compliance')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'compliance'
              ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Data & Compliance
        </button>
      </div>

      {/* Policy Tab */}
      {activeTab === 'policy' && (
        <div className="space-y-6">
          {loadingPolicy ? (
            <Card>Loading policy...</Card>
          ) : (
            <>
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Autonomy Level</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-[#111113] dark:border-white/[0.06]"
                      value={policy.autonomyLevel}
                      onChange={(e) => setPolicy({ ...policy, autonomyLevel: e.target.value as AgentPolicy['autonomyLevel'] })}
                    >
                      <option value="autonomous">autonomous</option>
                      <option value="assisted">assisted</option>
                      <option value="manual">manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Max Emails / Week</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-[#111113] dark:border-white/[0.06]"
                      value={policy.maxEmailsPerWeek}
                      onChange={(e) => setPolicy({ ...policy, maxEmailsPerWeek: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Quiet Hours Start</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-[#111113] dark:border-white/[0.06]"
                      value={policy.quietHoursStart}
                      onChange={(e) => setPolicy({ ...policy, quietHoursStart: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Quiet Hours End</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-[#111113] dark:border-white/[0.06]"
                      value={policy.quietHoursEnd}
                      onChange={(e) => setPolicy({ ...policy, quietHoursEnd: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Escalation Days</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-[#111113] dark:border-white/[0.06]"
                      value={policy.escalationDays}
                      onChange={(e) => setPolicy({ ...policy, escalationDays: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-7">
                    <input
                      id="approval"
                      type="checkbox"
                      checked={policy.requireApprovalForHighRisk}
                      onChange={(e) => setPolicy({ ...policy, requireApprovalForHighRisk: e.target.checked })}
                    />
                    <label htmlFor="approval" className="text-sm text-gray-700 dark:text-gray-300">Require approval for high-risk actions</label>
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <Button onClick={savePolicy}>Save Policy</Button>
                  <Button variant="outline" onClick={simulatePolicy}>Simulate Decision</Button>
                </div>
              </Card>

              {simulation && (
                <Card>
                  <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Simulation Output</h2>
                  <pre className="text-xs bg-gray-50 dark:bg-[#09090b] border dark:border-white/[0.06] p-3 rounded overflow-auto">{JSON.stringify(simulation, null, 2)}</pre>
                </Card>
              )}

              <Card>
                <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Approval Queue</h2>
                {approvals.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No pending approvals.</p>
                ) : (
                  <div className="space-y-2">
                    {approvals.map((item) => (
                      <div key={item.id} className="rounded border border-gray-200 dark:border-white/[0.06] p-3">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-medium">Risk:</span> {item.risk_score} | <span className="font-medium">Overdue:</span> {item.days_overdue} days
                        </div>
                        {item.reason && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.reason}</p>
                        )}
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => decide(item.id, 'approved')}
                            loading={workingApprovalId === item.id}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => decide(item.id, 'rejected')}
                            loading={workingApprovalId === item.id}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Pilot Feature Flags</h2>
                {flags.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No feature flags configured.</p>
                ) : (
                  <div className="space-y-2">
                    {flags.map((flag) => (
                      <div key={flag.key} className="flex items-center justify-between text-sm border rounded px-3 py-2 border-gray-200 dark:border-white/[0.06]">
                        <span className="text-gray-700 dark:text-gray-300">{flag.key}</span>
                        <Button
                          size="sm"
                          variant={flag.enabled ? 'secondary' : 'outline'}
                          onClick={() => toggleFlag(flag.key, !flag.enabled)}
                        >
                          {flag.enabled ? 'Enabled' : 'Disabled'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Data Rights</h2>
            <div className="flex gap-3">
              <Button loading={busy} onClick={exportData}>Export Company Data</Button>
              <Button variant="danger" loading={busy} onClick={requestDelete}>Delete Company Data</Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Deletion is irreversible. Use only when legally required and approved.</p>
          </Card>

          {exportPayload && (
            <Card>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Latest Export Preview</h2>
              <pre className="text-xs bg-gray-50 dark:bg-[#09090b] border dark:border-white/[0.06] p-3 rounded overflow-auto max-h-96">{exportPayload}</pre>
            </Card>
          )}

          <Card>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Compliance Requests</h2>
            {loadingCompliance ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading requests...</p>
            ) : (
              <div className="space-y-2">
                {requests.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No requests found.</p>}
                {requests.map((r) => (
                  <div key={r.id} className="text-sm p-2 rounded bg-gray-50 dark:bg-[#111113]">
                    {r.request_type} - {r.status} - {new Date(r.requested_at).toLocaleString()}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default PolicyCompliance;
