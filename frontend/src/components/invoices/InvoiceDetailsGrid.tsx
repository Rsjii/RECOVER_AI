import React from 'react';
import { Card } from '../ui/Card';
import { formatDate, formatCurrency } from '../../lib/utils';
import { FileText, Calendar, Building2, Mail, Tag, DollarSign } from 'lucide-react';
import type { Invoice, DunningStatus } from '../../types';

interface Props {
  invoice: Invoice;
  dunningStatus?: DunningStatus | null;
  riskScore?: number | null;
}

const DetailItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-gray-50 to-white dark:from-slate-800 dark:to-slate-800 border border-gray-150 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
    <div className="flex-shrink-0 text-blue-600 dark:text-blue-400 mt-1">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{value}</p>
    </div>
  </div>
);

export const InvoiceDetailsGrid: React.FC<Props> = ({ invoice }) => {
  const iconMap: Record<string, React.ReactNode> = {
    'Invoice ID': <FileText size={18} />,
    'Company': <Building2 size={18} />,
    'Amount': <DollarSign size={18} />,
    'Due Date': <Calendar size={18} />,
    'Issued Date': <Calendar size={18} />,
    'Source': <Tag size={18} />,
    'Email': <Mail size={18} />,
    'Status': <FileText size={18} />,
  };

  const details = [
    { label: 'Invoice ID', value: invoice.id?.substring(0, 8) || 'N/A' },
    { label: 'Company', value: invoice.customer_name || 'N/A' },
    { label: 'Amount', value: formatCurrency(Number(invoice.amount), String(invoice.currency)) },
    { label: 'Due Date', value: formatDate(new Date(invoice.due_date)) },
    { label: 'Issued Date', value: formatDate(new Date(invoice.issued_date)) },
    { label: 'Source', value: invoice.source || 'Manual' },
    { label: 'Email', value: invoice.customer_email || 'N/A' },
    { label: 'Status', value: invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <FileText size={20} className="text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Invoice Details</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {details.map((detail, idx) => (
          <DetailItem key={idx} icon={iconMap[detail.label]} label={detail.label} value={detail.value} />
        ))}
      </div>
    </Card>
  );
};
