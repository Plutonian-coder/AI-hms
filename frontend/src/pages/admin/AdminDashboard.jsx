import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import {
    Users, FileText, CheckCircle, BarChart3, Building, BedDouble,
    CreditCard, Upload, Sparkles, Code, ChevronDown, Loader2,
    DoorOpen, TrendingUp, Activity
} from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [session, setSession] = useState(null);
    const [hostels, setHostels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [togglingPortal, setTogglingPortal] = useState(null);
    const toast = useToast();

    useEffect(() => {
        Promise.all([
            apiClient.get('/admin/stats'),
            apiClient.get('/admin/session/status'),
            apiClient.get('/admin/hostels'),
        ])
            .then(([statsRes, sessionRes, hostelsRes]) => {
                setStats(statsRes.data);
                setSession(sessionRes.data);
                setHostels(hostelsRes.data);
            })
            .catch(() => toast.error('Failed to load dashboard data.'))
            .finally(() => setLoading(false));
    }, []);

    const togglePortal = async (portal) => {
        setTogglingPortal(portal);
        try {
            const res = await apiClient.patch(`/admin/session/toggle/${portal}`);
            toast.success(res.data.message);
            const sessionRes = await apiClient.get('/admin/session/status');
            setSession(sessionRes.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to toggle portal');
        } finally {
            setTogglingPortal(null);
        }
    };

    if (loading) return (
        <div className="flex items-center gap-3 p-8 text-muted font-medium">
            <Loader2 className="w-5 h-5 animate-spin text-forest" /> Loading dashboard…
        </div>
    );

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const firstName = user?.full_name?.split(' ')[0] || 'Admin';
    const maleHostels = hostels.filter(h => h.gender === 'male').length;
    const femaleHostels = hostels.filter(h => h.gender === 'female').length;
    const occupancyRate = stats && stats.total_beds > 0
        ? Math.round((stats.occupied_beds / stats.total_beds) * 100) : 0;

    const portals = [
        { key: 'application',     label: 'Application',      icon: FileText,  field: 'application_portal_open' },
        { key: 'payment',         label: 'Payment',           icon: CreditCard,field: 'payment_portal_open' },
        { key: 'allocation',      label: 'Allocation',        icon: DoorOpen,  field: 'allocation_portal_open' },
        { key: 'register_import', label: 'Register Import',   icon: Upload,    field: 'register_import_open' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-350">
            {/* Header */}
            <div>
                <p className="text-xs font-bold text-forest-muted uppercase tracking-[0.18em]">Overview</p>
                <h1 className="text-2xl font-extrabold text-heading tracking-tight mt-0.5">Welcome, {firstName}</h1>
                <p className="text-sm text-muted font-medium mt-1">Here's what's happening in your hostel system.</p>
            </div>

            {/* Session portal control */}
            {session?.status === 'active' ? (
                <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-lime-500 pulse-dot" />
                                <span className="text-sm font-black text-heading">Active Session</span>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-lime-soft border border-lime-border text-xs font-bold text-forest">
                                {session.name}
                            </span>
                        </div>
                        <span className="text-xs text-muted font-medium hidden sm:block">Portal Controls</span>
                    </div>
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {portals.map(p => {
                            const isOpen = session[p.field];
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
                                                isOpen
                                                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                                    : 'bg-forest text-white hover:bg-forest-hover'
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
            ) : (
                <div className="px-4 py-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-semibold text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 shrink-0" />
                    No active session. Create one in the Sessions page.
                </div>
            )}

            {/* Stats grid */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={Users}       label="Total Students"  value={stats.total_students}          accent="forest" />
                    <StatCard icon={CheckCircle} label="Allocated"       value={stats.active_allocations}      accent="success" />
                    <StatCard icon={TrendingUp}  label="Occupancy"       value={`${occupancyRate}%`}           accent="lime" />
                    <StatCard icon={BedDouble}   label="Total Beds"      value={stats.total_beds}              accent="info" />
                    <StatCard icon={Building}    label="Hostels"         value={stats.total_hostels}           accent="forest" />
                    <StatCard icon={Users}       label="In Register"     value={stats.eligible_count ?? 0}     accent="lime" />
                    <StatCard icon={BedDouble}   label="Available Beds"  value={stats.available_beds ?? 0}     accent="success" />
                    <StatCard icon={BarChart3}   label="Occupied Beds"   value={stats.occupied_beds ?? 0}      accent="warning" />
                </div>
            )}

            {/* Bottom grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Occupancy per hostel */}
                <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-black/5">
                        <h3 className="text-sm font-bold text-heading">Occupancy Overview</h3>
                    </div>
                    <div className="p-5">
                        {hostels.length > 0 ? (
                            <div className="space-y-4">
                                {hostels.map(h => {
                                    const pct = h.capacity > 0 ? Math.round((h.occupied / h.capacity) * 100) : 0;
                                    const barColor = pct > 80 ? 'from-red-400 to-red-500' : pct > 50 ? 'from-amber-400 to-amber-500' : 'from-forest to-lime';
                                    return (
                                        <div key={h.id}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <p className="text-sm font-semibold text-heading">{h.name}</p>
                                                <p className="text-xs font-bold text-muted">{h.occupied}/{h.capacity} · {pct}%</p>
                                            </div>
                                            <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-10 text-center text-muted font-medium text-sm">No hostels configured yet.</div>
                        )}
                    </div>
                </div>

                {/* Quick stats */}
                <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-black/5">
                        <h3 className="text-sm font-bold text-heading">Quick Stats</h3>
                    </div>
                    <div className="p-5 space-y-1">
                        <QSRow label="Male Hostels"    value={maleHostels}              chip="bg-blue-50 text-blue-700 border-blue-200" />
                        <QSRow label="Female Hostels"  value={femaleHostels}            chip="bg-pink-50 text-pink-700 border-pink-200" />
                        <QSRow label="Available Beds"  value={stats?.available_beds||0} chip="bg-lime-soft text-forest border-lime-border" />
                        <QSRow label="Occupied Beds"   value={stats?.occupied_beds||0}  chip="bg-amber-50 text-amber-700 border-amber-200" />
                        <QSRow label="Occupancy Rate"  value={`${occupancyRate}%`}      chip={occupancyRate > 80 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-lime-soft text-forest border-lime-border'} />
                    </div>
                </div>
            </div>

            {/* AI NL Query widget */}
            <NLQueryWidget />
        </div>
    );
}

/* ── Stat card ──────────────────────────────────────────────────────────────── */
const accentMap = {
    forest:  { bg: 'bg-forest/8',   icon: 'text-forest',       ring: 'ring-forest/10' },
    lime:    { bg: 'bg-lime-soft',   icon: 'text-forest-muted', ring: 'ring-lime/20' },
    success: { bg: 'bg-emerald-50',  icon: 'text-emerald-600',  ring: 'ring-emerald-100' },
    warning: { bg: 'bg-amber-50',    icon: 'text-amber-600',    ring: 'ring-amber-100' },
    info:    { bg: 'bg-blue-50',     icon: 'text-blue-600',     ring: 'ring-blue-100' },
};

function StatCard({ icon: Icon, label, value, accent }) {
    const c = accentMap[accent] || accentMap.forest;
    return (
        <div className="glass rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4.5 h-4.5 ${c.icon}`} />
            </div>
            <p className="text-2xl font-black text-heading">{value}</p>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-0.5">{label}</p>
        </div>
    );
}

function QSRow({ label, value, chip }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-black/5 last:border-0">
            <span className="text-sm font-semibold text-body">{label}</span>
            <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${chip}`}>{value}</span>
        </div>
    );
}

/* ── NL Query widget ─────────────────────────────────────────────────────────── */
function NLQueryWidget() {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showSql, setShowSql] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await apiClient.post('/admin/nl-query', { query: query.trim() });
            setResult(res.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to process query');
        } finally {
            setLoading(false);
        }
    };

    const suggestions = [
        'How many students are allocated this session?',
        'List all unallocated students',
        'Show total payments confirmed',
    ];

    return (
        <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-black/5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-forest/8 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-forest" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-heading">AI Data Query</h3>
                    <p className="text-[10px] text-muted font-medium">Ask questions about your data in plain English</p>
                </div>
            </div>
            <div className="p-5 space-y-4">
                <form onSubmit={handleSubmit} className="flex gap-3">
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="e.g. How many students registered this session?"
                        className="glass-input flex-1 rounded-xl px-4 py-3 text-sm font-medium text-heading placeholder:text-muted-light"
                    />
                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className={`flex items-center gap-2 bg-forest text-white px-5 py-3 rounded-xl font-bold text-sm shadow-md shadow-forest/15 transition-all ${
                            loading || !query.trim() ? 'opacity-60' : 'hover:bg-forest-hover'
                        }`}
                    >
                        {loading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Sparkles className="w-4 h-4" />
                        }
                    </button>
                </form>

                {/* Suggestion pills */}
                <div className="flex flex-wrap gap-2">
                    {suggestions.map(s => (
                        <button
                            key={s}
                            onClick={() => setQuery(s)}
                            className="text-[10px] font-semibold text-muted hover:text-forest bg-surface hover:bg-lime-soft border border-sidebar-border hover:border-lime-border px-3 py-1.5 rounded-full transition-all"
                        >
                            {s}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                        {error}
                    </div>
                )}

                {result && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                        {/* SQL toggle */}
                        <button
                            onClick={() => setShowSql(!showSql)}
                            className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-heading transition-colors"
                        >
                            <Code className="w-3.5 h-3.5" />
                            {showSql ? 'Hide' : 'Show'} SQL
                            <ChevronDown className={`w-3 h-3 transition-transform ${showSql ? 'rotate-180' : ''}`} />
                        </button>

                        {showSql && (
                            <pre className="bg-heading text-lime p-4 rounded-xl text-xs font-mono overflow-x-auto">
                                {result.sql}
                            </pre>
                        )}

                        {/* Results table */}
                        {result.rows?.length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-sidebar-border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-surface">
                                            {result.columns?.map(col => (
                                                <th key={col} className="px-4 py-2.5 text-left text-[10px] font-bold text-muted uppercase tracking-widest border-b border-sidebar-border">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.rows.map((row, i) => (
                                            <tr key={i} className="hover:bg-surface transition-colors">
                                                {row.map((cell, j) => (
                                                    <td key={j} className="px-4 py-2.5 font-medium text-heading border-b border-sidebar-border last:border-b-0 text-xs">
                                                        {cell ?? '—'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="py-6 text-center text-muted text-sm font-medium">No results found.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
