import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Users, FileText, CheckCircle, BarChart3, Building, DoorOpen, BedDouble, ShieldCheck, LogOut } from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [session, setSession] = useState(null);
    const [hostels, setHostels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
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
            .catch(() => { toast.error('Failed to load dashboard data.'); })
            .finally(() => setLoading(false));
    }, []);

    const togglePortal = async () => {
        setToggling(true);
        try {
            const res = await apiClient.patch('/admin/session/toggle');
            setSession(prev => ({ ...prev, portal_open: res.data.portal_open }));
            toast.success(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to toggle portal');
        } finally {
            setToggling(false);
        }
    };

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Loading Admin Dashboard...</div>;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const firstName = user?.full_name?.split(' ')[0] || 'Admin';
    const maleHostels = hostels.filter(h => h.gender === 'male').length;
    const femaleHostels = hostels.filter(h => h.gender === 'female').length;
    const occupancyRate = stats && stats.total_beds > 0 ? Math.round((stats.occupied_beds / stats.total_beds) * 100) : 0;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight">Welcome, {firstName}</h1>
                <p className="text-muted mt-2 font-medium">Hostel management overview.</p>
            </div>

            {/* Session & Portal Control */}
            {session?.status === 'active' ? (
                <div className="bg-forest p-6 rounded-3xl shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-white">Active Session: {session.name}</h3>
                            <div className="mt-2">
                                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${session.portal_open
                                        ? 'bg-lime/15 text-lime border border-lime/30'
                                        : 'bg-white/10 text-white/60 border border-white/10'
                                    }`}>
                                    <span className={`w-2 h-2 rounded-full ${session.portal_open ? 'bg-lime animate-pulse' : 'bg-white/40'}`}></span>
                                    Portal {session.portal_open ? 'Open' : 'Closed'}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={togglePortal}
                            disabled={toggling}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-all ${session.portal_open
                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/25'
                                    : 'bg-lime text-forest hover:bg-lime-hover shadow-lime/25'
                                } ${toggling ? 'opacity-70 scale-95' : 'hover:scale-[1.02]'}`}
                        >
                            <DoorOpen className="w-5 h-5" />
                            {toggling ? 'Toggling...' : session.portal_open ? 'Close Portal' : 'Open Portal'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 font-bold text-sm">
                    No active session. Create one in the Sessions page.
                </div>
            )}

            {/* 8 Metrics Grid */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                    <StatCard icon={Users} label="Total Students" value={stats.total_students} color="lime" />
                    <StatCard icon={FileText} label="Applications" value={stats.active_allocations} color="forest" />
                    <StatCard icon={CheckCircle} label="Allocated" value={stats.active_allocations} color="lime" />
                    <StatCard icon={BarChart3} label="Occupancy Rate" value={`${occupancyRate}%`} color="amber" />
                    <StatCard icon={Building} label="Total Hostels" value={stats.total_hostels} color="forest" />
                    <StatCard icon={ShieldCheck} label="Eligible Students" value={stats.eligible_count ?? 0} color="sage" />
                    <StatCard icon={BedDouble} label="Total Capacity" value={stats.total_beds} color="lime" />
                    <StatCard icon={LogOut} label="Checkouts" value={stats.checkout_count ?? 0} color="amber" />
                </div>
            )}

            {/* Bottom: Occupancy Overview + Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Occupancy Overview */}
                <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="px-6 py-5 border-b border-black/5">
                        <h3 className="text-lg font-bold text-heading">Occupancy Overview</h3>
                    </div>
                    <div className="p-6">
                        {hostels.length > 0 ? (
                            <div className="space-y-5">
                                {hostels.map(h => {
                                    const pct = h.capacity > 0 ? Math.round((h.occupied / h.capacity) * 100) : 0;
                                    return (
                                        <div key={h.id}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <p className="text-sm font-bold text-heading">{h.name}</p>
                                                <p className="text-xs font-semibold text-muted">{h.occupied}/{h.capacity}</p>
                                            </div>
                                            <div className="w-full h-2 bg-cream rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-lime'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <p className="text-xs font-medium text-muted mt-1">{pct}% occupancy</p>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-muted font-medium">No hostels configured yet.</div>
                        )}
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="px-6 py-5 border-b border-black/5">
                        <h3 className="text-lg font-bold text-heading">Quick Stats</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <QuickStatRow label="Male Hostels" value={maleHostels} color="forest" />
                        <QuickStatRow label="Female Hostels" value={femaleHostels} color="pink" />
                        <QuickStatRow label="Available Beds" value={stats?.available_beds || 0} color="lime" />
                        <QuickStatRow label="Occupied Beds" value={stats?.occupied_beds || 0} color="amber" />
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Sub-components ── */

const colorMap = {
    lime: { bg: 'bg-lime/10', text: 'text-lime', value: 'text-heading' },
    forest: { bg: 'bg-forest/5', text: 'text-forest', value: 'text-heading' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', value: 'text-heading' },
    sage: { bg: 'bg-tag-sage/30', text: 'text-forest', value: 'text-heading' },
    pink: { bg: 'bg-tag-pink/30', text: 'text-forest', value: 'text-heading' },
};

const quickColorMap = {
    forest: 'text-forest',
    pink: 'text-pink-600',
    lime: 'text-lime',
    amber: 'text-amber-600',
};

function StatCard({ icon: Icon, label, value, color }) {
    const c = colorMap[color] || colorMap.lime;
    return (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-black/5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 ${c.bg} rounded-xl`}>
                    <Icon className={`w-5 h-5 ${c.text}`} />
                </div>
                <p className="text-xs font-semibold text-muted uppercase tracking-widest">{label}</p>
            </div>
            <p className={`text-2xl font-black ${c.value}`}>{value}</p>
        </div>
    );
}

function QuickStatRow({ label, value, color }) {
    const c = quickColorMap[color] || 'text-heading';
    return (
        <div className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
            <span className="text-sm font-semibold text-muted">{label}</span>
            <span className={`text-lg font-black ${c}`}>{value}</span>
        </div>
    );
}
