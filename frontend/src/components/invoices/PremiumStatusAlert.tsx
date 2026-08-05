import React from 'react';
import { AlertCircle, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Props {
  status: 'paused' | 'active' | 'stopped' | 'resolved';
  message: string;
  subMessage?: string;
  resumeDate?: string;
}

export const PremiumStatusAlert: React.FC<Props> = ({ status, message, subMessage, resumeDate }) => {
  const config = {
    paused: {
      icon: <Clock size={24} />,
      bgClass: 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30',
      borderClass: 'border-l-4 border-amber-500',
      textClass: 'text-amber-900 dark:text-amber-200',
      labelClass: 'text-amber-700 dark:text-amber-300',
    },
    active: {
      icon: <AlertCircle size={24} />,
      bgClass: 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30',
      borderClass: 'border-l-4 border-blue-500',
      textClass: 'text-blue-900 dark:text-blue-200',
      labelClass: 'text-blue-700 dark:text-blue-300',
    },
    stopped: {
      icon: <XCircle size={24} />,
      bgClass: 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30',
      borderClass: 'border-l-4 border-red-500',
      textClass: 'text-red-900 dark:text-red-200',
      labelClass: 'text-red-700 dark:text-red-300',
    },
    resolved: {
      icon: <CheckCircle size={24} />,
      bgClass: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30',
      borderClass: 'border-l-4 border-green-500',
      textClass: 'text-green-900 dark:text-green-200',
      labelClass: 'text-green-700 dark:text-green-300',
    },
  };

  const currentConfig = config[status];

  return (
    <div className={`rounded-lg p-5 ${currentConfig.bgClass} ${currentConfig.borderClass}`}>
      <div className="flex items-start gap-4">
        <div className={currentConfig.labelClass}>{currentConfig.icon}</div>
        <div className="flex-1">
          <h3 className={`font-bold text-lg ${currentConfig.labelClass} mb-1`}>{message}</h3>
          {subMessage && (
            <p className={`text-sm ${currentConfig.textClass} mb-2`}>{subMessage}</p>
          )}
          {resumeDate && (
            <div className="flex items-center gap-2 mt-3 p-2 bg-white/50 dark:bg-black/20 rounded">
              <Clock size={16} className={currentConfig.labelClass} />
              <p className={`text-sm font-semibold ${currentConfig.labelClass}`}>
                Resumes on {resumeDate}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};