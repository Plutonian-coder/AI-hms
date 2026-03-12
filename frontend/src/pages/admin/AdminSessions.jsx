import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { CalendarDays, Plus, DoorOpen, ShieldCheck } from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function AdminSessions() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [sessionName, setSessionName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [togglingElig, setTogglingElig] = useState(false);
    const toast = useToast();

    const fetchSessions = () => {
        apiClient.get('/admin/sessions')
            .then(res => setSessions(res.data))
            .catch(() => { })
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

    const handleTogglePortal = async () => {
        setToggling(true);
        try {
            const res = await apiClient.patch('/admin/session/toggle');
            toast.success(res.data.message);
            fetchSessions();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to toggle portal');
        } finally {
            setToggling(false);
        }
    };

    const handleToggleEligibility = async () => {
        setTogglingElig(true);
        try {
            const res = await apiClient.patch('/admin/session/toggle-eligibility');
            toast.success(res.data.message);
            fetchSessions();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to toggle eligibility portal');
        } finally {
            setTogglingElig(false);
        }
    };

    const activeSession = sessions.find(s => s.is_active);

    if (loading) return <div className="text-muted animate-pulse font-medium">Loading Sessions...</div>;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight">Academic Sessions</h1>
                    <p className="text-muted mt-2 font-medium">Manage academic sessions and allocation portal state.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-lime text-forest px-5 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all"
                >
                    <Plus className="w-5 h-5" />
                    New Session
                </button>
            </div>


            {/* Active Session Portal Toggle */}
            {activeSession && (
                <div className="bg-forest p-6 rounded-3xl shadow-sm space-y-4">
                    <h3 className="text-lg font-bold text-white">Active Session: {activeSession.session_name}</h3>

                    {/* Eligibility Portal */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/5 rounded-2xl p-4">
                        <div>
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${activeSession.eligibility_portal_open
                                    ? 'bg-lime/15 text-lime border border-lime/30'
                                    : 'bg-white/10 text-white/60 border border-white/10'
                                }`}>
                                <span className={`w-2 h-2 rounded-full ${activeSession.eligibility_portal_open ? 'bg-lime animate-pulse' : 'bg-white/40'}`}></span>
                                Eligibility Portal {activeSession.eligibility_portal_open ? 'Open' : 'Closed'}
                            </span>
                        </div>
                        <button
                            onClick={handleToggleEligibility}
                            disabled={togglingElig}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold shadow-lg transition-all text-sm ${activeSession.eligibility_portal_open
                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/25'
                                    : 'bg-lime text-forest hover:bg-lime-hover shadow-lime/25'
                                } ${togglingElig ? 'opacity-70 scale-95' : 'hover:scale-[1.02]'}`}
                        >
                            <ShieldCheck className="w-4 h-4" />
                            {togglingElig ? 'Toggling...' : activeSession.eligibility_portal_open ? 'Close Eligibility' : 'Open Eligibility'}
                        </button>
                    </div>

                    {/* Allocation Portal */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/5 rounded-2xl p-4">
                        <div>
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${activeSession.portal_open
                                    ? 'bg-lime/15 text-lime border border-lime/30'
                                    : 'bg-white/10 text-white/60 border border-white/10'
                                }`}>
                                <span className={`w-2 h-2 rounded-full ${activeSession.portal_open ? 'bg-lime animate-pulse' : 'bg-white/40'}`}></span>
                                Allocation Portal {activeSession.portal_open ? 'Open' : 'Closed'}
                            </span>
                        </div>
                        <button
                            onClick={handleTogglePortal}
                            disabled={toggling}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold shadow-lg transition-all text-sm ${activeSession.portal_open
                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/25'
                                    : 'bg-lime text-forest hover:bg-lime-hover shadow-lime/25'
                                } ${toggling ? 'opacity-70 scale-95' : 'hover:scale-[1.02]'}`}
                        >
                            <DoorOpen className="w-4 h-4" />
                            {toggling ? 'Toggling...' : activeSession.portal_open ? 'Close Allocation' : 'Open Allocation'}
                        </button>
                    </div>
                </div>
            )}

            {/* Create Form */}
            {showForm && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 animate-in slide-in-from-bottom-4 duration-300">
                    <h3 className="text-lg font-bold text-heading mb-4">Create New Academic Session</h3>
                    <p className="text-sm text-amber-600 font-medium mb-4">
                        Creating a new session will deactivate the current active session and expire all active allocations. Students will need to re-verify eligibility and re-pay for the new session.
                    </p>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Session Name</label>
                            <input
                                required
                                value={sessionName}
                                onChange={e => setSessionName(e.target.value)}
                                placeholder="e.g. 2025/2026"
                                className="w-full bg-cream border border-black/10 text-heading rounded-xl focus:ring-lime focus:border-lime p-3.5 font-medium transition-colors"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={submitting}
                                className={`bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 transition-all ${submitting ? 'opacity-70 scale-95' : 'hover:bg-lime-hover hover:scale-[1.02]'}`}
                            >
                                {submitting ? 'Creating...' : 'Create Session'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="bg-cream text-heading px-6 py-3 rounded-full font-bold hover:bg-black/5 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Sessions List */}
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                <div className="px-6 py-5 border-b border-black/5">
                    <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-muted" />
                        All Sessions ({sessions.length})
                    </h3>
                </div>
                <div className="divide-y divide-black/5">
                    {sessions.map((session) => (
                        <div key={session.id} className="p-6 flex items-center justify-between hover:bg-cream/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${session.is_active ? 'bg-lime/10 text-lime' : 'bg-cream text-muted'
                                    }`}>
                                    <CalendarDays className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-bold text-heading text-lg">{session.session_name}</p>
                                    <div className="flex gap-2 mt-1">
                                        {session.is_active ? (
                                            <span className="text-xs font-bold px-2.5 py-1 bg-lime/15 text-lime rounded-full border border-lime/30">
                                                ACTIVE
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold px-2.5 py-1 bg-cream text-muted rounded-full border border-black/10">
                                                INACTIVE
                                            </span>
                                        )}
                                        {session.is_active && (
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${session.eligibility_portal_open
                                                    ? 'bg-lime/10 text-lime border-lime/20'
                                                    : 'bg-cream text-muted border-black/10'
                                                }`}>
                                                Eligibility {session.eligibility_portal_open ? 'OPEN' : 'CLOSED'}
                                            </span>
                                        )}
                                        {session.is_active && (
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${session.portal_open
                                                    ? 'bg-lime/10 text-lime border-lime/20'
                                                    : 'bg-cream text-muted border-black/10'
                                                }`}>
                                                Allocation {session.portal_open ? 'OPEN' : 'CLOSED'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right text-sm text-muted font-medium">
                                ID: {session.id}
                            </div>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div className="p-8 text-center text-muted font-medium">No sessions yet. Create one to get started.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
