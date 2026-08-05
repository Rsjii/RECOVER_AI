import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { useNotification } from '../hooks/useNotification';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { DetailPageSkeleton } from '../components/ui/Skeleton';
import { CustomerHeaderSticky } from '../components/customers/CustomerHeaderSticky';
import { ARHealthGrid } from '../components/customers/ARHealthGrid';
import { RiskAssessmentCard } from '../components/customers/RiskAssessmentCard';
import { CommunicationHealthCard } from '../components/customers/CommunicationHealthCard';
import { ContactInformationCard } from '../components/customers/ContactInformationCard';
import { ActiveInvoicesTable } from '../components/customers/ActiveInvoicesTable';
import { AllInvoicesSection } from '../components/customers/AllInvoicesSection';
import { PaymentActivitySection } from '../components/customers/PaymentActivitySection';
import { AgentActivitySummary } from '../components/customers/AgentActivitySummary';

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('isDemo') === 'true';

  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<{ data: any }>(API_ENDPOINTS.customers.detail(id))
      .then((res) => {
        const data = res.data || res;
        setDetail(data);
        document.title = `${data.customer.company_name} — RecoverAI`;
      })
      .catch(() => {
        addToast({ type: 'error', message: 'Customer not found' });
        navigate('/customers');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleUpdateEmail = async (email: string) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid email format');
    }

    try {
      const res = await api.put(`/api/customers/${id}`, { email: email.trim() });
      setDetail({ ...detail, customer: res.data });
      addToast({ type: 'success', message: 'Email updated successfully' });
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update email');
    }
  };

  const handleUpdatePhone = async (phone: string) => {
    try {
      const res = await api.put(`/api/customers/${id}`, { phone: phone.trim() || null });
      setDetail({ ...detail, customer: res.data });
      addToast({ type: 'success', message: 'Phone updated successfully' });
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update phone');
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api.post(`/api/customers/bulk-delete`, { customerIds: [id] });
      addToast({ type: 'success', message: 'Customer deleted successfully' });
      navigate('/customers');
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to delete customer' });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!detail) return null;

  const customer = detail.customer;
  const arHealth = detail.arHealth;
  const paymentInsights = detail.paymentInsights;
  const riskFactors = detail.riskFactors || [];
  const riskTrend = detail.riskTrend;
  const communicationHealth = detail.communicationHealth;
  const paymentTimeline = detail.paymentTimeline || [];
  const agentActivity = detail.agentActivity;
  const activeInvoices = detail.activeInvoices || [];
  const allInvoices = detail.invoices || [];

  return (
    <>
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete customer?"
        message="This action cannot be undone. The customer and all their data will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        isLoading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <CustomerHeaderSticky
        customerName={customer.name || 'Customer'}
        companyName={customer.company_name}
        totalAR={arHealth.totalAR}
        riskScore={customer.customer_risk_score || 0}
        onDelete={handleDelete}
      />

      <div className="flex-1 overflow-y-auto">
        {/* AR Health Grid (HERO) */}
        <ARHealthGrid
          arHealth={arHealth}
          avgDaysToPay={paymentInsights.avgDaysToPay}
          riskTrend={riskTrend}
        />

        {/* Risk Assessment */}
        {riskTrend.current > 0 && (
          <RiskAssessmentCard
            riskScore={customer.customer_risk_score || 0}
            riskFactors={riskFactors}
            riskTrend={riskTrend}
          />
        )}

        {/* Communication Health */}
        <CommunicationHealthCard
          communicationHealth={communicationHealth}
        />

        {/* Contact Information */}
        <ContactInformationCard
          email={customer.email}
          phone={customer.phone}
          companyName={customer.company_name}
          onEmailChange={isDemo ? undefined : handleUpdateEmail}
          onPhoneChange={isDemo ? undefined : handleUpdatePhone}
        />

        {/* Active Invoices Table */}
        <ActiveInvoicesTable
          invoices={activeInvoices}
          customerId={customer.id}
        />

        {/* All Invoices Section (Collapsible) */}
        <AllInvoicesSection
          invoices={allInvoices}
          customerId={customer.id}
        />

        {/* Payment Activity */}
        <PaymentActivitySection
          paymentTimeline={paymentTimeline}
          avgDaysToPay={paymentInsights.avgDaysToPay}
        />

        {/* Agent Activity */}
        <AgentActivitySummary
          agentActivity={agentActivity}
          customerId={customer.id}
        />

        {/* Bottom Spacing */}
        <div className="h-24" />
      </div>

    </>
  );
};

export default CustomerDetail;
