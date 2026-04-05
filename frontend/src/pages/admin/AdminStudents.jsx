import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Search, Users, CreditCard, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function AdminStudents() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const toast = useToast();

    const fetchStudents = () => {
        setLoading(true);
        apiClient.get('/admin/students')
            .then(res => setStudents(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchStudents(); }, []);

    const markAsPaid = async (studentId, matricNo) => {
        if (!window.confirm(`Mark ${matricNo} as PAID for the current session?`)) return;
        try {
            const res = await apiClient.post(`/admin/students/${studentId}/manual-pay`);
            toast.success(res.data.message);
            fetchStudents();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to mark as paid');
        }
    };

    const levels = [...new Set(students.map(s => s.level).filter(Boolean))].sort();

    const filtered = students.filter(s => {
        const q = searchQuery.toLowerCase();
        const matchSearch = s.full_name.toLowerCase().includes(q) || s.identifier.toLowerCase().includes(q);
        const matchClass = !classFilter || s.level === classFilter;
        return matchSearch && matchClass;
    });

    return (
        <div className="space-y-5 animate-in fade-in duration-350">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-forest-muted uppercase tracking-[0.18em]">Records</p>
                    <h1 className="text-2xl font-extrabold text-heading tracking-tight mt-0.5">Student Records</h1>
                    <p className="text-sm text-muted font-medium mt-1">Manage student registration and information.</p>
                </div>
            </div>

            {/* Total badge */}
            <div className="glass rounded-xl px-5 py-4 inline-flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-forest/8 flex items-center justify-center">
                    <Users className="w-4.5 h-4.5 text-forest" />
                </div>
                <div>
                    <p className="text-2xl font-black text-heading leading-none">{students.length}</p>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-0.5">Total Students</p>
                </div>
            </div>

            {/* Search + filter bar */}
            <div className="glass rounded-xl p-3 flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2.5 flex-1 glass-input rounded-xl px-3.5 py-2.5">
                    <Search className="w-4 h-4 text-muted shrink-0" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by name or reg number…"
                        className="flex-1 bg-transparent text-sm font-medium text-heading placeholder:text-muted-light outline-none"
                    />
                </div>
                <select
                    value={classFilter}
                    onChange={e => setClassFilter(e.target.value)}
                    className="glass-input rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading min-w-[140px] outline-none cursor-pointer"
                >
                    <option value="">All Classes</option>
                    {levels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="glass rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 text-forest animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-14 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
                            <Users className="w-6 h-6 text-muted" />
                        </div>
                        <p className="text-muted font-medium text-sm">No students found.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-surface border-b border-sidebar-border">
                                        <Th>Reg. Number</Th>
                                        <Th>Student Name</Th>
                                        <Th>Class</Th>
                                        <Th>Gender</Th>
                                        <Th>Parent Phone</Th>
                                        <Th>Actions</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(s => (
                                        <tr key={s.id} className="border-b border-sidebar-border hover:bg-surface/60 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-forest text-white text-[11px] font-bold font-mono tracking-wide">
                                                    {s.identifier}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full bg-forest/8 text-forest font-bold flex items-center justify-center text-xs shrink-0 border border-forest/10">
                                                        {s.full_name.charAt(0)}
                                                    </div>
                                                    <span className="font-semibold text-sm text-heading">{s.full_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-lime-soft border border-lime-border text-xs font-bold text-forest">
                                                    {s.level || '—'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                                                    s.gender === 'male'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                        : 'bg-pink-50 text-pink-700 border-pink-200'
                                                }`}>
                                                    {s.gender?.charAt(0).toUpperCase() + s.gender?.slice(1) || '—'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-muted font-medium">
                                                {s.phone || '—'}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {s.is_allocated ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-lime-soft border border-lime-border text-forest">
                                                        <CheckCircle2 className="w-3 h-3" /> Allocated
                                                    </span>
                                                ) : s.has_paid ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                                                        <CheckCircle2 className="w-3 h-3" /> Paid
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => markAsPaid(s.id, s.identifier)}
                                                        className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-surface border border-sidebar-border text-muted hover:bg-forest hover:text-white hover:border-forest transition-all"
                                                    >
                                                        <CreditCard className="w-3 h-3" /> Mark Paid
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-sidebar-border">
                            {filtered.map(s => (
                                <div key={s.id} className="p-4 space-y-2.5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-forest/8 text-forest font-bold flex items-center justify-center text-sm shrink-0">
                                            {s.full_name.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-sm text-heading truncate">{s.full_name}</p>
                                            <span className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-md bg-forest text-white text-[10px] font-bold font-mono">
                                                {s.identifier}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        <span className="px-2 py-0.5 rounded-lg bg-lime-soft border border-lime-border text-[10px] font-bold text-forest">{s.level || '—'}</span>
                                        <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${s.gender === 'male' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'}`}>
                                            {s.gender?.charAt(0).toUpperCase() + s.gender?.slice(1) || '—'}
                                        </span>
                                        {s.is_allocated ? (
                                            <span className="px-2 py-0.5 rounded-lg bg-lime-soft border border-lime-border text-[10px] font-bold text-forest">Allocated</span>
                                        ) : s.has_paid ? (
                                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">Paid</span>
                                        ) : (
                                            <button onClick={() => markAsPaid(s.id, s.identifier)} className="px-2 py-0.5 rounded-lg bg-surface border border-sidebar-border text-[10px] font-bold text-muted hover:bg-forest hover:text-white transition-all">
                                                Mark Paid
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Th({ children }) {
    return (
        <th className="px-5 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-[0.15em]">
            {children}
        </th>
    );
}
