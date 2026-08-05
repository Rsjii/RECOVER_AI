import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { useNotification } from '../hooks/useNotification';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { DetailPageSkeleton } from '../components/ui/Skeleton';
import { InvoiceHeaderSticky } from '../components/invoices/InvoiceHeaderSticky';
import { InvoiceNextStep } from '../components/invoices/InvoiceNextStep';
import { InvoiceTimeline } from '../components/invoices/InvoiceTimeline';
import { InvoiceDetailsGrid } from '../components/invoices/InvoiceDetailsGrid';
import { InvoiceDunningControls } from '../components/invoices/InvoiceDunningControls';
import { AgentDecisionsSection } from '../components/invoices/AgentDecisionsSection';
import { PaymentInsightsCard } from '../components/invoices/PaymentInsightsCard';
import { RiskAssessmentCard } from '../components/invoices/RiskAssessmentCard';
import { CommunicationLog } from '../components/invoices/CommunicationLog';
import { BottomCTABar } from '../components/invoices/BottomCTABar';
import { ExpandableSection } from '../components/invoices/ExpandableSection';
import { EmailPreviewModal } from '../components/invoices/EmailPreviewModal';
import type { Invoice, InvoiceDetail as InvoiceDetailType, InvoiceStatus } from '../types';

interface EnhancedInvoiceDetail extends InvoiceDetailType {
  smsLogs?: any[];
  agentDecisions?: any[];
  customerInsights?: any;
  riskScore?: number | null;
  timelineEvents?: any[];
}

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useNotification();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [detail, setDetail] = useState<EnhancedInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [selectedEmailType, setSelectedEmailType] = useState<string>('dunning_1');
  const [showStopDunningConfirm, setShowStopDunningConfirm] = useState(false);
  const [dunningLoading, setDunningLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<any>(API_ENDPOINTS.invoices.detailFull(id))
      .then((res) => {
        const data = res.data || res;
        setInvoice(data.invoice);
        setDetail(data);
        if (data.dunningStatus?.nextEmailType) {
          setSelectedEmailType(data.dunningStatus.nextEmailType);
        }
        document.title = `Invoice — RecoverAI`;
      })
      .catch(() => {
        addToast({ type: 'error', message: 'Invoice not found' });
        navigate('/invoices');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: InvoiceStatus) => {
    if (!invoice) return;
    try {
      await api.put(API_ENDPOINTS.invoices.status(invoice.id), { status });
      addToast({ type: 'success', message: `Invoice marked as ${status}` });
      setInvoice({ ...invoice, status });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || `Failed to update invoice status` });
    }
  };

  const sendEmail = async () => {
    if (!invoice) return;
    setDunningLoading(true);
    try {
      await api.post<{ queued_for_review?: boolean }>(API_ENDPOINTS.email.sendNow, {
        invoiceId: invoice.id,
        emailType: selectedEmailType,
      });
      addToast({ type: 'success', message: 'Email queued successfully' });
      setShowEmailPreview(false);
      // Refresh to update timeline
      const res = await api.get<any>(API_ENDPOINTS.invoices.detailFull(invoice.id));
      setDetail(res.data || res);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to send email' });
    } finally {
      setDunningLoading(false);
    }
  };

  const handleApproveNextEmail = async () => {
    if (!detail?.dunningStatus?.nextEmailType || !invoice) return;
    setDunningLoading(true);
    try {
      setSelectedEmailType(detail.dunningStatus.nextEmailType as any);
      await api.post<{ queued_for_review?: boolean }>(API_ENDPOINTS.email.sendNow, {
        invoiceId: invoice.id,
        emailType: detail.dunningStatus.nextEmailType,
      });
      addToast({ type: 'success', message: 'Email approved and queued' });
      // Refresh to update pipeline
      const res = await api.get<any>(API_ENDPOINTS.invoices.detailFull(invoice.id));
      setDetail(res.data || res);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to approve email' });
    } finally {
      setDunningLoading(false);
    }
  };

  const handleSendSMSInstead = async () => {
    if (!invoice) return;
    setDunningLoading(true);
    try {
      await api.post('/api/sms/send-now', {
        invoiceId: invoice.id,
      });
      addToast({ type: 'success', message: 'SMS queued for delivery' });
      // Refresh to update timeline and pipeline
      const res = await api.get<any>(API_ENDPOINTS.invoices.detailFull(invoice.id));
      setDetail(res.data || res);
    } catch (err: any) {
      if (err?.message?.includes('opted')) {
        addToast({ type: 'warning', message: 'Customer has not opted in to SMS' });
      } else if (err?.message?.includes('phone')) {
        addToast({ type: 'warning', message: 'No valid phone number on file' });
      } else {
        addToast({ type: 'error', message: err.message || 'Failed to send SMS' });
      }
    } finally {
      setDunningLoading(false);
    }
  };


  const confirmStopDunning = async () => {
    if (!invoice) return;
    setDunningLoading(true);
    try {
      await api.delete(`/api/invoices/${invoice.id}/dunning`);
      addToast({ type: 'success', message: 'Dunning stopped permanently' });
      const res = await api.get<any>(API_ENDPOINTS.invoices.detailFull(invoice.id));
      setDetail(res.data || res);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to stop dunning' });
    } finally {
      setDunningLoading(false);
      setShowStopDunningConfirm(false);
    }
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!invoice || !detail) return null;

  const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (24 * 60 * 60 * 1000)));

  return (
    <>
      <ConfirmationModal
        isOpen={showStopDunningConfirm}
        title="Stop dunning?"
        message="Stop all future dunning emails for this invoice?"
        confirmLabel="Stop"
        isDangerous
        isLoading={dunningLoading}
        onConfirm={confirmStopDunning}
        onCancel={() => setShowStopDunningConfirm(false)}
      />

      {/* Sticky header */}
      <InvoiceHeaderSticky invoice={invoice} detail={detail} riskScore={detail.riskScore || null} />

      {/* Main content area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-40">
        {/* Warning banner */}
        {daysOverdue >= 90 && (
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-900 dark:text-red-200">🚨 CRITICAL: {daysOverdue} Days Overdue</p>
            <p className="text-xs text-red-800 dark:text-red-300 mt-1">This invoice requires immediate action.</p>
          </div>
        )}

        {/* Next Step - PROMINENT */}
        {detail.dunningStatus && (
          <InvoiceNextStep
            dunningStatus={detail.dunningStatus}
            agentDecisions={detail.agentDecisions || []}
            onApprove={handleApproveNextEmail}
            onSendSMS={handleSendSMSInstead}
            loading={dunningLoading}
          />
        )}

        {/* Recovery Journey Timeline */}
        {detail.timelineEvents && (
          <InvoiceTimeline events={detail.timelineEvents} />
        )}

        {/* Details Grid */}
        <InvoiceDetailsGrid
          invoice={invoice}
          dunningStatus={detail.dunningStatus || null}
          riskScore={detail.riskScore || null}
        />

        {/* Dunning Controls */}
        <InvoiceDunningControls
          invoice={invoice}
          onUpdate={async () => {
            const res = await api.get<any>(API_ENDPOINTS.invoices.detailFull(invoice.id));
            setInvoice(res.data.invoice);
            setDetail(res.data);
          }}
          loading={dunningLoading}
        />

        {/* Agent Decisions */}
        {detail.agentDecisions && detail.agentDecisions.length > 0 && (
          <AgentDecisionsSection decisions={detail.agentDecisions} />
        )}

        {/* Collapsible Sections */}
        <ExpandableSection title="💰 Payment History & Insights">
          <PaymentInsightsCard
            insights={detail.customerInsights || {}}
            payments={detail.payments || []}
          />
        </ExpandableSection>

        <ExpandableSection title="⚠️ Risk Assessment">
          <RiskAssessmentCard
            riskScore={detail.riskScore || null}
            daysOverdue={daysOverdue}
            reliability={detail.customerInsights?.reliability_pct || null}
          />
        </ExpandableSection>

        <ExpandableSection title="📧 Communication Log">
          <CommunicationLog
            emailLogs={detail.emailLogs || []}
            smsLogs={detail.smsLogs || []}
          />
        </ExpandableSection>
      </div>

      {/* Sticky bottom CTA bar - only shows when NOT paused/stopped */}
      <BottomCTABar
        dunningStatus={detail.dunningStatus}
        onMarkPaid={() => updateStatus('paid')}
        onMarkArranged={() => updateStatus('arranged')}
        onWriteOff={() => updateStatus('uncollectable')}
        loading={dunningLoading}
      />

      {/* Email Preview Modal */}
      {showEmailPreview && invoice && detail && (
        <EmailPreviewModal
          invoiceId={invoice.id}
          emailType={selectedEmailType}
          daysOverdue={daysOverdue}
          emailLogs={detail.emailLogs || []}
          onClose={() => setShowEmailPreview(false)}
          onApprove={sendEmail}
        />
      )}
    </>
  );
};

export default InvoiceDetail;
