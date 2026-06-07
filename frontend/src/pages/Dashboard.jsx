import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import { Link } from 'react-router-dom';
import {
    CheckCircle, ChevronRight, Pencil, X, Save, Camera,
    UserCheck, FileText, CreditCard, ClipboardCheck, BedDouble,
    Loader2, Home, MapPin, Users, Award, Printer, User
} from 'lucide-react';
import { useToast } from '../components/Toast';

/* ═══════════════════════════════════════════════════════════════════════════
   STUDENT DASHBOARD — Split Layout
   Left:  Profile Subbar (YouTube Music artist-style gradient fade photo)
   Right: Vertical Timeline + Allocation Cards
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [profileForm, setProfileForm] = useState({ email: '', phone: '', next_of_kin_name: '', next_of_kin_phone: '' });
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoKey, setPhotoKey] = useState(0);
    const fileInputRef = useRef(null);
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
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-forest" />
                <p className="text-sm font-semibold text-muted">Loading your dashboard…</p>
            </div>
        </div>
    );
    if (!data) return <div className="text-red-600 font-medium p-8">Failed to load dashboard data.</div>;

    const { profile, session, progress, allocation } = data;
    const firstName = profile.first_name || 'Student';
    const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace('/api/v1', '');

    // Photo URL — backend returns a ready-to-use path like "/api/v1/allocation/photo/123"
    const photoUrl = profile.photo_url
        ? `${API_BASE}${profile.photo_url}?v=${photoKey}`
        : null;

    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error('Only JPEG, PNG, or WebP images are allowed.');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Photo must be under 2MB.');
            return;
        }

        setUploadingPhoto(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            await apiClient.post('/allocation/photo', formData);
            toast.success('Photo updated successfully!');
            setPhotoKey(k => k + 1);
            fetchDashboard();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to upload photo.');
        } finally {
            setUploadingPhoto(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const steps = [
        { key: 'registered', label: 'Registered', desc: 'Account created', icon: UserCheck, done: progress.registered, link: null },
        { key: 'applied', label: 'Applied', desc: 'Hostel application submitted', icon: FileText, done: progress.applied, link: '/apply', sublabel: progress.application_status },
        { key: 'paid', label: 'Paid', desc: 'Payment confirmed', icon: CreditCard, done: progress.paid, link: '/payment', sublabel: progress.payment_status },
        { key: 'quiz', label: 'Quiz Completed', desc: 'Compatibility quiz taken', icon: ClipboardCheck, done: progress.quiz_completed, link: '/quiz' },
        { key: 'allocated', label: 'Allocated', desc: 'Bed space assigned', icon: BedDouble, done: progress.allocated, link: '/my-allocation' },
    ];

    const currentStepIdx = steps.findIndex(s => !s.done);
    const completedCount = steps.filter(s => s.done).length;

    const ctaMap = {
        'Applied': { label: 'Submit Application', link: '/apply' },
        'Paid': { label: 'Make Payment', link: '/payment' },
        'Quiz Completed': { label: 'Take Compatibility Quiz', link: '/quiz' },
        'Allocated': { label: 'View Allocation', link: '/my-allocation' },
    };

    const currentStep = currentStepIdx >= 0 ? steps[currentStepIdx] : null;
    const cta = currentStep ? ctaMap[currentStep.label] : null;

    return (
        <div className="animate-in fade-in duration-350">
            {/* ── Responsive Split Layout ─────────────────────────── */}
            <div className="flex flex-col lg:flex-row gap-5">

                {/* ═══════════════════════════════════════════════════
                    LEFT: PROFILE SUBBAR
                    ═══════════════════════════════════════════════════ */}
                <div className="w-full lg:w-80 lg:shrink-0">
                    <div className="glass rounded-2xl overflow-hidden lg:sticky lg:top-6">
                        {/* ── Photo Widget with YouTube Music gradient fade ── */}
                        <div className="relative bg-surface-2">
                            <div className="aspect-[4/3] w-full overflow-hidden relative">
                                {/* Photo or avatar placeholder */}
                                {photoUrl ? (
                                    <img
                                        key={photoKey}
                                        src={photoUrl}
                                        alt={profile.full_name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                    />
                                ) : null}
                                <div
                                    className={`w-full h-full bg-gradient-to-br from-forest/20 via-lime/10 to-surface-2 items-center justify-center ${photoUrl ? 'hidden' : 'flex'}`}
                                >
                                    <div className="w-24 h-24 rounded-full bg-forest/10 flex items-center justify-center">
                                        <User className="w-12 h-12 text-forest/40" />
                                    </div>
                                </div>
                                {/* ── CSS Mask: bottom gradient fade into card bg ── */}
                                <div
                                    className="absolute inset-0 pointer-events-none"
                                    style={{
                                        background: 'linear-gradient(to top, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.72) 8%, rgba(255,255,255,0.5) 20%, rgba(255,255,255,0.15) 40%, transparent 60%)',
                                    }}
                                />
                            </div>

                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handlePhotoUpload}
                                className="hidden"
                            />

                            {/* Update Photo button — floating in the fade zone */}
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingPhoto}
                                    className={`flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-forest text-xs font-bold px-3.5 py-2 rounded-full shadow-md border border-white/60 hover:bg-white hover:shadow-lg transition-all hover:scale-105 active:scale-95 ${uploadingPhoto ? 'opacity-70 cursor-wait' : ''}`}
                                >
                                    {uploadingPhoto ? (
                                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                                    ) : (
                                        <><Camera className="w-3.5 h-3.5" /> Update Photo</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* ── Core Identity ───────────────────────────────── */}
                        <div className="px-5 pt-2 pb-5">
                            <h2 className="text-lg font-extrabold text-heading tracking-tight leading-tight">
                                {profile.full_name}
                            </h2>
                            <p className="text-xs font-mono font-bold text-forest mt-0.5">
                                {profile.identifier}
                            </p>

                            {session && (
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot shrink-0" />
                                    <span className="text-xs font-bold text-forest">{session.name}</span>
                                    <span className="text-[10px] font-semibold text-muted">Active</span>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="h-px bg-black/5 my-4" />

                            {/* ── Profile Details ─────────────────────────── */}
                            <div className="space-y-0">
                                {!editing ? (
                                    <>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.18em]">Profile Details</span>
                                            <button onClick={() => setEditing(true)} className="text-[10px] font-bold text-forest hover:text-forest-light flex items-center gap-1 transition-colors">
                                                <Pencil className="w-2.5 h-2.5" /> Edit
                                            </button>
                                        </div>
                                        <ProfileRow label="Gender" value={profile.gender?.charAt(0).toUpperCase() + profile.gender?.slice(1)} />
                                        <ProfileRow label="Department" value={profile.department} />
                                        <ProfileRow label="Level" value={profile.level} />
                                        <ProfileRow label="Study Type" value={profile.study_type} />
                                        <ProfileRow label="Email" value={profile.email} placeholder="Not set" />
                                        <ProfileRow label="Phone" value={profile.phone} placeholder="Not set" />
                                        <ProfileRow label="Next of Kin" value={profile.next_of_kin_name} placeholder="Not set" />
                                        <ProfileRow label="Kin Phone" value={profile.next_of_kin_phone} placeholder="Not set" />
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.18em]">Edit Profile</span>
                                            <button onClick={() => setEditing(false)} className="text-[10px] font-bold text-muted hover:text-heading flex items-center gap-1 transition-colors">
                                                <X className="w-2.5 h-2.5" /> Cancel
                                            </button>
                                        </div>
                                        {/* Read-only fields */}
                                        <ProfileRow label="Gender" value={profile.gender?.charAt(0).toUpperCase() + profile.gender?.slice(1)} />
                                        <ProfileRow label="Department" value={profile.department} />
                                        <ProfileRow label="Level" value={profile.level} />
                                        <ProfileRow label="Study Type" value={profile.study_type} />
                                        {/* Editable fields */}
                                        <ProfileField label="Email" value={profileForm.email} onChange={v => setProfileForm(f => ({ ...f, email: v }))} placeholder="student@email.com" type="email" />
                                        <ProfileField label="Phone" value={profileForm.phone} onChange={v => setProfileForm(f => ({ ...f, phone: v }))} placeholder="08012345678" />
                                        <ProfileField label="Next of Kin" value={profileForm.next_of_kin_name} onChange={v => setProfileForm(f => ({ ...f, next_of_kin_name: v }))} placeholder="Guardian name" />
                                        <ProfileField label="Kin Phone" value={profileForm.next_of_kin_phone} onChange={v => setProfileForm(f => ({ ...f, next_of_kin_phone: v }))} placeholder="08012345678" />
                                        <button
                                            onClick={handleProfileSave} disabled={saving}
                                            className={`mt-3 w-full flex items-center justify-center gap-2 bg-forest text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-forest/15 transition-all ${saving ? 'opacity-70' : 'hover:bg-forest-hover'}`}
                                        >
                                            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save Profile</>}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    RIGHT: MAIN CONTENT (Timeline + Allocation)
                    ═══════════════════════════════════════════════════ */}
                <div className="flex-1 min-w-0 space-y-5">

                    {/* ── Welcome Header ──────────────────────────────── */}
                    <div>
                        <p className="text-xs font-bold text-forest-muted uppercase tracking-[0.18em]">Welcome back</p>
                        <h1 className="text-2xl font-extrabold text-heading tracking-tight mt-0.5">
                            Hello, {firstName} 👋
                        </h1>
                    </div>

                    {/* ── VERTICAL TIMELINE ───────────────────────────── */}
                    <div className="glass rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xs font-bold text-muted uppercase tracking-[0.18em]">Application Progress</h3>
                            <span className="text-xs font-extrabold text-forest bg-lime-soft border border-lime-border px-2.5 py-1 rounded-full">
                                {completedCount}/{steps.length} Complete
                            </span>
                        </div>

                        <div className="relative">
                            {steps.map((step, i) => {
                                const Icon = step.icon;
                                const isDone = step.done;
                                const isCurrent = i === currentStepIdx;
                                const isLast = i === steps.length - 1;

                                return (
                                    <div key={step.key} className="relative flex gap-4">
                                        {/* ── Vertical connector line ── */}
                                        {!isLast && (
                                            <div className="absolute left-[17px] top-[36px] w-0.5 h-[calc(100%-20px)]">
                                                <div className={`w-full h-full rounded-full transition-colors duration-500 ${isDone ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                                            </div>
                                        )}

                                        {/* ── Node ── */}
                                        <div className="relative z-10 shrink-0 mt-0.5">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                                                isDone
                                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                                                    : isCurrent
                                                        ? 'bg-white border-2 border-emerald-500 text-emerald-600 ring-4 ring-emerald-500/10 shadow-sm'
                                                        : 'bg-gray-100 border border-gray-200 text-gray-400'
                                            }`}>
                                                {isDone ? <CheckCircle className="w-4.5 h-4.5" /> : <Icon className="w-4 h-4" />}
                                            </div>
                                        </div>

                                        {/* ── Step content ── */}
                                        <div className={`flex-1 min-w-0 pb-6 ${isLast ? 'pb-0' : ''}`}>
                                            <div className={`rounded-xl p-3.5 transition-all ${
                                                isCurrent ? 'bg-emerald-50/80 border border-emerald-200/60' : ''
                                            }`}>
                                                <div className="flex items-center gap-2">
                                                    <h4 className={`text-sm font-bold ${
                                                        isDone ? 'text-emerald-700' : isCurrent ? 'text-heading' : 'text-muted'
                                                    }`}>
                                                        {step.label}
                                                    </h4>
                                                    {isDone && (
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Done</span>
                                                    )}
                                                    {step.sublabel && (
                                                        <span className="text-[10px] font-semibold text-muted bg-surface-2 px-1.5 py-0.5 rounded">{step.sublabel}</span>
                                                    )}
                                                </div>
                                                <p className={`text-xs mt-0.5 ${isDone ? 'text-emerald-600/70' : 'text-muted'}`}>
                                                    {step.desc}
                                                </p>

                                                {/* CTA for current step */}
                                                {isCurrent && step.link && (
                                                    <Link
                                                        to={step.link}
                                                        className="inline-flex items-center gap-1.5 mt-2.5 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-lg hover:scale-[1.02] transition-all active:scale-95"
                                                    >
                                                        {ctaMap[step.label]?.label || step.label}
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── ALLOCATION & STATUS CARDS ────────────────────── */}
                    {allocation ? (
                        <div className="glass rounded-2xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
                                <h3 className="text-xs font-bold text-muted uppercase tracking-[0.18em]">Your Allocation</h3>
                                <Link to="/my-allocation" className="text-xs font-bold text-forest hover:text-forest-light flex items-center gap-1 transition-colors">
                                    Full Details <ChevronRight className="w-3 h-3" />
                                </Link>
                            </div>

                            <div className="p-5 space-y-4">
                                {/* Allocation grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <AllocationCard icon={Home} label="Hostel" value={allocation.hostel_name} accent />
                                    <AllocationCard icon={MapPin} label="Block" value={allocation.block_name} />
                                    <AllocationCard icon={BedDouble} label="Room / Bed" value={`${allocation.room_number} / Bed ${allocation.bed_number}`} />
                                    <AllocationCard icon={Users} label="Occupants" value={`${allocation.occupants}/${allocation.room_capacity}`} />
                                </div>

                                {/* Compatibility Score */}
                                {allocation.avg_compatibility_score != null && (
                                    <div className="flex items-center gap-4 bg-emerald-50/80 rounded-xl p-4 border border-emerald-200/60">
                                        <div className="w-14 h-14 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
                                            <span className="text-lg font-black text-emerald-600">{allocation.avg_compatibility_score.toFixed(0)}%</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-emerald-800">Compatibility Score</p>
                                            <div className="w-full h-2 rounded-full bg-emerald-200/50 mt-1.5 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                                                    style={{ width: `${allocation.avg_compatibility_score}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Roommates */}
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
                                                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full">
                                                            {mate.compatibility_score.toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* HMS Ref + Print */}
                                <div className="flex items-center justify-between pt-2 border-t border-black/5">
                                    {progress.hms_reference && (
                                        <div>
                                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">HMS Reference</p>
                                            <p className="text-sm font-mono font-bold text-forest mt-0.5">{progress.hms_reference}</p>
                                        </div>
                                    )}
                                    <Link
                                        to="/my-allocation"
                                        className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-lg transition-all"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        Print Slip
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="glass rounded-2xl p-10 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
                                <Home className="w-6 h-6 text-muted" />
                            </div>
                            <p className="text-muted font-medium text-sm">No allocation yet for this session.</p>
                            {cta && (
                                <Link
                                    to={cta.link}
                                    className="inline-flex items-center gap-1.5 mt-4 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-lg hover:scale-[1.02] transition-all"
                                >
                                    {cta.label}
                                    <ChevronRight className="w-4 h-4" />
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


/* ── Allocation Detail Card ──────────────────────────────────────────────── */
function AllocationCard({ icon: Icon, label, value, accent }) {
    return (
        <div className={`rounded-xl p-3.5 ${accent ? 'glass-dark' : 'bg-surface border border-sidebar-border'}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${accent ? 'text-lime/70' : 'text-muted'}`} />
                <p className={`text-[10px] font-bold uppercase tracking-widest ${accent ? 'text-lime/70' : 'text-muted'}`}>{label}</p>
            </div>
            <p className={`text-sm font-extrabold truncate ${accent ? 'text-white' : 'text-heading'}`}>{value}</p>
        </div>
    );
}

/* ── Profile Row (read-only) ─────────────────────────────────────────────── */
function ProfileRow({ label, value, placeholder, mono }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest shrink-0 mr-3">{label}</span>
            <span className={`text-xs font-semibold text-right truncate max-w-[55%] ${value ? 'text-heading' : 'text-muted/50 italic'} ${mono ? 'font-mono' : ''}`}>
                {value || placeholder || '—'}
            </span>
        </div>
    );
}

/* ── Profile Field (editable) ────────────────────────────────────────────── */
function ProfileField({ label, value, onChange, placeholder, type = 'text' }) {
    return (
        <div className="py-1.5">
            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">{label}</label>
            <input
                type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="glass-input w-full rounded-lg px-3 py-2 text-xs font-medium text-heading placeholder:text-muted-light"
            />
        </div>
    );
}
