import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { 
    Search, Users, CreditCard, CheckCircle2, Loader2, ShieldOff, 
    CalendarDays, GraduationCap, Eye, X, Mail, Phone, Clock 
} from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function AdminStudents() {
    const [students, setStudents] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedSession, setSelectedSession] = useState('');
    const toast = useToast();

    // Student Profile Drawer States
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);

    const fetchSessions = () => {
        apiClient.get('/admin/sessions')
            .then(res => {
                setSessions(res.data);
                const active = res.data.find(s => s.is_active);
                if (active) setSelectedSession(String(active.id));
            })
            .catch(() => {});
    };

    const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace('/api/v1', '');

    const fetchStudents = (sessId) => {
        setLoading(true);
        const params = sessId ? `?session_id=${sessId}` : '';
        apiClient.get(`/admin/students${params}`)
            .then(res => setStudents(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchSessions(); }, []);
    useEffect(() => { if (selectedSession) fetchStudents(selectedSession); else fetchStudents(); }, [selectedSession]);

    const markAsPaid = async (studentId, matricNo) => {
        if (!window.confirm(`Mark ${matricNo} as PAID for the current session?`)) return;
        try {
            const res = await apiClient.post(`/admin/students/${studentId}/manual-pay`);
            toast.success(res.data.message);
            fetchStudents(selectedSession);
            if (showProfileModal && selectedStudentId === studentId) {
                openProfile(studentId);
            }
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to mark as paid');
        }
    };

    const handleSuspend = async (studentId, name) => {
        if (!window.confirm(`Are you sure you want to suspend student ${name}? This will block their portal access but preserve their records.`)) return;
        try {
            const res = await apiClient.post(`/admin/students/${studentId}/suspend`);
            toast.success(res.data.message);
            fetchStudents(selectedSession);
            if (showProfileModal && selectedStudentId === studentId) {
                // Refresh profile data
                apiClient.get(`/admin/students/${studentId}/profile`)
                    .then(r => setProfileData(r.data))
                    .catch(() => {});
            }
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to suspend student');
        }
    };

    const handleReactivate = async (studentId, name) => {
        if (!window.confirm(`Reactivate student ${name}'s account?`)) return;
        try {
            const res = await apiClient.post(`/admin/students/${studentId}/reactivate`);
            toast.success(res.data.message);
            fetchStudents(selectedSession);
            if (showProfileModal && selectedStudentId === studentId) {
                // Refresh profile data
                apiClient.get(`/admin/students/${studentId}/profile`)
                    .then(r => setProfileData(r.data))
                    .catch(() => {});
            }
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to reactivate student');
        }
    };

    const openProfile = async (studentId) => {
        if (!studentId) {
            toast.info("This student hasn't registered a portal account yet.");
            return;
        }
        setSelectedStudentId(studentId);
        setLoadingProfile(true);
        setShowProfileModal(true);
        try {
            const res = await apiClient.get(`/admin/students/${studentId}/profile`);
            setProfileData(res.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to load student profile');
            setShowProfileModal(false);
        } finally {
            setLoadingProfile(false);
        }
    };

    const levels = [...new Set(students.map(s => s.level).filter(Boolean))].sort();

    const filtered = students.filter(s => {
        const q = searchQuery.toLowerCase();
        const matchSearch = (s.full_name || '').toLowerCase().includes(q) || (s.identifier || '').toLowerCase().includes(q);
        const matchClass = !classFilter || s.level === classFilter;
        const matchStatus = !statusFilter || s.account_status === statusFilter;
        return matchSearch && matchClass && matchStatus;
    });

    return (
        <div className="space-y-5 animate-in fade-in duration-350">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-forest-muted uppercase tracking-[0.18em]">Records</p>
                    <h1 className="text-2xl font-extrabold text-heading tracking-tight mt-0.5">Student Records</h1>
                    <p className="text-sm text-muted font-medium mt-1">Manage student registration, account statuses, and profiles.</p>
                </div>
            </div>

            {/* Total badges */}
            <div className="flex flex-wrap gap-3">
                <div className="glass rounded-xl px-5 py-4 inline-flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-forest/8 flex items-center justify-center">
                        <Users className="w-4.5 h-4.5 text-forest" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-heading leading-none">{students.length}</p>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-0.5">In Register</p>
                    </div>
                </div>
                <div className="glass rounded-xl px-5 py-4 inline-flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-lime-soft flex items-center justify-center">
                        <CheckCircle2 className="w-4.5 h-4.5 text-forest-muted" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-heading leading-none">{students.filter(s => s.has_portal_access).length}</p>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-0.5">Portal Access</p>
                    </div>
                </div>
                <div className="glass rounded-xl px-5 py-4 inline-flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                        <ShieldOff className="w-4.5 h-4.5 text-red-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-heading leading-none">{students.filter(s => s.account_status === 'suspended').length}</p>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-0.5">Suspended</p>
                    </div>
                </div>
            </div>

            {/* Search + filter bar */}
            <div className="glass rounded-xl p-3 flex flex-col lg:flex-row gap-3">
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
                <div className="flex flex-wrap gap-2.5">
                    <select
                        value={classFilter}
                        onChange={e => setClassFilter(e.target.value)}
                        className="glass-input rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading min-w-[130px] outline-none cursor-pointer"
                    >
                        <option value="">All Classes</option>
                        {levels.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="glass-input rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading min-w-[150px] outline-none cursor-pointer"
                    >
                        <option value="">All Statuses</option>
                        <option value="active">Active Accounts</option>
                        <option value="suspended">Suspended</option>
                        <option value="graduate">Graduates</option>
                        <option value="not_registered">Not Registered</option>
                    </select>
                    <select
                        value={selectedSession}
                        onChange={e => setSelectedSession(e.target.value)}
                        className="glass-input rounded-xl px-3.5 py-2.5 text-sm font-semibold text-heading min-w-[160px] outline-none cursor-pointer"
                    >
                        {sessions.map(s => (
                            <option key={s.id} value={String(s.id)}>
                                {s.session_name}{s.is_active ? ' (Active)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
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
                                        <Th>Account</Th>
                                        <Th>Finances</Th>
                                        <Th>Actions</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((s, idx) => (
                                        <tr 
                                            key={s.identifier || idx} 
                                            className="border-b border-sidebar-border hover:bg-surface/60 transition-colors cursor-pointer"
                                            onClick={() => openProfile(s.id)}
                                        >
                                            <td className="px-5 py-3.5">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-forest text-white text-[11px] font-bold font-mono tracking-wide">
                                                    {s.identifier}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    {s.photo_url ? (
                                                        <img 
                                                            src={API_BASE + s.photo_url} 
                                                            alt="" 
                                                            className="w-8 h-8 rounded-full object-cover border border-forest/10 shrink-0" 
                                                            onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${s.full_name}&background=1B4332&color=fff&size=64`; }}
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-forest/8 text-forest font-bold flex items-center justify-center text-xs shrink-0 border border-forest/10">
                                                            {s.full_name?.charAt(0) || '?'}
                                                        </div>
                                                    )}
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
                                            <td className="px-5 py-3.5">
                                                {s.account_status === 'suspended' ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700">
                                                        <ShieldOff className="w-3 h-3" /> Suspended
                                                    </span>
                                                ) : s.account_status === 'graduate' ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                                                        <GraduationCap className="w-3 h-3" /> Graduate
                                                    </span>
                                                ) : s.account_status === 'active' ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                                                        <CheckCircle2 className="w-3 h-3" /> Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-surface border border-sidebar-border text-muted">
                                                        Not Registered
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {s.is_allocated ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-lime-soft border border-lime-border text-forest">
                                                        Allocated
                                                    </span>
                                                ) : s.has_paid ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                                                        Paid
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-surface border border-sidebar-border text-muted">
                                                        Unpaid
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-2">
                                                    {s.has_portal_access ? (
                                                        <button
                                                            onClick={() => openProfile(s.id)}
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-forest text-white hover:bg-forest-hover transition-all"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" /> Profile
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-muted/65 italic">No profile</span>
                                                    )}
                                                    {s.has_portal_access && !s.has_paid && (
                                                        <button
                                                            onClick={() => markAsPaid(s.id, s.identifier)}
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-surface border border-sidebar-border text-muted hover:bg-forest hover:text-white hover:border-forest transition-all"
                                                        >
                                                            <CreditCard className="w-3 h-3" /> Mark Paid
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-sidebar-border">
                            {filtered.map((s, idx) => (
                                <div 
                                    key={s.identifier || idx} 
                                    className="p-4 space-y-2.5 hover:bg-surface/30 transition-colors cursor-pointer"
                                    onClick={() => openProfile(s.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        {s.photo_url ? (
                                            <img 
                                                src={API_BASE + s.photo_url} 
                                                alt="" 
                                                className="w-9 h-9 rounded-full object-cover shrink-0" 
                                                onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${s.full_name}&background=1B4332&color=fff&size=64`; }}
                                            />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-forest/8 text-forest font-bold flex items-center justify-center text-sm shrink-0">
                                                {s.full_name?.charAt(0) || '?'}
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-sm text-heading truncate">{s.full_name}</p>
                                            <span className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-md bg-forest text-white text-[10px] font-bold font-mono">
                                                {s.identifier}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                                        <span className="px-2 py-0.5 rounded-lg bg-lime-soft border border-lime-border text-[10px] font-bold text-forest">{s.level || '—'}</span>
                                        <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${s.gender === 'male' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'}`}>
                                            {s.gender?.charAt(0).toUpperCase() + s.gender?.slice(1) || '—'}
                                        </span>
                                        {s.account_status === 'suspended' ? (
                                            <span className="px-2 py-0.5 rounded-lg bg-red-50 border border-red-200 text-[10px] font-bold text-red-700">Suspended</span>
                                        ) : s.account_status === 'graduate' ? (
                                            <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700">Graduate</span>
                                        ) : s.account_status === 'active' ? (
                                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">Active</span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-lg bg-surface border border-sidebar-border text-[10px] font-bold text-muted">Not Registered</span>
                                        )}
                                        {s.is_allocated ? (
                                            <span className="px-2 py-0.5 rounded-lg bg-lime-soft border border-lime-border text-[10px] font-bold text-forest">Allocated</span>
                                        ) : s.has_paid ? (
                                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">Paid</span>
                                        ) : s.has_portal_access ? (
                                            <button onClick={() => markAsPaid(s.id, s.identifier)} className="px-2 py-0.5 rounded-lg bg-surface border border-sidebar-border text-[10px] font-bold text-muted hover:bg-forest hover:text-white transition-all">
                                                Mark Paid
                                            </button>
                                        ) : null}
                                        {s.has_portal_access && (
                                            <button onClick={() => openProfile(s.id)} className="px-2 py-0.5 rounded-lg bg-forest text-white text-[10px] font-bold transition-all">
                                                Profile
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Slide-over Profile Drawer (Feature 6 & 5) */}
            {showProfileModal && (
                <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
                    <div className="absolute inset-0 overflow-hidden">
                        {/* Overlay */}
                        <div 
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
                            onClick={() => setShowProfileModal(false)}
                        />

                        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
                            <div className="pointer-events-auto w-screen max-w-md transform transition-all duration-300 ease-in-out sm:max-w-lg bg-surface border-l border-sidebar-border shadow-2xl animate-in slide-in-from-right duration-350">
                                <div className="flex h-full flex-col overflow-y-scroll bg-surface py-6 shadow-xl">
                                    {/* Header */}
                                    <div className="px-6 flex items-start justify-between border-b border-sidebar-border pb-5">
                                        <div>
                                            <h2 className="text-lg font-black text-heading" id="slide-over-title">
                                                Student Profile
                                            </h2>
                                            <p className="text-xs text-muted font-medium mt-1">Detailed record and account settings</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-heading transition-colors"
                                            onClick={() => setShowProfileModal(false)}
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>

                                    {/* Content */}
                                    <div className="relative flex-1 px-6 py-6 space-y-6">
                                        {loadingProfile ? (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Loader2 className="w-8 h-8 text-forest animate-spin" />
                                            </div>
                                        ) : profileData ? (
                                            <>
                                                {/* Quick Summary Card */}
                                                <div className="glass-elevated p-5 rounded-2xl flex items-center gap-4">
                                                    {profileData.photo_url ? (
                                                        <img 
                                                            src={API_BASE + profileData.photo_url} 
                                                            alt={`${profileData.first_name} ${profileData.surname}`}
                                                            className="w-16 h-16 rounded-full object-cover border border-forest/10 shrink-0 shadow-sm"
                                                            onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${profileData.first_name}+${profileData.surname}&background=1B4332&color=fff&size=128`; }}
                                                        />
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-full bg-forest/8 text-forest font-black flex items-center justify-center text-2xl border border-forest/10 shrink-0">
                                                            {profileData.first_name?.charAt(0) || '?'}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-extrabold text-lg text-heading leading-tight truncate">
                                                            {profileData.surname} {profileData.first_name}
                                                        </p>
                                                        <span className="inline-flex items-center mt-1.5 px-2.5 py-1 rounded-lg bg-forest text-white text-xs font-bold font-mono tracking-wide">
                                                            {profileData.identifier}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Account Management Card */}
                                                <div className="glass p-5 rounded-2xl space-y-3.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-muted uppercase tracking-widest">Account Status</span>
                                                        {profileData.account_status === 'suspended' ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700">
                                                                <ShieldOff className="w-3 h-3" /> Suspended
                                                            </span>
                                                        ) : profileData.account_status === 'graduate' ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                                                                <GraduationCap className="w-3 h-3" /> Graduate
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                                                                <CheckCircle2 className="w-3 h-3" /> Active
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex gap-2 pt-1.5">
                                                        {profileData.account_status === 'suspended' ? (
                                                            <button
                                                                onClick={() => handleReactivate(profileData.id, `${profileData.surname} ${profileData.first_name}`)}
                                                                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-600/10 transition-all"
                                                            >
                                                                Reactivate Account
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleSuspend(profileData.id, `${profileData.surname} ${profileData.first_name}`)}
                                                                className="flex-1 flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 py-2.5 rounded-xl font-bold text-xs transition-all"
                                                            >
                                                                Suspend Account
                                                            </button>
                                                        )}

                                                        {!profileData.payment && (
                                                            <button
                                                                onClick={() => {
                                                                    markAsPaid(profileData.id, profileData.identifier);
                                                                }}
                                                                className="flex-1 flex items-center justify-center gap-2 bg-forest text-white hover:bg-forest-hover py-2.5 rounded-xl font-bold text-xs shadow-md shadow-forest/15 transition-all"
                                                            >
                                                                <CreditCard className="w-3.5 h-3.5" /> Mark as Paid
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Personal Info Grid */}
                                                <div className="space-y-4">
                                                    <h3 className="text-xs font-black text-muted uppercase tracking-[0.15em] border-b border-sidebar-border pb-2">Academic & Personal</h3>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <DetailItem label="Department" value={profileData.department} />
                                                        <DetailItem label="Class Level" value={profileData.level} />
                                                        <DetailItem label="Study Type" value={profileData.study_type} />
                                                        <DetailItem label="Gender" value={profileData.gender ? profileData.gender.charAt(0).toUpperCase() + profileData.gender.slice(1) : '—'} />
                                                    </div>
                                                </div>

                                                {/* Contact Info */}
                                                <div className="space-y-4">
                                                    <h3 className="text-xs font-black text-muted uppercase tracking-[0.15em] border-b border-sidebar-border pb-2">Contact Details</h3>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2.5 text-sm">
                                                            <Mail className="w-4 h-4 text-muted shrink-0" />
                                                            <span className="font-semibold text-heading break-all">{profileData.email || '—'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2.5 text-sm">
                                                            <Phone className="w-4 h-4 text-muted shrink-0" />
                                                            <span className="font-semibold text-heading">{profileData.phone || '—'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2.5 text-sm text-muted">
                                                            <Clock className="w-4 h-4 text-muted shrink-0" />
                                                            <span>Registered on {profileData.created_at ? new Date(profileData.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Next of Kin */}
                                                <div className="space-y-4">
                                                    <h3 className="text-xs font-black text-muted uppercase tracking-[0.15em] border-b border-sidebar-border pb-2">Next of Kin</h3>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <DetailItem label="Name" value={profileData.next_of_kin_name} />
                                                        <DetailItem label="Phone" value={profileData.next_of_kin_phone} />
                                                    </div>
                                                </div>

                                                {/* Current Session Hostels Status */}
                                                <div className="space-y-4">
                                                    <h3 className="text-xs font-black text-muted uppercase tracking-[0.15em] border-b border-sidebar-border pb-2">Active Session Details</h3>
                                                    <div className="space-y-3">
                                                        {/* Application */}
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="font-medium text-muted">Hostel Application:</span>
                                                            {profileData.application ? (
                                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                                    profileData.application.status === 'allocated' ? 'bg-lime-soft text-forest border border-lime-border' :
                                                                    profileData.application.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                                    profileData.application.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                                                                    'bg-amber-50 text-amber-700 border border-amber-200'
                                                                }`}>
                                                                    {profileData.application.status.toUpperCase()}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-muted font-medium">No Application</span>
                                                            )}
                                                        </div>

                                                        {/* Payment */}
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="font-medium text-muted">Hostel Fee Payment:</span>
                                                            {profileData.payment ? (
                                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    PAID (₦{profileData.payment.amount_naira?.toLocaleString()})
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-muted font-medium">Unpaid</span>
                                                            )}
                                                        </div>

                                                        {/* Allocation */}
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="font-medium text-muted">Bed Space Allocation:</span>
                                                            {profileData.allocation ? (
                                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-lime-soft text-forest border border-lime-border">
                                                                    {profileData.allocation.hostel} • {profileData.allocation.block} • Room {profileData.allocation.room} • Bed {profileData.allocation.bed}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-muted font-medium">Not Allocated</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="py-12 text-center text-muted font-medium text-sm">Failed to retrieve profile record.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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

function DetailItem({ label, value }) {
    return (
        <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-heading">{value || '—'}</p>
        </div>
    );
}
