import React, { useState } from 'react';
import { Mail, Phone, Building2, Check, X } from 'lucide-react';

interface ContactInformationCardProps {
  email: string | null;
  phone: string | null;
  companyName: string;
  onEmailChange?: (email: string) => Promise<void>;
  onPhoneChange?: (phone: string) => Promise<void>;
}

export const ContactInformationCard: React.FC<ContactInformationCardProps> = ({
  email,
  phone,
  companyName,
  onEmailChange,
  onPhoneChange,
}) => {
  const [editingField, setEditingField] = useState<'email' | 'phone' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleEditStart = (field: 'email' | 'phone') => {
    setEditingField(field);
    setEditValue(field === 'email' ? email || '' : phone || '');
    setError('');
  };

  const handleEditCancel = () => {
    setEditingField(null);
    setEditValue('');
    setError('');
  };

  const handleEditSave = async (field: 'email' | 'phone') => {
    if (!editValue.trim()) {
      setError(`${field} cannot be empty`);
      return;
    }

    setSaving(true);
    try {
      if (field === 'email' && onEmailChange) {
        await onEmailChange(editValue.trim());
      } else if (field === 'phone' && onPhoneChange) {
        await onPhoneChange(editValue.trim());
      }
      setEditingField(null);
      setEditValue('');
    } catch (err: any) {
      setError(err.message || `Failed to update ${field}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-6 border-t border-gray-200 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-5">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <Building2 size={18} className="text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Contact Information</h3>
      </div>

      <div className="space-y-3">
        {/* Email */}
        <div className="rounded-xl bg-gradient-to-r from-blue-50 to-blue-25 dark:from-blue-950/40 dark:to-blue-900/30 p-4 border border-blue-200 dark:border-blue-800/50">
          {editingField === 'email' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail size={18} className="text-blue-600 dark:text-blue-400" />
                <input
                  type="email"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-red-600 dark:text-red-400 ml-6">{error}</p>}
              <div className="flex gap-2 justify-end ml-6">
                <button
                  onClick={handleEditCancel}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition disabled:opacity-50"
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  onClick={() => handleEditSave('email')}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  <Check size={16} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                  <Mail size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Email</p>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mt-1">{email || 'No email'}</p>
                </div>
              </div>
              {onEmailChange && (
                <button
                  onClick={() => handleEditStart('email')}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>

        {/* Phone */}
        <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-25 dark:from-emerald-950/40 dark:to-emerald-900/30 p-4 border border-emerald-200 dark:border-emerald-800/50">
          {editingField === 'phone' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Phone size={18} className="text-emerald-600 dark:text-emerald-400" />
                <input
                  type="tel"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-red-600 dark:text-red-400 ml-6">{error}</p>}
              <div className="flex gap-2 justify-end ml-6">
                <button
                  onClick={handleEditCancel}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition disabled:opacity-50"
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  onClick={() => handleEditSave('phone')}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  <Check size={16} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                  <Phone size={18} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Phone</p>
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200 mt-1">{phone || 'No phone'}</p>
                </div>
              </div>
              {onPhoneChange && (
                <button
                  onClick={() => handleEditStart('phone')}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg transition"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>

        {/* Company */}
        <div className="rounded-xl bg-gradient-to-r from-purple-50 to-purple-25 dark:from-purple-950/40 dark:to-purple-900/30 p-4 border border-purple-200 dark:border-purple-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <Building2 size={18} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wide">Company</p>
              <p className="text-sm font-medium text-purple-900 dark:text-purple-200 mt-1">{companyName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
