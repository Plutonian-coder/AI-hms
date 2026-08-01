import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Search, Trash2, AlertTriangle, ShieldCheck, LogOut, Users, ChevronDown, ChevronUp, FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '../../components/Toast';

const TABS = [
    { key: 'eligible', label: 'Eligible Students', icon: ShieldCheck },
    { key: 'allocated', label: 'Allocated', icon: Users },
    { key: 'history', label: 'Checkout History', icon: LogOut },
];

export default function AdminAllocations() {
    const [activeTab, setActiveTab] = useState('allocated');
    const [allocations, setAllocations] = useState([]);
    const [eligible, setEligible] = useState([]);
    const [checkouts, setCheckouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [revoking, setRevoking] = useState(null);
    const [confirmRevoke, setConfirmRevoke] = useState(null);
    const [selectedReason, setSelectedReason] = useState('');
    const [revocationNotes, setRevocationNotes] = useState('');
    const toast = useToast();

    useEffect(() => {
        if (confirmRevoke) {
            setSelectedReason(confirmRevoke.has_paid ? '' : 'admin_override');
            setRevocationNotes('');
        }
    }, [confirmRevoke]);

    // Expandable document rows
    const [expandedRow, setExpandedRow] = useState(null);
    const [docLoading, setDocLoading] = useState(false);
    const [studentDocs, setStudentDocs] = useState({});

    const fetchData = async () => {
        setLoading(true);
        try {
            const [allocRes, eligRes, checkRes] = await Promise.all([
                apiClient.get('/admin/allocations'),
                apiClient.get('/admin/eligible-students'),
                apiClient.get('/admin/checkouts'),
            ]);
            setAllocations(allocRes.data);
            setEligible(eligRes.data);
            setCheckouts(checkRes.data);
        } catch {
            toast.error('Failed to load data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleCheckIn = async (allocationId, matricNo) => {
        if (!window.confirm(`Verify physical arrival and issue room keys for ${matricNo}?`)) return;
        try {
            const res = await apiClient.post(`/admin/allocations/${allocationId}/check-in`);
            toast.success(res.data.message);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Check-in failed');
        }
    };

    const handleRevoke = async (id, reason = '', notes = '') => {
        setRevoking(id);
        try {
            const res = await apiClient.delete(`/admin/allocations/${id}`, {
                data: { reason, notes }
            });
            toast.success(res.data.message);
            setConfirmRevoke(null);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to revoke allocation');
        } finally {
            setRevoking(null);
        }
    };

    const toggleExpand = async (studentId) => {
        if (expandedRow === studentId) {
            setExpandedRow(null);
            return;
        }
        setExpandedRow(studentId);

        if (!studentDocs[studentId]) {
            setDocLoading(true);
            try {
                const res = await apiClient.get(`/admin/students/${studentId}/documents`);
                setStudentDocs(prev => ({ ...prev, [studentId]: res.data }));
            } catch {
                setStudentDocs(prev => ({ ...prev, [studentId]: [] }));
            } finally {
                setDocLoading(false);
            }
        }
    };

    const filterList = (list, keys) => {
        const q = searchQuery.toLowerCase();
        if (!q) return list;
        return list.filter(item =>
            keys.some(k => item[k]?.toString().toLowerCase().includes(q))
        );
    };

    const filteredAllocations = filterList(allocations, ['full_name', 'identifier', 'hostel_name', 'room_number']);
    const filteredEligible = filterList(eligible, ['full_name', 'identifier', 'department', 'level']);
    const filteredCheckouts = filterList(checkouts, ['full_name', 'identifier', 'hostel_name', 'checkout_type']);

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Loading...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-350">
            <div>
                <h1 className="text-2xl font-extrabold text-heading tracking-tight">Allocation Management</h1>
                <p className="text-muted mt-2 font-medium">View eligible students, active allocations, and checkout history.</p>
            </div>

            {/* Search */}
            <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-muted shrink-0" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by name, matric number, hostel, or room..."
                        className="w-full bg-transparent border-0 border-b border-black/10 p-2.5 font-medium text-sm text-heading placeholder:text-muted/50 focus:outline-none focus:ring-0 focus:border-lime transition-colors"
                    />
                </div>
            </div>

            {/* Revoke Modal */}
            {confirmRevoke && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full mx-4 border border-black/5 animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-6 h-6 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-black text-heading tracking-tight">Revoke Bed Allocation</h3>
                                <p className="text-xs text-muted font-semibold uppercase tracking-wider mt-0.5">Hostel & Housing Services</p>
                            </div>
                        </div>

                        {/* Student Details Card */}
                        <div className="p-4 rounded-2xl bg-surface-2 border border-black/5 space-y-2 mb-6">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-muted uppercase tracking-widest">Student</span>
                                <span className="font-mono text-xs font-bold text-heading">{confirmRevoke.identifier}</span>
                            </div>
                            <p className="text-base font-black text-heading">{confirmRevoke.full_name}</p>
                            
                            <div className="h-px bg-black/5 my-2" />
                            
                            <div className="flex justify-between text-xs font-semibold text-body">
                                <span>Hostel / Room:</span>
                                <span className="text-heading font-bold">{confirmRevoke.hostel_name} &bull; Room {confirmRevoke.room_number}</span>
                            </div>
                            <div className="flex justify-between text-xs font-semibold text-body">
                                <span>Bed Space:</span>
                                <span className="text-heading font-bold">Bed {confirmRevoke.bed_number}</span>
                            </div>
                        </div>

                        {/* Payment Status Info */}
                        <div className={`p-4 rounded-2xl border mb-6 flex items-start gap-3 ${
                            confirmRevoke.has_paid
                                ? 'bg-red-50/50 border-red-200 text-red-700'
                                : 'bg-lime-soft border-lime-border text-forest'
                        }`}>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs uppercase ${
                                confirmRevoke.has_paid ? 'bg-red-100 text-red-700' : 'bg-lime/20 text-forest'
                            }`}>
                                {confirmRevoke.has_paid ? 'Paid' : 'Unpaid'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wider">
                                    {confirmRevoke.has_paid ? 'Enforced Revocation Criteria' : 'No Payment Confirmed'}
                                </p>
                                <p className="text-xs font-medium mt-1 leading-relaxed text-black/60">
                                    {confirmRevoke.has_paid
                                        ? 'This student has completed payment. Institutional criteria must be met, and a formal explanation and notification will be sent automatically via email.'
                                        : 'Student has not paid. Allocation can be revoked immediately. An email notification will still be dispatched.'
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="space-y-4 mb-6">
                            {/* Reason Selector */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-muted uppercase tracking-widest">
                                    Revocation Reason {confirmRevoke.has_paid && <span className="text-red-500">*</span>}
                                </label>
                                <select
                                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-semibold text-heading bg-transparent focus:outline-none focus:ring-2 focus:ring-forest/20 focus:border-forest transition-all"
                                    value={selectedReason}
                                    onChange={e => setSelectedReason(e.target.value)}
                                    required={confirmRevoke.has_paid}
                                >
                                    <option value="" disabled={confirmRevoke.has_paid}>
                                        {confirmRevoke.has_paid ? '-- Select Required Reason --' : '-- Optional Reason (Default: Admin Override) --'}
                                    </option>
                                    <option value="leaving_school">Student Leaving the School / Graduating</option>
                                    <option value="suspension">Academic / Disciplinary Suspension</option>
                                    <option value="disciplinary">Disciplinary Action</option>
                                    <option value="medical">Medical Reasons</option>
                                    <option value="transfer">Transfer to Another Campus / School</option>
                                    <option value="admin_override">Administrative Override / Correction</option>
                                    <option value="other">Other / Custom</option>
                                </select>
                            </div>

                            {/* Notes Textarea */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-bold text-muted uppercase tracking-widest">
                                    Detailed Notes / Explanation {confirmRevoke.has_paid && <span className="text-red-500">*</span>}
                                </label>
                                <textarea
                                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm font-medium text-heading bg-transparent focus:outline-none focus:ring-2 focus:ring-forest/20 focus:border-forest transition-all min-h-[90px]"
                                    placeholder={confirmRevoke.has_paid ? "Explain why this allocation is being revoked. Must be at least 10 characters." : "Optional administrative notes..."}
                                    value={revocationNotes}
                                    onChange={e => setRevocationNotes(e.target.value)}
                                    maxLength={500}
                                />
                                {confirmRevoke.has_paid && (
                                    <p className="text-[10px] text-muted font-semibold">
                                        {revocationNotes.trim().length >= 10
                                            ? '✓ Character count condition met'
                                            : `Requires at least ${10 - revocationNotes.trim().length} more characters.`
                                        }
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleRevoke(confirmRevoke.id, selectedReason, revocationNotes)}
                                disabled={
                                    revoking === confirmRevoke.id ||
                                    (confirmRevoke.has_paid && (!selectedReason || revocationNotes.trim().length < 10))
                                }
                                className={`flex-1 bg-red-600 text-white px-5 py-3.5 rounded-full font-bold shadow-lg shadow-red-600/10 transition-all ${
                                    revoking || (confirmRevoke.has_paid && (!selectedReason || revocationNotes.trim().length < 10))
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'hover:bg-red-700 hover:scale-[1.02] active:scale-[0.98]'
                                }`}
                            >
                                {revoking === confirmRevoke.id ? 'Revoking Allocation...' : 'Revoke & Send Email'}
                            </button>
                            <button
                                onClick={() => setConfirmRevoke(null)}
                                className="flex-1 bg-surface text-heading px-5 py-3.5 rounded-full font-bold hover:bg-black/5 active:scale-[0.98] transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs + Content */}
            <div className="glass rounded-2xl overflow-hidden">
                {/* Tab Bar */}
                <div className="px-4 pt-4 pb-0 border-b border-black/5 overflow-x-auto">
                    <div className="flex gap-1 bg-surface rounded-full p-1 w-fit min-w-full sm:min-w-0 sm:inline-flex">
                        {TABS.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.key;
                            const count = tab.key === 'eligible' ? filteredEligible.length
                                        : tab.key === 'allocated' ? filteredAllocations.length
                                        : filteredCheckouts.length;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => { setActiveTab(tab.key); setExpandedRow(null); }}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all ${
                                        isActive ? 'bg-forest text-white shadow-sm' : 'text-muted hover:text-heading'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-black/5'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Tab: Eligible Students */}
                {activeTab === 'eligible' && (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-black/5 bg-surface/50">
                                        <th className="w-10"></th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Student</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Matric No.</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Gender</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Department</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Level</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Eligible Since</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEligible.map(s => (
                                        <ExpandableStudentRow
                                            key={s.id}
                                            isExpanded={expandedRow === s.id}
                                            onToggle={() => toggleExpand(s.id)}
                                            docs={studentDocs[s.id]}
                                            docLoading={docLoading && expandedRow === s.id}
                                            colSpan={7}
                                            level={s.level}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-xs shrink-0">
                                                        {s.full_name.charAt(0)}
                                                    </div>
                                                    <span className="font-bold text-sm text-heading">{s.full_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4"><span className="font-mono font-semibold text-sm text-muted">{s.identifier}</span></td>
                                            <td className="px-6 py-4"><span className="text-sm font-medium text-body capitalize">{s.gender}</span></td>
                                            <td className="px-6 py-4"><span className="text-sm font-medium text-body">{s.department || '—'}</span></td>
                                            <td className="px-6 py-4"><span className="text-sm font-bold text-heading">{s.level || '—'}</span></td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-medium text-muted">
                                                    {s.eligible_at ? new Date(s.eligible_at).toLocaleDateString() : '—'}
                                                </span>
                                            </td>
                                        </ExpandableStudentRow>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-black/5">
                            {filteredEligible.map(s => (
                                <div key={s.id} className="p-5 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-sm">{s.full_name.charAt(0)}</div>
                                            <div>
                                                <p className="font-bold text-sm text-heading">{s.full_name}</p>
                                                <p className="font-mono text-xs text-muted">{s.identifier}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => toggleExpand(s.id)} className="p-2 text-muted hover:text-heading rounded-xl transition-colors">
                                            {expandedRow === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-lime/10 text-lime">{s.level || '—'}</span>
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface text-body">{s.department || '—'}</span>
                                    </div>
                                    {expandedRow === s.id && (
                                        <DocumentPanel docs={studentDocs[s.id]} loading={docLoading && expandedRow === s.id} level={s.level} />
                                    )}
                                </div>
                            ))}
                        </div>
                        {filteredEligible.length === 0 && (
                            <div className="p-8 text-center text-muted font-medium">
                                {searchQuery ? 'No eligible students match your search.' : 'No eligible students (not yet allocated) for this session.'}
                            </div>
                        )}
                    </>
                )}

                {/* Tab: Allocated Students */}
                {activeTab === 'allocated' && (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-black/5 bg-surface/50">
                                        <th className="w-10"></th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Student</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Matric No.</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Hostel</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Room</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Bed</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Check-In Status</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Date</th>
                                        <th className="text-right px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAllocations.map(a => (
                                        <ExpandableStudentRow
                                            key={a.id}
                                            isExpanded={expandedRow === a.student_id}
                                            onToggle={() => toggleExpand(a.student_id)}
                                            docs={studentDocs[a.student_id]}
                                            docLoading={docLoading && expandedRow === a.student_id}
                                            colSpan={9}
                                            level={a.level}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-xs shrink-0">{a.full_name.charAt(0)}</div>
                                                    <span className="font-bold text-sm text-heading">{a.full_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4"><span className="font-mono font-semibold text-sm text-muted">{a.identifier}</span></td>
                                            <td className="px-6 py-4"><span className="text-sm font-semibold text-heading">{a.hostel_name}</span></td>
                                            <td className="px-6 py-4"><span className="font-mono font-semibold text-sm text-muted">{a.room_number}</span></td>
                                            <td className="px-6 py-4"><span className="font-semibold text-sm text-heading">Bed {a.bed_number}</span></td>
                                            <td className="px-6 py-4">
                                                {a.checked_in ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <CheckCircle className="w-3 h-3" /> Checked-In
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                                        Pending Arrival
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-medium text-muted">
                                                    {a.allocated_at ? new Date(a.allocated_at).toLocaleDateString() : '—'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                {!a.checked_in && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleCheckIn(a.id, a.identifier); }}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-forest bg-lime-soft hover:bg-lime-border border border-lime-border rounded-full transition-colors"
                                                    >
                                                        <CheckCircle className="w-3.5 h-3.5 text-forest" /> Issue Keys
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setConfirmRevoke(a); }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" /> Revoke
                                                </button>
                                            </td>
                                        </ExpandableStudentRow>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-black/5">
                            {filteredAllocations.map(a => (
                                <div key={a.id} className="p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-sm">{a.full_name.charAt(0)}</div>
                                            <div>
                                                <p className="font-bold text-sm text-heading">{a.full_name}</p>
                                                <p className="font-mono text-xs text-muted">{a.identifier}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => toggleExpand(a.student_id)} className="p-2 text-muted hover:text-heading rounded-xl transition-colors">
                                                {expandedRow === a.student_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                            <button onClick={() => setConfirmRevoke(a)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-forest/5 text-forest">{a.hostel_name}</span>
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface text-body">Room {a.room_number}</span>
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-lime/10 text-lime">Bed {a.bed_number}</span>
                                    </div>
                                    {expandedRow === a.student_id && (
                                        <DocumentPanel docs={studentDocs[a.student_id]} loading={docLoading && expandedRow === a.student_id} level={a.level} />
                                    )}
                                </div>
                            ))}
                        </div>
                        {filteredAllocations.length === 0 && (
                            <div className="p-8 text-center text-muted font-medium">
                                {searchQuery ? 'No allocations match your search.' : 'No active allocations for this session.'}
                            </div>
                        )}
                    </>
                )}

                {/* Tab: Checkout History */}
                {activeTab === 'history' && (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-black/5 bg-surface/50">
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Student</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Matric No.</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Hostel / Room</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Type</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Reason</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Recorded By</th>
                                        <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCheckouts.map(c => (
                                        <tr key={c.id} className="border-b border-black/5 hover:bg-surface/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-xs shrink-0">{c.full_name.charAt(0)}</div>
                                                    <span className="font-bold text-sm text-heading">{c.full_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4"><span className="font-mono font-semibold text-sm text-muted">{c.identifier}</span></td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-medium text-heading">{c.hostel_name}</span>
                                                <span className="text-xs text-muted ml-1">R{c.room_number} B{c.bed_number}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                                    c.checkout_type === 'voluntary' ? 'bg-blue-50 text-blue-700' :
                                                    c.checkout_type === 'admin_revocation' ? 'bg-red-50 text-red-700' :
                                                    c.checkout_type === 'session_expiry' ? 'bg-amber-50 text-amber-700' :
                                                    c.checkout_type === 'graduation' ? 'bg-lime/10 text-lime' :
                                                    'bg-surface text-body'
                                                }`}>
                                                    {c.checkout_type.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4"><span className="text-xs text-muted">{c.reason || '—'}</span></td>
                                            <td className="px-6 py-4"><span className="text-xs font-medium text-muted">{c.recorded_by || 'SYSTEM'}</span></td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-medium text-muted">
                                                    {c.checked_out_at ? new Date(c.checked_out_at).toLocaleDateString() : '—'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-black/5">
                            {filteredCheckouts.map(c => (
                                <div key={c.id} className="p-5 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-sm">{c.full_name.charAt(0)}</div>
                                        <div>
                                            <p className="font-bold text-sm text-heading">{c.full_name}</p>
                                            <p className="font-mono text-xs text-muted">{c.identifier}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                            c.checkout_type === 'voluntary' ? 'bg-blue-50 text-blue-700' :
                                            c.checkout_type === 'admin_revocation' ? 'bg-red-50 text-red-700' :
                                            'bg-amber-50 text-amber-700'
                                        }`}>
                                            {c.checkout_type.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface text-body">{c.hostel_name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {filteredCheckouts.length === 0 && (
                            <div className="p-8 text-center text-muted font-medium">
                                {searchQuery ? 'No checkouts match your search.' : 'No checkout records for this session.'}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}


/* ── Sub-components ── */

function ExpandableStudentRow({ isExpanded, onToggle, docs, docLoading, colSpan, level, children }) {
    return (
        <>
            <tr
                className="border-b border-black/5 hover:bg-surface/50 transition-colors cursor-pointer"
                onClick={onToggle}
            >
                <td className="pl-4 py-4">
                    <button className="p-1 text-muted hover:text-heading transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </td>
                {children}
            </tr>
            {isExpanded && (
                <tr className="border-b border-black/5">
                    <td colSpan={colSpan} className="px-6 py-4 bg-surface/30">
                        <DocumentPanel docs={docs} loading={docLoading} level={level} />
                    </td>
                </tr>
            )}
        </>
    );
}

function DocumentPanel({ docs, loading, level }) {
    if (loading) {
        return (
            <div className="flex items-center gap-3 py-4">
                <Loader2 className="w-5 h-5 text-forest animate-spin" />
                <span className="text-sm font-medium text-muted">Loading documents...</span>
            </div>
        );
    }

    const requiresDocs = ['ND1', 'ND2', 'HND1', 'HND2'].includes(level);

    if (!docs || docs.length === 0) {
        return (
            <div className="flex items-center gap-3 py-4">
                <FileText className="w-5 h-5 text-muted" />
                <span className="text-sm font-medium text-muted">
                    {requiresDocs 
                        ? "No eligibility documents uploaded yet." 
                        : "No eligibility documents required for this student's level."}
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-forest" />
                <span className="text-xs font-bold text-heading uppercase tracking-widest">Uploaded Documents & AI Verdicts</span>
            </div>
            {docs.map((doc, i) => (
                <div key={i} className={`flex items-start gap-4 p-4 rounded-2xl border ${
                    doc.ai_verdict === 'verified' ? 'bg-lime/5 border-lime/20' :
                    doc.ai_verdict === 'rejected' ? 'bg-red-50 border-red-100' :
                    'bg-white border-black/5'
                }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        doc.ai_verdict === 'verified' ? 'bg-lime/20' :
                        doc.ai_verdict === 'rejected' ? 'bg-red-100' :
                        'bg-amber-100'
                    }`}>
                        {doc.ai_verdict === 'verified' && <CheckCircle className="w-5 h-5 text-lime" />}
                        {doc.ai_verdict === 'rejected' && <XCircle className="w-5 h-5 text-red-600" />}
                        {doc.ai_verdict !== 'verified' && doc.ai_verdict !== 'rejected' && <Loader2 className="w-5 h-5 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-heading">{doc.label}</h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${
                                doc.ai_verdict === 'verified' ? 'bg-lime/15 text-lime' :
                                doc.ai_verdict === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                            }`}>
                                {doc.ai_verdict}
                            </span>
                        </div>
                        {doc.extracted_identifier && (
                            <p className="text-xs text-muted mt-1">
                                <span className="font-semibold">Extracted ID:</span> <span className="font-mono">{doc.extracted_identifier}</span>
                            </p>
                        )}
                        {doc.rejection_reason && (
                            <p className="text-xs text-red-600 mt-1 font-medium">{doc.rejection_reason}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-muted">
                            {doc.uploaded_at && <span>Uploaded: {new Date(doc.uploaded_at).toLocaleString()}</span>}
                            {doc.verified_at && <span>Verified: {new Date(doc.verified_at).toLocaleString()}</span>}
                        </div>
                        {doc.file_name && (
                            <p className="text-[11px] text-muted/70 font-mono mt-1">{doc.file_name}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
