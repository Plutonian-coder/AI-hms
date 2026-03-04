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
    success: 'bg-forest text-white border-lime/30',
    error: 'bg-red-600 text-white border-red-400/30',
    warning: 'bg-amber-500 text-white border-amber-300/30',
    info: 'bg-forest text-white border-white/20',
};

const ICON_STYLES = {
    success: 'text-lime',
    error: 'text-red-200',
    warning: 'text-amber-100',
    info: 'text-white/70',
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
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-sm transition-all duration-300 ${style} ${toast.exiting
                    ? 'opacity-0 translate-x-8 scale-95'
                    : 'opacity-100 translate-x-0 scale-100 animate-in slide-in-from-bottom-4'
                }`}
        >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconStyle}`} />
            <p className="text-sm font-semibold flex-1 leading-snug">{toast.message}</p>
            <button
                onClick={() => onRemove(toast.id)}
                className="shrink-0 p-0.5 rounded-lg hover:bg-white/10 transition-colors"
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
