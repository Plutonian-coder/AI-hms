import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import {
    Users, Printer, Lock, MapPin,
    BedDouble, Building, DoorOpen
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';

const DIMENSION_LABELS = [
    'Sleep Time', 'Wake Time', 'Study Noise', 'Cleanliness',
    'Visitors', 'Night Device', 'Social', 'Noise Tolerance',
];

export default function MyAllocation() {
    const navigate = useNavigate();
    const toast = useToast();
    const [allocation, setAllocation] = useState(null);
    const [loading, setLoading] = useState(true);

    const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace('/api/v1', '');

    useEffect(() => {
        apiClient.get('/allocation/my-allocation')
            .then(res => { if (res.data) setAllocation(res.data); })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-4 border-forest border-t-transparent animate-spin" />
                    <p className="text-sm font-bold text-muted uppercase tracking-widest animate-pulse">Loading Allocation...</p>
                </div>
            </div>
        );
    }

    if (!allocation) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6 px-4">
                <div className="w-16 h-16 rounded-2xl bg-lime-soft flex items-center justify-center shadow-sm">
                    <BedDouble className="w-7 h-7 text-forest" />
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-heading">No Bed Allocated Yet</h2>
                    <p className="text-muted mt-2 font-medium max-w-sm mx-auto">
                        Complete the hostel application, payment, and compatibility quiz to get allocated.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/apply')}
                    className="bg-forest text-lime font-extrabold py-3 px-8 rounded-full shadow-lg hover:bg-forest-light transition-all text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98]"
                >
                    Start Application
                </button>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500 pb-12">
            {/* ── Sleek Dashboard Header ── */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black/5 pb-6">
                <div>
                    <div className="inline-flex items-center gap-2 mb-3 bg-forest/5 border border-forest/10 px-3 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-forest animate-pulse" />
                        <span className="font-extrabold tracking-wider uppercase text-[10px] text-forest">
                            Active Session 2025/2026
                        </span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-heading">
                        My Allocation
                    </h1>
                    <p className="text-sm text-muted mt-1 font-medium">
                        View and manage your hostel block, room details, and roommate information.
                    </p>
                </div>
                {allocation.hms_reference && (
                    <div className="flex flex-col items-start md:items-end gap-1 shrink-0 bg-white border border-sidebar-border rounded-xl p-3 shadow-sm">
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">HMS Reference</span>
                        <span className="text-sm font-mono font-black text-forest">{allocation.hms_reference}</span>
                    </div>
                )}
            </div>

            {/* Content container */}
            <div className="max-w-5xl mx-auto space-y-8">
                {/* ── Allocation Overview Cards Grid ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <AllocCard
                        icon={Building}
                        label="Hostel"
                        value={allocation.hostel_name}
                        desc="Assigned Residence"
                    />
                    <AllocCard
                        icon={MapPin}
                        label="Block"
                        value={allocation.block_name?.split('-')[0]?.trim() || 'N/A'}
                        desc="Wing / Section"
                    />
                    <AllocCard
                        icon={DoorOpen}
                        label="Room"
                        value={allocation.room_number}
                        desc={`${allocation.occupants} of ${allocation.room_capacity} Occupied`}
                    />
                    <AllocCard
                        icon={BedDouble}
                        label="Bedspace"
                        value={`Bed ${allocation.bed_number}`}
                        desc="Your Designated Space"
                    />
                </div>

                {/* ── Meta & Print CTA Row ── */}
                <div className="bg-white rounded-2xl p-5 border border-sidebar-border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-6 w-full sm:w-auto">
                        {allocation.allocated_at && (
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Allocation Date</span>
                                <span className="text-xs font-bold text-heading mt-0.5">
                                    {new Date(allocation.allocated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            </div>
                        )}
                        {allocation.avg_compatibility_score != null && (
                            <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-black/5 pt-2 sm:pt-0 sm:pl-6">
                                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Compatibility Match</span>
                                <span className="text-xs font-bold text-forest mt-0.5 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-lime animate-pulse" />
                                    {allocation.avg_compatibility_score.toFixed(0)}% Avg Match
                                </span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => navigate('/receipt')}
                        className="w-full sm:w-auto group bg-forest hover:bg-forest-light text-lime font-extrabold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg active:scale-[0.98] uppercase tracking-widest text-xs"
                    >
                        <Printer className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
                        Print Allocation Slip
                    </button>
                </div>

                {/* ── Roommates & Lifestyle Profile Side-by-Side ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Roommates */}
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <div className="flex items-center gap-2">
                                <Users className="w-4.5 h-4.5 text-forest" />
                                <h3 className="text-lg font-extrabold text-heading tracking-tight">Roommates</h3>
                            </div>
                            <span className="text-xs font-semibold text-muted bg-surface border border-sidebar-border px-2.5 py-1 rounded-full">
                                {allocation.occupants} / {allocation.room_capacity} occupied
                            </span>
                        </div>

                        <div className="space-y-3 flex-1">
                            {allocation.roommates?.length > 0 ? (
                                allocation.roommates.map((mate, i) => (
                                    <div
                                        key={i}
                                        className="bg-white border border-sidebar-border rounded-2xl p-4 shadow-sm hover:shadow transition-all duration-300 flex items-center justify-between gap-4 group hover:-translate-y-0.5"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            {mate.passport_photo_url && !mate.passport_photo_url.startsWith('http') ? (
                                                <img
                                                    src={`${API_BASE}${mate.passport_photo_url}`}
                                                    alt={mate.full_name}
                                                    className="w-12 h-12 rounded-full object-cover border border-sidebar-border shadow-sm group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-forest/5 text-forest font-bold flex items-center justify-center text-base border border-forest/10 shrink-0">
                                                    {mate.full_name.charAt(0)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-heading text-sm leading-snug truncate">{mate.full_name}</h4>
                                                <p className="text-[11px] font-medium text-muted mt-0.5 truncate">{mate.department || 'General Studies'}</p>
                                                <p className="text-[10px] font-mono text-muted/70 mt-0.5">{mate.identifier}</p>
                                            </div>
                                        </div>
                                        {mate.compatibility_score != null && (
                                            <div className="shrink-0">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-lime-soft border border-lime-border text-forest text-[11px] font-extrabold uppercase tracking-wide">
                                                    {mate.compatibility_score.toFixed(0)}% Match
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="bg-white rounded-2xl border border-dashed border-sidebar-border p-8 text-center flex flex-col items-center justify-center h-48">
                                    <Users className="w-8 h-8 text-muted/40 mb-2" />
                                    <p className="text-xs text-muted font-bold">No roommates assigned yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Lifestyle Profile */}
                    <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h3 className="text-lg font-extrabold text-heading tracking-tight">Lifestyle Profile</h3>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-lime-soft border border-lime-border text-forest text-[9px] font-black uppercase tracking-widest">
                                <Lock className="w-2.5 h-2.5" /> Only you
                            </span>
                        </div>

                        <div className="bg-white rounded-2xl p-6 border border-sidebar-border shadow-sm flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                {DIMENSION_LABELS.map((label, i) => {
                                    const raw = allocation.student_vector?.[i] ?? 0;
                                    const pct = Math.round(raw * 100);
                                    return (
                                        <div key={label} className="group">
                                            <div className="flex justify-between items-end mb-1">
                                                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</span>
                                                <span className="text-xs font-bold text-heading group-hover:text-forest transition-colors">{pct}%</span>
                                            </div>
                                            <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="bg-forest h-full rounded-full transition-all duration-1000 ease-out"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AllocCard({ icon: Icon, label, value, desc }) {
    return (
        <div className="bg-white rounded-2xl p-5 border border-sidebar-border shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px] group">
            <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-forest/5 flex items-center justify-center text-forest group-hover:bg-forest group-hover:text-lime transition-all duration-300">
                    <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</span>
            </div>
            <div className="mt-4">
                <p className="text-xl sm:text-2xl font-extrabold text-heading leading-tight truncate">{value}</p>
                <p className="text-[11px] font-medium text-muted mt-0.5">{desc}</p>
            </div>
        </div>
    );
}
