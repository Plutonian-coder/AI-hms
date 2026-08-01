import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, Lock, Eye, EyeOff, Loader2, Check,
    Moon, Sun, Type, Shield, Activity,
    ToggleLeft, ToggleRight,
    AlertTriangle, FileText, ExternalLink, Server, Calendar,
    UserPlus
} from 'lucide-react';
import apiClient from '../../api/client';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../components/Toast';

/* ── Font options ─────────────────────────────────────────────────────────── */
const FONTS = [
    { key: 'inter',  label: 'Inter',     sub: 'Clean sans-serif · default',  preview: 'Aa', style: { fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif' } },
    { key: 'system', label: 'System UI', sub: 'Native OS font · Claude-like', preview: 'Aa', style: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' } },
    { key: 'serif',  label: 'Georgia',   sub: 'Classic serif',                preview: 'Aa', style: { fontFamily: '"Georgia", "Times New Roman", Times, serif' } },
    { key: 'mono',   label: 'Monospace', sub: 'JetBrains Mono · code-style',  preview: 'Aa', style: { fontFamily: '"JetBrains Mono", "Courier New", Courier, monospace' } },
];

/* ── Portal definitions ───────────────────────────────────────────────────── */
const PORTALS = [
    { key: 'application',     field: 'application_portal_open', label: 'Application Portal', sub: 'Allows students to submit hostel applications' },
    { key: 'payment',         field: 'payment_portal_open',      label: 'Payment Portal',      sub: 'Allows students to make fee payments' },
    { key: 'allocation',      field: 'allocation_portal_open',   label: 'Allocation Portal',   sub: 'Reveals room allocation results to students' },
    { key: 'register_import', field: 'register_import_open',     label: 'Register Import',     sub: 'Allows batch student register uploads' },
];

/* ── Utilities ────────────────────────────────────────────────────────────── */
function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function timeAgo(iso) {
    if (!iso) return '';
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

/* ── Main Component ──────────────────────────────────────────────────────── */
export default function AdminSettings() {
    const navigate = useNavigate();
    const { settings, set } = useSettings();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('account');

    const user = (() => {
        try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
    })();

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-350">
            {/* Back header */}
            <div className="flex items-center gap-3 mb-2">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-xl hover:bg-surface-2 text-muted hover:text-heading transition-colors"
                >
                    <ArrowLeft className="w-4.5 h-4.5" />
                </button>
                <div>
                    <h1 className="text-xl font-extrabold text-heading tracking-tight">Admin Settings</h1>
                    <p className="text-xs text-muted font-medium mt-0.5">{user.full_name} · Administrator</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar */}
                <div className="w-full md:w-56 shrink-0 space-y-1.5">
                    <TabButton id="account"    icon={Shield}   label="Account"    active={activeTab === 'account'}    onClick={setActiveTab} />
                    <TabButton id="system"     icon={Server}   label="System"     active={activeTab === 'system'}     onClick={setActiveTab} />
                    <TabButton id="appearance" icon={Moon}     label="Appearance" active={activeTab === 'appearance'} onClick={setActiveTab} />
                    <TabButton id="audit"      icon={Activity} label="Audit"      active={activeTab === 'audit'}      onClick={setActiveTab} />
                    {user.identifier === 'ADMIN001' && (
                        <TabButton id="admin-access" icon={UserPlus} label="Admin Access" active={activeTab === 'admin-access'} onClick={setActiveTab} />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {activeTab === 'account'    && <AccountTab    user={user} toast={toast} />}
                    {activeTab === 'system'     && <SystemTab     toast={toast} />}
                    {activeTab === 'appearance' && <AppearanceTab settings={settings} set={set} />}
                    {activeTab === 'audit'      && <AuditTab />}
                    {activeTab === 'admin-access' && user.identifier === 'ADMIN001' && <AdminAccessTab toast={toast} />}
                </div>
            </div>
        </div>
    );
}

/* ── Shared sub-components ───────────────────────────────────────────────── */
function TabButton({ id, icon: Icon, label, active, onClick }) {
    return (
        <button
            onClick={() => onClick(id)}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                active
                    ? 'bg-forest text-white shadow-md shadow-forest/20'
                    : 'text-muted hover:bg-surface-2 hover:text-heading'
            }`}
        >
            <Icon className={`w-4.5 h-4.5 ${active ? 'text-lime' : ''}`} />
            {label}
        </button>
    );
}

function Section({ title, children }) {
    return (
        <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-black/5 bg-surface-2/50">
                <p className="text-[10px] font-bold text-muted uppercase tracking-[0.18em]">{title}</p>
            </div>
            <div className="divide-y divide-black/5 bg-surface">{children}</div>
        </div>
    );
}

function SettingRow({ icon: Icon, label, sub, children }) {
    return (
        <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-heading">{label}</p>
                    <p className="text-xs text-muted">{sub}</p>
                </div>
            </div>
            {children}
        </div>
    );
}

function Toggle({ value, onChange, disabled }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={value}
            disabled={disabled}
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
            } ${value ? 'bg-forest' : 'bg-gray-200'}`}
        >
            <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                value ? 'translate-x-5.5' : 'translate-x-0.5'
            }`} />
        </button>
    );
}

function PasswordField({ label, value, onChange, visible, onToggle, placeholder }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest">{label}</label>
            <div className="relative">
                <input
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    required
                    className="glass-input w-full rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-heading placeholder:text-muted-light"
                />
                <button
                    type="button"
                    onClick={onToggle}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-light hover:text-muted transition-colors"
                >
                    {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}

/* ── Account Tab ─────────────────────────────────────────────────────────── */
function AccountTab({ user, toast }) {
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <Section title="Administrator Profile">
                <div className="p-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Full Name</label>
                            <p className="text-sm font-medium text-heading">{user.full_name || '—'}</p>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Role</label>
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-forest bg-lime-soft border border-lime-border px-2.5 py-1 rounded-lg">
                                <Shield className="w-3 h-3" /> Administrator
                            </span>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Admin ID</label>
                            <p className="text-sm font-medium text-heading font-mono">{user.identifier || '—'}</p>
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Change Password">
                <ChangePasswordForm toast={toast} />
            </Section>
        </div>
    );
}

function ChangePasswordForm({ toast }) {
    const [form, setForm]       = useState({ current: '', next: '', confirm: '' });
    const [show, setShow]       = useState({ current: false, next: false });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.next !== form.confirm) { toast.error('New passwords do not match'); return; }
        if (form.next.length < 8)       { toast.error('Password must be at least 8 characters'); return; }
        setLoading(true);
        try {
            await apiClient.post('/auth/change-password', { current_password: form.current, new_password: form.next });
            toast.success('Password changed successfully');
            setForm({ current: '', next: '', confirm: '' });
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="px-5 py-4">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-muted" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-heading">Change Password</p>
                    <p className="text-xs text-muted">Update your administrator account password</p>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <PasswordField
                    label="Current Password" value={form.current}
                    onChange={v => setForm(p => ({ ...p, current: v }))}
                    visible={show.current} onToggle={() => setShow(s => ({ ...s, current: !s.current }))}
                    placeholder="Enter current password"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PasswordField
                        label="New Password" value={form.next}
                        onChange={v => setForm(p => ({ ...p, next: v }))}
                        visible={show.next} onToggle={() => setShow(s => ({ ...s, next: !s.next }))}
                        placeholder="Min 8 characters"
                    />
                    <PasswordField
                        label="Confirm New Password" value={form.confirm}
                        onChange={v => setForm(p => ({ ...p, confirm: v }))}
                        visible={show.next} onToggle={() => setShow(s => ({ ...s, next: !s.next }))}
                        placeholder="Repeat new password"
                    />
                </div>
                <div className="pt-2 flex justify-end">
                    <button
                        type="submit"
                        disabled={loading || !form.current || !form.next || !form.confirm}
                        className={`flex items-center gap-2 bg-forest text-white rounded-xl px-6 py-2.5 text-sm font-bold shadow-md shadow-forest/15 transition-all ${
                            loading || !form.current || !form.next || !form.confirm
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-forest-hover'
                        }`}
                    >
                        {loading
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                            : <><Lock className="w-4 h-4" /> Update Password</>
                        }
                    </button>
                </div>
            </form>
        </div>
    );
}

/* ── System Tab ──────────────────────────────────────────────────────────── */
function SystemTab({ toast }) {
    const [session,         setSession]         = useState(null);
    const [loading,         setLoading]         = useState(true);
    const [togglingPortal,  setTogglingPortal]  = useState(null);
    const [deadlines,       setDeadlines]       = useState({ application: '', hostel: '' });
    const [savingDeadlines, setSavingDeadlines] = useState(false);

    const fetchSession = useCallback(() => {
        apiClient.get('/admin/session/status')
            .then(res => {
                setSession(res.data);
                if (res.data.status === 'active') {
                    setDeadlines({
                        application: res.data.application_fee_deadline
                            ? new Date(res.data.application_fee_deadline).toISOString().slice(0, 16) : '',
                        hostel: res.data.hostel_fee_deadline
                            ? new Date(res.data.hostel_fee_deadline).toISOString().slice(0, 16) : '',
                    });
                }
            })
            .catch(() => toast.error('Failed to load session data'))
            .finally(() => setLoading(false));
    }, [toast]);

    useEffect(() => { fetchSession(); }, [fetchSession]);

    const togglePortal = async (portalKey) => {
        setTogglingPortal(portalKey);
        try {
            const res = await apiClient.patch(`/admin/session/toggle/${portalKey}`);
            toast.success(res.data.message);
            await fetchSession();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to toggle portal');
        } finally {
            setTogglingPortal(null);
        }
    };

    const saveDeadlines = async () => {
        setSavingDeadlines(true);
        try {
            const payload = {};
            if (deadlines.application) payload.application_fee_deadline = new Date(deadlines.application).toISOString();
            if (deadlines.hostel)      payload.hostel_fee_deadline       = new Date(deadlines.hostel).toISOString();
            await apiClient.patch('/admin/session/deadlines', payload);
            toast.success('Deadlines updated successfully');
            fetchSession();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to update deadlines');
        } finally {
            setSavingDeadlines(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-muted">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm font-semibold">Loading system data…</p>
            </div>
        );
    }

    if (!session || session.status === 'none') {
        return (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <Section title="Active Session">
                    <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                        </div>
                        <p className="text-sm font-bold text-heading">No active session</p>
                        <p className="text-xs text-muted max-w-xs">Create a session from the Sessions page before managing system settings.</p>
                        <Link to="/admin/sessions" className="mt-1 text-xs font-bold text-forest hover:underline flex items-center gap-1">
                            Go to Sessions <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>
                </Section>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Session banner */}
            <Section title="Active Session">
                <div className="px-5 py-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-lime-soft border border-lime-border flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-forest" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-heading">{session.name}</p>
                        <p className="text-xs text-muted mt-0.5">{session.year_start} / {session.year_end} academic session</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Active</span>
                            <span className="text-[10px] text-muted ml-2">{session.register_count} registered students</span>
                        </div>
                    </div>
                </div>
            </Section>

            {/* Portal toggles */}
            <Section title="Portal Access Controls">
                {PORTALS.map(p => {
                    const isOpen   = session[p.field];
                    const toggling = togglingPortal === p.key;
                    const Icon     = isOpen ? ToggleRight : ToggleLeft;
                    return (
                        <SettingRow key={p.key} icon={Icon} label={p.label} sub={p.sub}>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isOpen ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {isOpen ? 'Open' : 'Closed'}
                                </span>
                                {toggling
                                    ? <Loader2 className="w-5 h-5 animate-spin text-muted" />
                                    : <Toggle value={isOpen} onChange={() => togglePortal(p.key)} />
                                }
                            </div>
                        </SettingRow>
                    );
                })}
            </Section>

            {/* Deadlines */}
            <Section title="Submission Deadlines">
                <div className="px-5 py-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest">
                                Application Fee Deadline
                            </label>
                            <input
                                type="datetime-local"
                                value={deadlines.application}
                                onChange={e => setDeadlines(d => ({ ...d, application: e.target.value }))}
                                className="glass-input w-full rounded-xl px-4 py-2.5 text-sm font-medium text-heading"
                            />
                            {session.application_fee_deadline && (
                                <p className="text-[10px] text-muted">Current: {fmtDate(session.application_fee_deadline)}</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest">
                                Hostel Fee Deadline
                            </label>
                            <input
                                type="datetime-local"
                                value={deadlines.hostel}
                                onChange={e => setDeadlines(d => ({ ...d, hostel: e.target.value }))}
                                className="glass-input w-full rounded-xl px-4 py-2.5 text-sm font-medium text-heading"
                            />
                            {session.hostel_fee_deadline && (
                                <p className="text-[10px] text-muted">Current: {fmtDate(session.hostel_fee_deadline)}</p>
                            )}
                        </div>
                    </div>
                    <div className="pt-1 flex justify-end">
                        <button
                            onClick={saveDeadlines}
                            disabled={savingDeadlines}
                            className="flex items-center gap-2 bg-forest text-white rounded-xl px-6 py-2.5 text-sm font-bold shadow-md shadow-forest/15 hover:bg-forest-hover transition-all disabled:opacity-50"
                        >
                            {savingDeadlines ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Save Deadlines
                        </button>
                    </div>
                </div>
            </Section>
        </div>
    );
}

/* ── Appearance Tab ──────────────────────────────────────────────────────── */
function AppearanceTab({ settings, set }) {
    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <Section title="Interface Settings">
                <SettingRow
                    icon={settings.darkMode ? Moon : Sun}
                    label="Dark Mode"
                    sub="Switch between light and dark theme"
                >
                    <Toggle value={settings.darkMode} onChange={v => set('darkMode', v)} />
                </SettingRow>

                <SettingRow
                    icon={Activity}
                    label="Reduced Motion"
                    sub="Minimize interface animations for accessibility"
                >
                    <Toggle value={settings.reducedMotion || false} onChange={v => set('reducedMotion', v)} />
                </SettingRow>

                <div className="px-5 py-4 border-t border-black/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                            <Type className="w-4 h-4 text-muted" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-heading">Font Typeface</p>
                            <p className="text-xs text-muted">Choose the primary interface font</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {FONTS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => set('font', f.key)}
                                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                                    settings.font === f.key
                                        ? 'bg-lime-soft border-lime-border shadow-sm shadow-lime/10'
                                        : 'bg-surface border-sidebar-border hover:bg-surface-2'
                                }`}
                            >
                                <span
                                    className="text-2xl font-bold text-heading leading-none mt-0.5 shrink-0 w-9 text-center"
                                    style={f.style}
                                >
                                    {f.preview}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-heading truncate">{f.label}</p>
                                    <p className="text-[10px] text-muted font-medium mt-0.5 leading-snug">{f.sub}</p>
                                </div>
                                {settings.font === f.key && <Check className="w-3.5 h-3.5 text-forest shrink-0 mt-0.5" />}
                            </button>
                        ))}
                    </div>
                    <div className="mt-4 p-4 rounded-xl bg-surface-2 border border-sidebar-border">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Live Preview</p>
                        <p
                            className="text-sm text-heading leading-relaxed"
                            style={FONTS.find(f => f.key === settings.font)?.style}
                        >
                            The quick brown fox jumps over the lazy dog. 1234567890.
                        </p>
                    </div>
                </div>
            </Section>
        </div>
    );
}

/* ── Audit Tab ───────────────────────────────────────────────────────────── */
function AuditTab() {
    const [logs,    setLogs]    = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get('/admin/audit-logs?limit=5')
            .then(res => setLogs(res.data.logs || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const actionColor = (type) => {
        if (!type) return 'text-muted bg-surface-2';
        const t = type.toUpperCase();
        if (t.includes('CREATED') || t.includes('ADDED'))  return 'text-emerald-700 bg-emerald-50';
        if (t.includes('DELETE')  || t.includes('REVOKE')) return 'text-red-600 bg-red-50';
        if (t.includes('TOGGLED') || t.includes('UPDATE')) return 'text-amber-700 bg-amber-50';
        if (t.includes('LOGIN'))                            return 'text-sky-700 bg-sky-50';
        return 'text-muted bg-surface-2';
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <Section title="Recent System Activity">
                {loading ? (
                    <div className="flex items-center justify-center p-10">
                        <Loader2 className="w-6 h-6 animate-spin text-muted" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                        <p className="text-sm text-muted font-medium">No audit events recorded yet.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-black/5">
                        {logs.map(log => (
                            <div key={log.id} className="px-5 py-3.5 flex items-start gap-3">
                                <span className={`mt-0.5 shrink-0 inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${actionColor(log.action_type)}`}>
                                    {log.action_type?.replace(/_/g, ' ') || 'EVENT'}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-heading leading-snug">{log.description}</p>
                                    <p className="text-[10px] text-muted mt-0.5">
                                        by <span className="font-semibold text-body">{log.actor_id}</span>
                                        {' · '}{timeAgo(log.timestamp)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="px-5 py-3 bg-surface-2/40 flex justify-end border-t border-black/5">
                    <Link
                        to="/admin/audit-logs"
                        className="flex items-center gap-1.5 text-xs font-bold text-forest hover:text-forest-hover transition-colors"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        View full audit trail
                        <ExternalLink className="w-3 h-3" />
                    </Link>
                </div>
            </Section>
        </div>
    );
}

/* ── Admin Access Tab ────────────────────────────────────────────────────── */
function AdminAccessTab({ toast }) {
    const [form, setForm] = useState({
        email: '',
        password: '',
        first_name: '',
        surname: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Admins listing state
    const [admins, setAdmins] = useState([]);
    const [adminsLoading, setAdminsLoading] = useState(true);
    const [revokingId, setRevokingId] = useState(null);

    const fetchAdmins = useCallback(() => {
        setAdminsLoading(true);
        apiClient.get('/admin/list-admins')
            .then(res => setAdmins(res.data.admins || []))
            .catch(() => toast.error('Failed to load administrator list.'))
            .finally(() => setAdminsLoading(false));
    }, [toast]);

    useEffect(() => {
        fetchAdmins();
    }, [fetchAdmins]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.email || !form.password) {
            toast.error('Email and Password are required.');
            return;
        }
        setLoading(true);
        try {
            const res = await apiClient.post('/admin/assign-admin', {
                email: form.email,
                password: form.password,
                first_name: form.first_name || null,
                surname: form.surname || null
            });
            toast.success(res.data.message || 'Administrator access assigned successfully.');
            setForm({
                email: '',
                password: '',
                first_name: '',
                surname: ''
            });
            fetchAdmins(); // Refresh the list
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to assign administrator access.');
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (id, email) => {
        if (!window.confirm(`Are you sure you want to revoke administrative access for ${email}?`)) {
            return;
        }
        setRevokingId(id);
        try {
            const res = await apiClient.post(`/admin/revoke-admin/${id}`);
            toast.success(res.data.message || 'Administrator access revoked.');
            fetchAdmins(); // Refresh the list
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to revoke administrator access.');
        } finally {
            setRevokingId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <Section title="Grant Administrator Access">
                <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-lime-soft border border-lime-border flex items-center justify-center">
                            <UserPlus className="w-4 h-4 text-forest" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-heading">Grant Administrator Role</p>
                            <p className="text-xs text-muted">Assign administrative privileges to a user. If the user already exists (e.g. as a student), their role will be updated to admin and their password updated. If the user does not exist, a new admin account will be created.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="admin.user@example.com"
                                    className="glass-input w-full rounded-xl px-4 py-2.5 text-sm font-medium text-heading"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest">
                                    Temporary/New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder="Min 8 characters"
                                        className="glass-input w-full rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-heading"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-light hover:text-muted transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest">
                                    First Name (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={form.first_name}
                                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                                    placeholder="First Name"
                                    className="glass-input w-full rounded-xl px-4 py-2.5 text-sm font-medium text-heading"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest">
                                    Surname (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={form.surname}
                                    onChange={e => setForm(f => ({ ...f, surname: e.target.value }))}
                                    placeholder="Surname"
                                    className="glass-input w-full rounded-xl px-4 py-2.5 text-sm font-medium text-heading"
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 bg-forest text-white rounded-xl px-6 py-2.5 text-sm font-bold shadow-md shadow-forest/15 hover:bg-forest-hover transition-all disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Grant Admin Access
                            </button>
                        </div>
                    </form>
                </div>
            </Section>

            {/* Admins list */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-black/5 flex items-center gap-2 bg-surface-2/50">
                    <Shield className="w-4 h-4 text-muted" />
                    <h3 className="text-sm font-bold text-heading">Administrative Users ({admins.length})</h3>
                </div>
                <div className="divide-y divide-black/5 bg-surface">
                    {adminsLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted" />
                        </div>
                    ) : admins.length === 0 ? (
                        <div className="py-8 text-center text-muted font-medium text-sm">No administrators found.</div>
                    ) : admins.map(adm => (
                        <div key={adm.id} className="p-5 flex items-center justify-between gap-4 hover:bg-surface-2/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-lime-soft border border-lime-border flex items-center justify-center shrink-0">
                                    <Shield className="w-4.5 h-4.5 text-forest" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-heading">{adm.surname} {adm.first_name}</p>
                                    <p className="text-xs text-muted font-mono">{adm.identifier} · {adm.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                                <span className="text-[10px] font-bold text-forest bg-lime-soft border border-lime-border px-2.5 py-1 rounded-lg uppercase tracking-wider">
                                    {adm.identifier === 'ADMIN001' ? 'Root Admin' : 'Admin'}
                                </span>
                                {adm.identifier !== 'ADMIN001' && (
                                    <button
                                        onClick={() => handleRevoke(adm.id, adm.email)}
                                        disabled={revokingId === adm.id}
                                        className="text-xs font-bold text-red-600 hover:text-red-800 transition-colors border border-red-200 bg-red-50 hover:bg-red-100/60 px-3 py-1.5 rounded-xl disabled:opacity-50"
                                    >
                                        {revokingId === adm.id ? 'Revoking...' : 'Revoke'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
