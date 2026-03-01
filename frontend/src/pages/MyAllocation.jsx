import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { Users, Search, BedDouble, Layers, UserCheck, CalendarDays, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MyAllocation() {
    const [allocation, setAllocation] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get('/allocation/my-allocation')
            .then(res => setAllocation(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Checking Allocation Records...</div>;

    if (!allocation) {
        return (
            <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight">My Allocation</h1>
                    <p className="text-muted mt-2 font-medium">Your hostel accommodation details.</p>
                </div>
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
                    <div className="bg-cream text-muted p-6 rounded-full">
                        <Search className="w-16 h-16" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-heading">No Bed Allocated Yet</h2>
                        <p className="text-muted mt-2 font-medium max-w-sm mx-auto">
                            You currently do not have a hostel allocation for this academic session.
                        </p>
                    </div>
                    <Link
                        to="/apply"
                        className="bg-lime text-forest font-bold py-3 px-8 rounded-full shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all text-sm uppercase tracking-widest"
                    >
                        Begin FCFS Application
                    </Link>
                </div>
            </div>
        );
    }

    const occupants = allocation.roommates ? allocation.roommates.length + 1 : 1;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight">My Allocation</h1>
                <p className="text-muted mt-2 font-medium">Your hostel accommodation details.</p>
            </div>

            {/* Main Allocation Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden relative">
                <div className="absolute top-0 inset-x-0 h-2 bg-lime"></div>

                {/* Active badge */}
                <div className="absolute top-5 right-5">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-lime/15 text-lime border border-lime/30">
                        <span className="w-2 h-2 rounded-full bg-lime animate-pulse"></span>
                        Active
                    </span>
                </div>

                {/* Hostel Name */}
                <div className="p-8 pb-6">
                    <p className="text-xs font-bold text-lime uppercase tracking-widest">Hostel Block</p>
                    <h2 className="text-3xl font-black text-heading tracking-tight mt-1">{allocation.hostel_name}</h2>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-8 pb-8">
                    <MetricCard icon={BedDouble} label="Bed Space" value={`Bed ${allocation.bed_number}`} color="lime" />
                    <MetricCard icon={Layers} label="Room" value={allocation.room_number} color="forest" />
                    <MetricCard icon={UserCheck} label="Occupants" value={`${occupants}/4`} color="lavender" />
                    <MetricCard icon={CalendarDays} label="Status" value="Active" color="sage" />
                </div>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick Actions */}
                <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="px-6 py-5 border-b border-black/5">
                        <h3 className="text-sm font-black text-heading uppercase tracking-widest">Quick Actions</h3>
                    </div>
                    <div className="p-6">
                        <button className="w-full flex items-center justify-center gap-2 bg-lime text-forest px-5 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all text-sm">
                            <Download className="w-4 h-4" />
                            Download Letter
                        </button>
                        <p className="text-xs text-muted font-medium text-center mt-3">Get Allocation PDF</p>
                    </div>
                </div>

                {/* Roommates */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="px-6 py-5 border-b border-black/5 flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted" />
                        <h3 className="text-sm font-black text-heading uppercase tracking-widest">Roommates</h3>
                    </div>
                    <div className="p-6">
                        {allocation.roommates && allocation.roommates.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {allocation.roommates.map((mate, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-cream rounded-2xl p-4 border border-black/5">
                                        <div className="w-10 h-10 rounded-full bg-forest text-lime font-bold flex items-center justify-center shrink-0 text-sm">
                                            {mate.full_name.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-heading text-sm truncate">{mate.full_name}</p>
                                            <p className="text-[11px] font-semibold text-muted font-mono">{mate.identifier}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-cream rounded-2xl border border-dashed border-black/10 p-8 text-center">
                                <p className="text-sm text-muted font-medium">No roommates assigned yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Sub-components ── */

const colorMap = {
    lime: { bg: 'bg-lime/10', icon: 'text-lime', border: 'border-lime/20' },
    forest: { bg: 'bg-forest/5', icon: 'text-forest', border: 'border-forest/10' },
    lavender: { bg: 'bg-tag-lavender/30', icon: 'text-forest', border: 'border-tag-lavender/50' },
    sage: { bg: 'bg-tag-sage/30', icon: 'text-forest', border: 'border-tag-sage/50' },
};

function MetricCard({ icon: Icon, label, value, color }) {
    const c = colorMap[color] || colorMap.lime;
    return (
        <div className={`${c.bg} rounded-2xl p-4 border ${c.border}`}>
            <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${c.icon}`} />
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{label}</p>
            </div>
            <p className="text-lg font-black text-heading">{value}</p>
        </div>
    );
}
