import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const ICONS = { success: CheckCircle, error: AlertCircle, info: Info };
  const STYLES: Record<ToastType, string> = {
    success: 'border-green-500/30 bg-green-500/10 text-green-300',
    error:   'border-red-500/30   bg-red-500/10   text-red-300',
    info:    'border-slate-700    bg-[#0d1424]    text-slate-200',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl pointer-events-auto min-w-[280px] max-w-sm animate-in slide-in-from-right-4 fade-in duration-200 ${STYLES[t.type]}`}
            >
              <Icon size={15} className="shrink-0" />
              <span className="text-sm flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
