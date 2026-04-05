import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const STYLES = {
    success: 'bg-white/90 text-heading border-emerald-200 shadow-emerald-100',
    error:   'bg-white/90 text-heading border-red-200 shadow-red-100',
    warning: 'bg-white/90 text-heading border-amber-200 shadow-amber-100',
    info:    'bg-white/90 text-heading border-blue-200 shadow-blue-100',
};

const ICON_STYLES = {
    success: 'text-emerald-600',
    error:   'text-red-600',
    warning: 'text-amber-600',
    info:    'text-blue-600',
};

let toastId = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration) => {
        const id = ++toastId;
        const dur = duration ?? (type === 'error' ? 6000 : 4000);
        setToasts(prev => [...prev, { id, message, type, duration: dur, exiting: false }]);
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300);
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none" style={{ maxWidth: '400px' }}>
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onRemove={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onRemove }) {
    const Icon = ICONS[toast.type] || ICONS.info;
    const style = STYLES[toast.type] || STYLES.info;
    const iconStyle = ICON_STYLES[toast.type] || ICON_STYLES.info;

    useEffect(() => {
        if (toast.duration > 0) {
            const timer = setTimeout(() => onRemove(toast.id), toast.duration);
            return () => clearTimeout(timer);
        }
    }, [toast.id, toast.duration, onRemove]);

    return (
        <div
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 ${style} ${toast.exiting
                    ? 'opacity-0 translate-x-8 scale-95'
                    : 'opacity-100 translate-x-0 scale-100 animate-in slide-in-from-bottom-4'
                }`}
        >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconStyle}`} />
            <p className="text-sm font-semibold flex-1 leading-snug">{toast.message}</p>
            <button
                onClick={() => onRemove(toast.id)}
                className="shrink-0 p-0.5 rounded-lg hover:bg-black/5 transition-colors"
            >
                <X className="w-4 h-4 opacity-60" />
            </button>
        </div>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    const { addToast } = ctx;
    return {
        success: (msg, dur) => addToast(msg, 'success', dur),
        error: (msg, dur) => addToast(msg, 'error', dur),
        warning: (msg, dur) => addToast(msg, 'warning', dur),
        info: (msg, dur) => addToast(msg, 'info', dur),
    };
}
