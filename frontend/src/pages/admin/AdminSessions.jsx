import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { CalendarDays, Plus, DoorOpen, FileText, CreditCard, Upload, Loader2, X, RotateCcw } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { Clock, Save } from 'lucide-react';

const PORTAL_CONFIG = [
    { key: 'application',     label: 'Application',     icon: FileText,  field: 'application_portal_open' },
    { key: 'payment',         label: 'Payment',         icon: CreditCard,field: 'payment_portal_open' },
    { key: 'allocation',      label: 'Allocation',      icon: DoorOpen,  field: 'allocation_portal_open' },
    { key: 'register_import', label: 'Register Import', icon: Upload,    field: 'register_import_open' },
];

function useCountdown(targetDate) {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!targetDate) return setTimeLeft('No deadline set');
        
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const distance = new Date(targetDate).getTime() - now;
            
            if (distance < 0) {
                setTimeLeft('Expired');
                clearInterval(interval);
                return;
            }
            
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            
            setTimeLeft(`${days}d ${hours}h ${minutes}m`);
        }, 1000);
        
        return () => clearInterval(interval);
    }, [targetDate]);

    return timeLeft;
}

export default function AdminSessions() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [sessionName, setSessionName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [togglingPortal, setTogglingPortal] = useState(null);
    const [reactivatingId, setReactivatingId] = useState(null);
    const [deadlines, setDeadlines] = useState({ application: '', hostel: '' });
    const [updatingDeadlines, setUpdatingDeadlines] = useState(false);
    const toast = useToast();

    const fetchSessions = () => {
        apiClient.get('/admin/sessions')
            .then(res => {
                setSessions(res.data);
                const active = res.data.find(s => s.is_active);
                if (active) {
                    setDeadlines({
                        application: active.application_fee_deadline ? new Date(active.application_fee_deadline).toISOString().slice(0, 16) : '',
                        hostel: active.hostel_fee_deadline ? new Date(active.hostel_fee_deadline).toISOString().slice(0, 16) : ''
                    });
                }
            })
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
    
    const appCountdown = useCountdown(activeSession?.application_fee_deadline);
    const hostelCountdown = useCountdown(activeSession?.hostel_fee_deadline);

    const handleUpdateDeadlines = async () => {
        setUpdatingDeadlines(true);
        try {
            const payload = {};
            if (deadlines.application) payload.application_fee_deadline = new Date(deadlines.application).toISOString();
            if (deadlines.hostel) payload.hostel_fee_deadline = new Date(deadlines.hostel).toISOString();
            
            const res = await apiClient.patch('/admin/session/deadlines', payload);
            toast.success(res.data.message);
            fetchSessions();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to update deadlines');
        } finally {
            setUpdatingDeadlines(false);
        }
    };

    const reactivateSession = async (sessionId, sessionName) => {
        if (!window.confirm(`Reactivate "${sessionName}"? The current active session will be paused.`)) return;
        setReactivatingId(sessionId);
        try {
            const res = await apiClient.post(`/admin/sessions/${sessionId}/reactivate`);
            toast.success(res.data.message);
            fetchSessions();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to reactivate session');
        } finally {
            setReactivatingId(null);
        }
    };

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
                    <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                    
                    {/* Deadlines Section */}
                    <div className="border-t border-black/5 p-4 bg-surface/30">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-4 h-4 text-forest" />
                            <h4 className="text-sm font-bold text-heading">Payment Deadlines</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Application Fee Deadline */}
                            <div className="glass-input rounded-xl p-4">
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Application Fee Deadline</label>
                                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                                    <input 
                                        type="datetime-local" 
                                        value={deadlines.application}
                                        onChange={e => setDeadlines(d => ({ ...d, application: e.target.value }))}
                                        className="bg-transparent text-sm font-medium text-heading focus:outline-none"
                                    />
                                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${appCountdown === 'Expired' ? 'bg-red-100 text-red-600' : appCountdown === 'No deadline set' ? 'text-muted' : 'bg-lime-100 text-forest'}`}>
                                        {appCountdown}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Hostel Fee Deadline */}
                            <div className="glass-input rounded-xl p-4">
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Hostel Fee Deadline</label>
                                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                                    <input 
                                        type="datetime-local" 
                                        value={deadlines.hostel}
                                        onChange={e => setDeadlines(d => ({ ...d, hostel: e.target.value }))}
                                        className="bg-transparent text-sm font-medium text-heading focus:outline-none"
                                    />
                                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${hostelCountdown === 'Expired' ? 'bg-red-100 text-red-600' : hostelCountdown === 'No deadline set' ? 'text-muted' : 'bg-lime-100 text-forest'}`}>
                                        {hostelCountdown}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button 
                                onClick={handleUpdateDeadlines}
                                disabled={updatingDeadlines}
                                className={`flex items-center gap-2 bg-lime text-forest px-4 py-2 rounded-lg font-bold text-sm hover:bg-lime-hover transition-colors shadow-sm ${updatingDeadlines ? 'opacity-60' : ''}`}
                            >
                                <Save className="w-4 h-4" /> {updatingDeadlines ? 'Saving...' : 'Save Deadlines'}
                            </button>
                        </div>
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

                            {!session.is_active && (
                                <button
                                    onClick={() => reactivateSession(session.id, session.session_name)}
                                    disabled={reactivatingId === session.id}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                                        reactivatingId === session.id
                                            ? 'opacity-50 bg-surface text-muted'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                    }`}
                                >
                                    <RotateCcw className={`w-3 h-3 ${reactivatingId === session.id ? 'animate-spin' : ''}`} />
                                    {reactivatingId === session.id ? 'Reactivating...' : 'Reactivate'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
