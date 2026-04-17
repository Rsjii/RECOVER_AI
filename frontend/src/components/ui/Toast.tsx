import React, { useEffect, useState } from 'react';
import type { Toast as ToastType } from '../../contexts/NotificationContext';

interface ToastComponentProps extends ToastType {
  onClose: (id: string) => void;
}

const icons = {
  success: (
    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const bgColors = {
  success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
  warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
  info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
};

const ToastComponent: React.FC<ToastComponentProps> = ({ id, type, message, action, duration, onClose }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (duration !== 0) {
      const t = setTimeout(() => {
        setExiting(true);
        setTimeout(() => onClose(id), 200);
      }, duration || 5000);
      return () => clearTimeout(t);
    }
  }, [id, duration, onClose]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => onClose(id), 200);
  };

  // Handle multi-line messages (split by \n and render each line)
  const messageLines = message.split('\n');

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg max-w-2xl transition-all duration-200 ${
      exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
    } ${bgColors[type]}`}>
      <span className="flex-shrink-0 mt-0.5">{icons[type]}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-white whitespace-pre-wrap break-words">
          {messageLines.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
        {action && (
          <button onClick={action.onClick} className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 mt-1 underline">
            {action.label}
          </button>
        )}
      </div>
      <button onClick={handleClose} className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};

export const ToastContainer: React.FC<{ toasts: ToastType[]; onClose: (id: string) => void }> = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[9999] space-y-2">
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
};
