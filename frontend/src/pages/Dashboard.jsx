import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { Link } from 'react-router-dom';
import {
    CheckCircle, Home, ChevronRight, Pencil, X, Save,
    UserCheck, FileText, CreditCard, ClipboardCheck, BedDouble, Loader2
} from 'lucide-react';
import { useToast } from '../components/Toast';

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [profileForm, setProfileForm] = useState({ email: '', phone: '', next_of_kin_name: '', next_of_kin_phone: '' });
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    const fetchDashboard = () => {
        apiClient.get('/allocation/dashboard')
            .then(res => {
                setData(res.data);
                const p = res.data.profile;
                setProfileForm({ email: p.email || '', phone: p.phone || '', next_of_kin_name: p.next_of_kin_name || '', next_of_kin_phone: p.next_of_kin_phone || '' });
            })
            .catch(() => toast.error('Failed to load dashboard data.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchDashboard(); }, []);

    const handleProfileSave = async () => {
        setSaving(true);
        try {
            await apiClient.patch('/allocation/profile', profileForm);
            setEditing(false);
            toast.success('Profile updated successfully');
            fetchDashboard();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center gap-3 p-8 text-muted font-medium">
            <Loader2 className="w-5 h-5 animate-spin text-forest" /> Loading dashboard…
        </div>
    );
    if (!data) return <div className="text-red-600 font-medium p-8">Failed to load dashboard data.</div>;

    const { profile, session, progress, allocation } = data;
    const firstName = profile.first_name || 'Student';

    const steps = [
        { key: 'registered',  label: 'Registered',  icon: UserCheck,     done: progress.registered,      link: null },
        { key: 'applied',     label: 'Applied',      icon: FileText,      done: progress.applied,         link: '/apply',         sublabel: progress.application_status },
        { key: 'paid',        label: 'Paid',         icon: CreditCard,    done: progress.paid,            link: '/payment',       sublabel: progress.payment_status },
        { key: 'quiz',        label: 'Quiz',         icon: ClipboardCheck,done: progress.quiz_completed,  link: '/quiz' },
        { key: 'allocated',   label: 'Allocated',    icon: BedDouble,     done: progress.allocated,       link: '/my-allocation' },
        { key: 'view',        label: 'View Room',    icon: Home,          done: progress.allocated,       link: '/my-allocation' },
    ];

    const currentStepIdx = steps.findIndex(s => !s.done);
    const completedCount = steps.filter(s => s.done).length;
    const progressPct = Math.round((completedCount / steps.length) * 100);

    const ctaLabels = { 'Applied': 'Submit Application', 'Paid': 'Make Payment', 'Quiz': 'Take Compatibility Quiz', 'Allocated': 'View Allocation', 'View Room': 'View Room Details' };

    return (
        <div className="space-y-6 animate-in fade-in duration-350">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-forest-muted uppercase tracking-[0.18em]">Welcome back</p>
                    <h1 className="text-2xl font-extrabold text-heading tracking-tight mt-0.5">
                        Hello, {firstName} 👋
                    </h1>
                </div>
                {session && (
                    <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 self-start sm:self-auto">
                        <span className="w-2 h-2 rounded-full bg-lime-500 pulse-dot" />
                        <span className="text-xs font-bold text-forest">{session.name}</span>
                        <span className="text-[10px] font-semibold text-muted">Active Session</span>
                    </div>
                )}
            </div>

            {/* Progress card */}
            <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-muted uppercase tracking-[0.18em]">Application Progress</h3>
                    <span className="text-sm font-black text-forest">{progressPct}%</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-surface-2 mb-6 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-forest to-lime transition-all duration-700"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>

                {/* Desktop stepper */}
                <div className="hidden sm:flex items-start justify-between relative">
                    <div className="absolute top-4 left-0 right-0 h-0.5 bg-surface-2 z-0 mx-5" />
                    <div
                        className="absolute top-4 left-5 h-0.5 bg-gradient-to-r from-forest to-lime z-0 transition-all duration-700"
                        style={{ width: `${Math.max(0, (Math.max(0, currentStepIdx === -1 ? steps.length - 1 : currentStepIdx - 1)) / (steps.length - 1)) * (100 - (10 / steps.length))}%` }}
                    />
                    {steps.map((step, i) => {
                        const Icon = step.icon;
                        const isDone = step.done;
                        const isCurrent = i === currentStepIdx;
                        const content = (
                            <div className="flex flex-col items-center relative z-10 w-16">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${
                                    isDone    ? 'bg-forest text-white shadow-forest/20' :
                                    isCurrent ? 'bg-white border-2 border-forest text-forest ring-4 ring-forest/10' :
                                    'bg-white border border-gray-200 text-muted'
                                }`}>
                                    {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                                </div>
                                <span className={`text-[10px] font-bold mt-2 text-center leading-tight ${isDone ? 'text-forest' : isCurrent ? 'text-heading' : 'text-muted'}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                        return step.link && !isDone && isCurrent
                            ? <Link key={step.key} to={step.link} className="hover:scale-105 transition-transform">{content}</Link>
                            : <div key={step.key}>{content}</div>;
                    })}
                </div>

                {/* Mobile stepper */}
                <div className="sm:hidden space-y-2">
                    {steps.map((step, i) => {
                        const Icon = step.icon;
                        const isDone = step.done;
                        const isCurrent = i === currentStepIdx;
                        const inner = (
                            <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                isDone    ? 'bg-lime-soft border-lime-border' :
                                isCurrent ? 'glass border-forest/20 shadow-sm' :
                                'bg-surface border-transparent'
                            }`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                                    isDone ? 'bg-forest text-white' : isCurrent ? 'bg-white border-2 border-forest text-forest' : 'bg-surface-2 text-muted border border-gray-200'
                                }`}>
                                    {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold ${isDone ? 'text-forest' : isCurrent ? 'text-heading' : 'text-muted'}`}>{step.label}</p>
                                    {step.sublabel && <p className="text-[10px] text-muted font-medium">{step.sublabel}</p>}
                                </div>
                                {isCurrent && step.link && <ChevronRight className="w-4 h-4 text-forest" />}
                            </div>
                        );
                        return step.link && !isDone && isCurrent
                            ? <Link key={step.key} to={step.link}>{inner}</Link>
                            : <div key={step.key}>{inner}</div>;
                    })}
                </div>

                {/* CTA button */}
                {currentStepIdx >= 0 && steps[currentStepIdx]?.link && (
                    <div className="mt-6 text-center">
                        <Link
                            to={steps[currentStepIdx].link}
                            className="inline-flex items-center gap-2 bg-forest text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-forest/20 hover:bg-forest-hover hover:scale-[1.02] transition-all"
                        >
                            {ctaLabels[steps[currentStepIdx].label] || steps[currentStepIdx].label}
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                )}
            </div>

            {/* Bottom grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Allocation card */}
                <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
                        <h3 className="text-xs font-bold text-muted uppercase tracking-[0.18em]">Allocation</h3>
                        {allocation && (
                            <Link to="/my-allocation" className="text-xs font-bold text-forest hover:text-forest-light flex items-center gap-1 transition-colors">
                                Details <ChevronRight className="w-3 h-3" />
                            </Link>
                        )}
                    </div>

                    {allocation ? (
                        <div className="p-5 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="glass-dark rounded-xl p-4">
                                    <p className="text-[10px] font-bold text-lime/70 uppercase tracking-widest">Hostel</p>
                                    <p className="text-base font-black text-white mt-1 truncate">{allocation.hostel_name}</p>
                                </div>
                                <div className="bg-lime-soft rounded-xl p-4 border border-lime-border">
                                    <p className="text-[10px] font-bold text-forest-muted uppercase tracking-widest">Room / Bed</p>
                                    <p className="text-base font-black text-heading mt-1">{allocation.room_number} / Bed {allocation.bed_number}</p>
                                </div>
                            </div>

                            {allocation.avg_compatibility_score != null && (
                                <div className="glass rounded-xl p-4 text-center border border-forest/10">
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Compatibility Score</p>
                                    <p className="text-3xl font-black text-forest mt-1">{allocation.avg_compatibility_score.toFixed(1)}%</p>
                                    <div className="w-24 h-1.5 rounded-full bg-surface-2 mx-auto mt-2">
                                        <div className="h-full rounded-full bg-gradient-to-r from-forest to-lime" style={{ width: `${allocation.avg_compatibility_score}%` }} />
                                    </div>
                                </div>
                            )}

                            {allocation.roommates?.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Roommates</p>
                                    <div className="space-y-2">
                                        {allocation.roommates.map((mate, i) => (
                                            <div key={i} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-sidebar-border">
                                                <div className="w-8 h-8 rounded-full bg-forest text-lime font-bold flex items-center justify-center shrink-0 text-xs shadow-sm">
                                                    {mate.full_name.charAt(0)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-heading text-sm truncate">{mate.full_name}</p>
                                                    <p className="text-[11px] font-semibold text-muted font-mono">{mate.identifier}</p>
                                                </div>
                                                {mate.compatibility_score != null && (
                                                    <span className="text-xs font-bold text-forest bg-lime-soft border border-lime-border px-2.5 py-1 rounded-full">
                                                        {mate.compatibility_score.toFixed(0)}%
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {progress.hms_reference && (
                                <div className="text-center pt-1">
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">HMS Reference</p>
                                    <p className="text-sm font-mono font-bold text-forest mt-0.5">{progress.hms_reference}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-10 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
                                <Home className="w-6 h-6 text-muted" />
                            </div>
                            <p className="text-muted font-medium text-sm">No allocation yet for this session.</p>
                            {currentStepIdx >= 0 && steps[currentStepIdx]?.link && (
                                <Link to={steps[currentStepIdx].link} className="inline-block mt-3 text-sm font-bold text-forest hover:text-forest-light transition-colors">
                                    Next: {steps[currentStepIdx].label} →
                                </Link>
                            )}
                        </div>
                    )}
                </div>

                {/* Profile card */}
                <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
                        <h3 className="text-xs font-bold text-muted uppercase tracking-[0.18em]">Profile</h3>
                        {!editing ? (
                            <button onClick={() => setEditing(true)} className="text-xs font-bold text-forest hover:text-forest-light flex items-center gap-1 transition-colors">
                                <Pencil className="w-3 h-3" /> Edit
                            </button>
                        ) : (
                            <button onClick={() => setEditing(false)} className="text-xs font-bold text-muted hover:text-heading flex items-center gap-1 transition-colors">
                                <X className="w-3 h-3" /> Cancel
                            </button>
                        )}
                    </div>

                    <div className="p-5">
                        {!editing ? (
                            <div className="space-y-2.5">
                                <ProfileRow label="Matric No." value={profile.identifier} mono />
                                <ProfileRow label="Full Name" value={profile.full_name} />
                                <ProfileRow label="Gender" value={profile.gender?.charAt(0).toUpperCase() + profile.gender?.slice(1)} />
                                <ProfileRow label="Department" value={profile.department} />
                                <ProfileRow label="Level" value={profile.level} />
                                <ProfileRow label="Study Type" value={profile.study_type} />
                                <ProfileRow label="Email" value={profile.email} placeholder="Not set" />
                                <ProfileRow label="Phone" value={profile.phone} placeholder="Not set" />
                                <ProfileRow label="Next of Kin" value={profile.next_of_kin_name} placeholder="Not set" />
                                <ProfileRow label="Kin Phone" value={profile.next_of_kin_phone} placeholder="Not set" />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <ProfileRow label="Matric No." value={profile.identifier} mono />
                                <ProfileRow label="Full Name" value={profile.full_name} />
                                <ProfileRow label="Gender" value={profile.gender?.charAt(0).toUpperCase() + profile.gender?.slice(1)} />
                                <ProfileRow label="Department" value={profile.department} />
                                <ProfileRow label="Level" value={profile.level} />
                                <ProfileRow label="Study Type" value={profile.study_type} />
                                <ProfileField label="Email" value={profileForm.email} onChange={v => setProfileForm(f => ({ ...f, email: v }))} placeholder="student@email.com" type="email" />
                                <ProfileField label="Phone" value={profileForm.phone} onChange={v => setProfileForm(f => ({ ...f, phone: v }))} placeholder="08012345678" />
                                <ProfileField label="Next of Kin" value={profileForm.next_of_kin_name} onChange={v => setProfileForm(f => ({ ...f, next_of_kin_name: v }))} placeholder="Guardian name" />
                                <ProfileField label="Kin Phone" value={profileForm.next_of_kin_phone} onChange={v => setProfileForm(f => ({ ...f, next_of_kin_phone: v }))} placeholder="08012345678" />
                                <button
                                    onClick={handleProfileSave} disabled={saving}
                                    className={`mt-1 flex items-center gap-2 bg-forest text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-forest/15 transition-all ${saving ? 'opacity-70' : 'hover:bg-forest-hover'}`}
                                >
                                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Profile</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ProfileRow({ label, value, placeholder, mono }) {
    return (
        <div className="flex items-center justify-between py-1.5 border-b border-black/5 last:border-0">
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest shrink-0 mr-3">{label}</span>
            <span className={`text-sm font-semibold text-right truncate max-w-[60%] ${value ? 'text-heading' : 'text-muted/50 italic'} ${mono ? 'font-mono text-xs' : ''}`}>
                {value || placeholder || '—'}
            </span>
        </div>
    );
}

function ProfileField({ label, value, onChange, placeholder, type = 'text' }) {
    return (
        <div className="space-y-1">
            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest">{label}</label>
            <input
                type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm font-medium text-heading placeholder:text-muted-light"
            />
        </div>
    );
}
