import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { Users, Search, BedDouble, Layers, UserCheck, CalendarDays, Printer } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';

const DIMENSION_LABELS = [
    'Sleep Time', 'Wake Time', 'Study Noise', 'Cleanliness',
    'Visitors', 'Night Device', 'Social', 'Noise Tolerance',
];

export default function MyAllocation() {
    const navigate = useNavigate();
    const [allocation, setAllocation] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get('/allocation/my-allocation')
            .then(res => setAllocation(res.data))
            .catch(() => { })
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
                    <div className="bg-surface text-muted p-6 rounded-full">
                        <Search className="w-16 h-16" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-heading">No Bed Allocated Yet</h2>
                        <p className="text-muted mt-2 font-medium max-w-sm mx-auto">
                            Complete the hostel application, payment, and compatibility quiz to get allocated.
                        </p>
                    </div>
                    <Link
                        to="/apply"
                        className="bg-lime text-forest font-bold py-3 px-8 rounded-full shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all text-sm uppercase tracking-widest"
                    >
                        Start Application
                    </Link>
                </div>
            </div>
        );
    }

    // Build radar chart data
    const radarData = DIMENSION_LABELS.map((label, i) => ({
        dimension: label,
        you: allocation.student_vector?.[i] != null ? parseFloat((allocation.student_vector[i] * 100).toFixed(0)) : 0,
        roomAvg: allocation.room_avg_vector?.[i] != null ? parseFloat((allocation.room_avg_vector[i] * 100).toFixed(0)) : 0,
    }));

    const hasRadarData = allocation.student_vector?.length === 8;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight">My Allocation</h1>
                    <p className="text-muted mt-2 font-medium">Your hostel accommodation details.</p>
                </div>
                {allocation.hms_reference && (
                    <button
                        onClick={() => navigate('/receipt')}
                        className="flex items-center gap-2 bg-forest text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-forest-light transition-colors"
                    >
                        <Printer className="w-4 h-4" /> View Receipt
                    </button>
                )}
            </div>

            {/* Main Allocation Card */}
            <div className="glass rounded-2xl overflow-hidden relative">
                <div className="absolute top-0 inset-x-0 h-2 bg-lime"></div>

                {/* Active badge */}
                <div className="absolute top-5 right-5">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-lime/15 text-lime border border-lime/30">
                        <span className="w-2 h-2 rounded-full bg-lime animate-pulse"></span>
                        Active
                    </span>
                </div>

                <div className="p-8 pb-6">
                    <p className="text-xs font-bold text-lime uppercase tracking-widest">Your Accommodation</p>
                    <h2 className="text-3xl font-black text-heading tracking-tight mt-1">{allocation.hostel_name}</h2>
                    {allocation.block_name && (
                        <p className="text-sm font-semibold text-muted mt-1">{allocation.block_name}</p>
                    )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-8 pb-8">
                    <MetricCard icon={BedDouble} label="Bed Space" value={`Bed ${allocation.bed_number}`} color="lime" />
                    <MetricCard icon={Layers} label="Room" value={allocation.room_number} color="forest" />
                    <MetricCard icon={UserCheck} label="Occupants" value={`${allocation.occupants}/${allocation.room_capacity}`} color="lavender" />
                    <MetricCard icon={CalendarDays} label="Compatibility" value={allocation.avg_compatibility_score != null ? `${allocation.avg_compatibility_score.toFixed(1)}%` : 'N/A'} color="sage" />
                </div>

                {/* HMS Reference & preference */}
                <div className="px-8 pb-8 flex flex-wrap gap-4">
                    {allocation.hms_reference && (
                        <div className="bg-surface rounded-xl px-4 py-2 border border-black/5">
                            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">HMS Ref: </span>
                            <span className="text-sm font-mono font-bold text-forest">{allocation.hms_reference}</span>
                        </div>
                    )}
                    {allocation.matched_from_preference && (
                        <div className="bg-surface rounded-xl px-4 py-2 border border-black/5">
                            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Matched: </span>
                            <span className="text-sm font-bold text-forest">Choice #{allocation.matched_from_preference}</span>
                        </div>
                    )}
                    {allocation.allocated_at && (
                        <div className="bg-surface rounded-xl px-4 py-2 border border-black/5">
                            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Date: </span>
                            <span className="text-sm font-bold text-heading">{new Date(allocation.allocated_at).toLocaleDateString()}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Roommates */}
                <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-black/5 flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted" />
                        <h3 className="text-sm font-black text-heading uppercase tracking-widest">Roommates</h3>
                    </div>
                    <div className="p-6">
                        {allocation.roommates && allocation.roommates.length > 0 ? (
                            <div className="space-y-3">
                                {allocation.roommates.map((mate, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-surface rounded-2xl p-4 border border-black/5">
                                        <div className="w-10 h-10 rounded-full bg-forest text-lime font-bold flex items-center justify-center shrink-0 text-sm">
                                            {mate.full_name.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-heading text-sm truncate">{mate.full_name}</p>
                                            <p className="text-[11px] font-semibold text-muted font-mono">{mate.identifier}</p>
                                        </div>
                                        {mate.compatibility_score != null && (
                                            <div className="text-right shrink-0">
                                                <p className="text-lg font-black text-forest">{mate.compatibility_score.toFixed(0)}%</p>
                                                <p className="text-[10px] font-bold text-muted uppercase">Match</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-surface rounded-2xl border border-dashed border-black/10 p-8 text-center">
                                <p className="text-sm text-muted font-medium">No roommates assigned yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Compatibility Radar Chart */}
                {hasRadarData && (
                    <div className="glass rounded-2xl overflow-hidden">
                        <div className="px-6 py-5 border-b border-black/5">
                            <h3 className="text-sm font-black text-heading uppercase tracking-widest">Lifestyle Profile</h3>
                            <p className="text-xs text-muted font-medium mt-1">Your preferences vs room average</p>
                        </div>
                        <div className="p-4">
                            <ResponsiveContainer width="100%" height={320}>
                                <RadarChart data={radarData} outerRadius="70%">
                                    <PolarGrid stroke="#e5e7eb" />
                                    <PolarAngleAxis
                                        dataKey="dimension"
                                        tick={{ fill: '#8A9690', fontSize: 11, fontWeight: 600 }}
                                    />
                                    <PolarRadiusAxis
                                        angle={90}
                                        domain={[0, 100]}
                                        tick={{ fill: '#8A9690', fontSize: 10 }}
                                    />
                                    <Radar
                                        name="You"
                                        dataKey="you"
                                        stroke="#7FE132"
                                        fill="#7FE132"
                                        fillOpacity={0.2}
                                        strokeWidth={2}
                                    />
                                    {allocation.room_avg_vector?.length === 8 && (
                                        <Radar
                                            name="Room Average"
                                            dataKey="roomAvg"
                                            stroke="#092B19"
                                            fill="#092B19"
                                            fillOpacity={0.1}
                                            strokeWidth={2}
                                        />
                                    )}
                                    <Legend
                                        wrapperStyle={{ fontSize: 12, fontWeight: 600 }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

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
