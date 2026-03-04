import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { Link } from 'react-router-dom';
import { Home, Users, CheckCircle, Clock, Shield, ChevronRight, Pencil, X, Save } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [profileForm, setProfileForm] = useState({ department: '', level: '', email: '', phone: '' });
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    const fetchDashboard = () => {
        apiClient.get('/allocation/dashboard')
            .then(res => {
                setData(res.data);
                const p = res.data.profile;
                setProfileForm({
                    department: p.department || '',
                    level: p.level || '',
                    email: p.email || '',
                    phone: p.phone || '',
                });
            })
            .catch(() => { toast.error('Failed to load dashboard data.'); })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchDashboard(); }, []);

    const handleProfileSave = async () => {
        setSaving(true);
        const form = new FormData();
        if (profileForm.department) form.append('department', profileForm.department);
        if (profileForm.level) form.append('level', profileForm.level);
        if (profileForm.email) form.append('email', profileForm.email);
        if (profileForm.phone) form.append('phone', profileForm.phone);

        try {
            await apiClient.patch('/allocation/profile', form);
            setEditing(false);
            toast.success('Profile updated successfully');
            fetchDashboard();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to save profile');
        }
        finally { setSaving(false); }
    };

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Loading Dashboard...</div>;
    if (!data) return <div className="text-red-500 font-medium p-8">Failed to load dashboard data.</div>;

    const { profile, session, allocation, payment_status, application_status } = data;
    const firstName = profile.first_name || 'Student';

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-lime uppercase tracking-[0.2em]">Hello, {firstName}</p>
                    <h1 className="text-2xl font-extrabold text-heading tracking-tight mt-1">Your Accommodation Status Grid</h1>
                </div>
                {session && (
                    <div className="flex items-center gap-2 bg-forest rounded-full px-4 py-2">
                        <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Session</span>
                        <span className="text-sm font-black text-white">{session.name}</span>
                    </div>
                )}
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <StatusCard icon={CheckCircle} label="Application Status" value={application_status} color={allocation ? 'lime' : 'muted'} />
                <StatusCard icon={Shield} label="Payment Verification" value={payment_status} color={payment_status === 'VERIFIED' ? 'lime' : payment_status === 'PENDING' ? 'amber' : 'muted'} />
                <StatusCard icon={Clock} label="Priority Score" value="N/A" color="muted" />
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Allocation Matrix */}
                <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
                        <h3 className="text-sm font-black text-heading uppercase tracking-widest">Allocation Matrix</h3>
                        {allocation && (
                            <Link to="/my-allocation" className="text-xs font-bold text-lime hover:text-lime-hover flex items-center gap-1 transition-colors">
                                View Details <ChevronRight className="w-3 h-3" />
                            </Link>
                        )}
                    </div>

                    {allocation ? (
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-forest rounded-xl p-4">
                                    <p className="text-[10px] font-bold text-lime uppercase tracking-widest">Hostel Block</p>
                                    <p className="text-lg font-black text-white mt-1 truncate">{allocation.hostel_name}</p>
                                </div>
                                <div className="bg-lime/10 rounded-xl p-4 border border-lime/20">
                                    <p className="text-[10px] font-bold text-forest uppercase tracking-widest">Room & Bed</p>
                                    <p className="text-lg font-black text-heading mt-1">{allocation.room_number} / {allocation.bed_number}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">Roommates Detected</p>
                                {allocation.roommates && allocation.roommates.length > 0 ? (
                                    <div className="space-y-2">
                                        {allocation.roommates.map((mate, i) => (
                                            <div key={i} className="flex items-center gap-3 bg-cream rounded-xl p-3 border border-black/5">
                                                <div className="w-9 h-9 rounded-full bg-forest text-lime font-bold flex items-center justify-center shrink-0 text-sm">
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
                                    <p className="text-sm text-muted font-medium">No roommates assigned yet.</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <div className="bg-cream rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                <Home className="w-8 h-8 text-muted" />
                            </div>
                            <p className="text-muted font-medium text-sm">No allocation yet for this session.</p>
                            <Link to="/apply" className="inline-block mt-4 text-sm font-bold text-lime hover:text-lime-hover transition-colors">
                                Apply Now &rarr;
                            </Link>
                        </div>
                    )}
                </div>

                {/* Profile Summary */}
                <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
                        <h3 className="text-sm font-black text-heading uppercase tracking-widest">Profile Summary</h3>
                        {!editing ? (
                            <button onClick={() => setEditing(true)} className="text-xs font-bold text-lime hover:text-lime-hover flex items-center gap-1 transition-colors">
                                <Pencil className="w-3 h-3" /> Edit
                            </button>
                        ) : (
                            <button onClick={() => setEditing(false)} className="text-xs font-bold text-muted hover:text-heading flex items-center gap-1 transition-colors">
                                <X className="w-3 h-3" /> Cancel
                            </button>
                        )}
                    </div>

                    <div className="p-6">
                        {!editing ? (
                            <div className="space-y-4">
                                <ProfileRow label="Matric Number" value={profile.identifier} />
                                <ProfileRow label="Full Name" value={profile.full_name} />
                                <ProfileRow label="Gender" value={profile.gender?.charAt(0).toUpperCase() + profile.gender?.slice(1)} />
                                <ProfileRow label="Department" value={profile.department} placeholder="Not set" />
                                <ProfileRow label="Level" value={profile.level} placeholder="Not set" />
                                <ProfileRow label="Email" value={profile.email} placeholder="Not set" />
                                <ProfileRow label="Phone" value={profile.phone} placeholder="Not set" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <ProfileRow label="Matric Number" value={profile.identifier} />
                                <ProfileRow label="Full Name" value={profile.full_name} />
                                <ProfileRow label="Gender" value={profile.gender?.charAt(0).toUpperCase() + profile.gender?.slice(1)} />
                                <ProfileField label="Department" value={profileForm.department} onChange={v => setProfileForm(f => ({ ...f, department: v }))} placeholder="e.g. Computer Science" />
                                <ProfileField label="Level" value={profileForm.level} onChange={v => setProfileForm(f => ({ ...f, level: v }))} placeholder="e.g. ND2, HND1" />
                                <ProfileField label="Email" value={profileForm.email} onChange={v => setProfileForm(f => ({ ...f, email: v }))} placeholder="student@email.com" />
                                <ProfileField label="Phone" value={profileForm.phone} onChange={v => setProfileForm(f => ({ ...f, phone: v }))} placeholder="08012345678" />

                                <button
                                    onClick={handleProfileSave}
                                    disabled={saving}
                                    className={`mt-2 flex items-center gap-2 bg-lime text-forest px-5 py-2.5 rounded-full font-bold text-sm shadow-lg shadow-lime/25 transition-all ${saving ? 'opacity-70 scale-95' : 'hover:bg-lime-hover hover:scale-[1.02]'}`}
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Saving...' : 'Save Profile'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* Sub-components */

const colorMap = {
    lime: { bg: 'bg-forest', text: 'text-lime', value: 'text-lime', icon: 'text-lime' },
    amber: { bg: 'bg-forest', text: 'text-amber-400', value: 'text-amber-400', icon: 'text-amber-400' },
    muted: { bg: 'bg-forest', text: 'text-white/40', value: 'text-white/60', icon: 'text-white/30' },
};

function StatusCard({ icon: Icon, label, value, color }) {
    const c = colorMap[color] || colorMap.muted;
    return (
        <div className={`${c.bg} p-5 rounded-2xl shadow-lg shadow-forest/20 hover:shadow-xl transition-shadow`}>
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-white/10 rounded-lg">
                    <Icon className={`w-5 h-5 ${c.icon}`} />
                </div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em]">{label}</p>
            </div>
            <p className={`text-xl font-black ${c.value} tracking-tight`}>{value}</p>
        </div>
    );
}

function ProfileRow({ label, value, placeholder }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
            <span className="text-xs font-bold text-muted uppercase tracking-widest">{label}</span>
            <span className={`text-sm font-semibold ${value ? 'text-heading' : 'text-muted/50 italic'}`}>
                {value || placeholder || '—'}
            </span>
        </div>
    );
}

function ProfileField({ label, value, onChange, placeholder }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">{label}</label>
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-cream border border-black/10 text-heading rounded-lg focus:ring-lime focus:border-lime p-2.5 text-sm font-medium transition-colors"
            />
        </div>
    );
}
