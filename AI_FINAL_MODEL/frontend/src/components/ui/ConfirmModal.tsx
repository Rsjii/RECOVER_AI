import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

type ConfirmState = ConfirmOptions & { resolve: (v: boolean) => void };

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue>({ confirm: async () => false });

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise(resolve => setState({ ...opts, resolve }));
  }, []);

  const respond = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const isDanger = state?.danger !== false;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[300] p-4">
          <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-start gap-3 mb-5">
              {isDanger && (
                <div className="w-9 h-9 bg-red-500/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle size={16} className="text-red-400" />
                </div>
              )}
              <div>
                {state.title && (
                  <h3 className="text-white font-semibold mb-1">{state.title}</h3>
                )}
                <p className="text-slate-400 text-sm leading-relaxed">{state.message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => respond(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => respond(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isDanger
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {state.confirmText || (isDanger ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
