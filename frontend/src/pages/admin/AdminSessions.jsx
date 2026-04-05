import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { CalendarDays, Plus, DoorOpen, FileText, CreditCard, Upload, Loader2, X } from 'lucide-react';
import { useToast } from '../../components/Toast';

const PORTAL_CONFIG = [
    { key: 'application',     label: 'Application',     icon: FileText,  field: 'application_portal_open' },
    { key: 'payment',         label: 'Payment',         icon: CreditCard,field: 'payment_portal_open' },
    { key: 'allocation',      label: 'Allocation',      icon: DoorOpen,  field: 'allocation_portal_open' },
    { key: 'register_import', label: 'Register Import', icon: Upload,    field: 'register_import_open' },
];

export default function AdminSessions() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [sessionName, setSessionName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [togglingPortal, setTogglingPortal] = useState(null);
    const toast = useToast();

    const fetchSessions = () => {
        apiClient.get('/admin/sessions')
            .then(res => setSessions(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchSessions(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await apiClient.post('/admin/sessions', { session_name: sessionName.trim() });
            toast.success(res.data.message);
            setSessionName('');
            setShowForm(false);
            fetchSessions();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to create session');
        } finally {
            setSubmitting(false);
        }
    };

    const togglePortal = async (portal) => {
        setTogglingPortal(portal);
        try {
            const res = await apiClient.patch(`/admin/session/toggle/${portal}`);
            toast.success(res.data.message);
            fetchSessions();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to toggle portal');
        } finally {
            setTogglingPortal(null);
        }
    };

    const activeSession = sessions.find(s => s.is_active);

    if (loading) return (
        <div className="flex items-center gap-3 p-8 text-muted font-medium">
            <Loader2 className="w-5 h-5 animate-spin text-forest" /> Loading Sessions…
        </div>
    );

    return (
        <div className="space-y-5 animate-in fade-in duration-350">
            {/* Header */}
            <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
                <div>
                    <p className="text-xs font-bold text-forest-muted uppercase tracking-[0.18em]">Academics</p>
                    <h1 className="text-2xl font-extrabold text-heading tracking-tight mt-0.5">Academic Sessions</h1>
                    <p className="text-sm text-muted font-medium mt-1">Manage academic sessions and portal lifecycle.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-forest text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-forest/15 hover:bg-forest-hover transition-all shrink-0"
                >
                    {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showForm ? 'Cancel' : 'New Session'}
                </button>
            </div>

            {/* Create form */}
            {showForm && (
                <div className="glass rounded-2xl p-5 animate-in slide-in-from-top-2 duration-200">
                    <h3 className="text-sm font-bold text-heading mb-1">Create New Academic Session</h3>
                    <p className="text-xs text-amber-600 font-medium mb-4">
                        Creating a new session will deactivate the current active session and expire all active allocations.
                    </p>
                    <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
                        <input
                            required
                            value={sessionName}
                            onChange={e => setSessionName(e.target.value)}
                            placeholder="e.g. 2025/2026"
                            className="glass-input flex-1 rounded-xl px-4 py-3 text-sm font-medium text-heading placeholder:text-muted-light"
                        />
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`flex items-center gap-2 bg-forest text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md shadow-forest/15 transition-all ${submitting ? 'opacity-70' : 'hover:bg-forest-hover'}`}
                        >
                            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Session'}
                        </button>
                    </form>
                </div>
            )}

            {/* Active session portal controls */}
            {activeSession && (
                <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-black/5 flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-lime-500 pulse-dot" />
                            <span className="text-sm font-black text-heading">Active Session</span>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-lime-soft border border-lime-border text-xs font-bold text-forest">
                            {activeSession.session_name}
                        </span>
                    </div>
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {PORTAL_CONFIG.map(p => {
                            const isOpen = activeSession[p.field];
                            const isToggling = togglingPortal === p.key;
                            return (
                                <div key={p.key} className={`rounded-xl border p-4 transition-all ${isOpen ? 'bg-lime-soft border-lime-border' : 'bg-surface border-sidebar-border'}`}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <p.icon className={`w-4 h-4 ${isOpen ? 'text-forest' : 'text-muted'}`} />
                                        <p className="text-xs font-bold text-heading">{p.label}</p>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${isOpen ? 'text-forest' : 'text-muted'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-lime-500 pulse-dot' : 'bg-gray-300'}`} />
                                            {isOpen ? 'Open' : 'Closed'}
                                        </span>
                                        <button
                                            onClick={() => togglePortal(p.key)}
                                            disabled={isToggling}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                                isOpen ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-forest text-white hover:bg-forest-hover'
                                            } ${isToggling ? 'opacity-60' : ''}`}
                                        >
                                            {isToggling ? '…' : isOpen ? 'Close' : 'Open'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Sessions list */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-black/5 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-muted" />
                    <h3 className="text-sm font-bold text-heading">All Sessions ({sessions.length})</h3>
                </div>
                <div className="divide-y divide-sidebar-border">
                    {sessions.length === 0 ? (
                        <div className="py-12 text-center text-muted font-medium text-sm">No sessions yet. Create one to get started.</div>
                    ) : sessions.map(session => (
                        <div key={session.id} className="p-5 flex items-center gap-4 hover:bg-surface/50 transition-colors">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                session.is_active ? 'bg-lime-soft border border-lime-border' : 'bg-surface-2 border border-sidebar-border'
                            }`}>
                                <CalendarDays className={`w-5 h-5 ${session.is_active ? 'text-forest' : 'text-muted'}`} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-heading">{session.session_name}</p>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {session.is_active ? (
                                        <span className="px-2 py-0.5 rounded-full bg-lime-soft border border-lime-border text-[10px] font-bold text-forest">Active</span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-sidebar-border text-[10px] font-bold text-muted">
                                            {session.session_ended ? 'Ended' : 'Inactive'}
                                        </span>
                                    )}
                                    {session.is_active && PORTAL_CONFIG.map(p => (
                                        <span key={p.key} className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                                            session[p.field] ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-surface border-sidebar-border text-muted'
                                        }`}>
                                            {p.label} {session[p.field] ? '✓' : '✗'}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <span className="text-xs font-bold text-muted/50 shrink-0">#{session.id}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
