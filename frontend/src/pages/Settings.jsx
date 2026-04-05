import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Lock, Eye, EyeOff, Loader2, Check,
    Moon, Sun, Type, Monitor
} from 'lucide-react';
import apiClient from '../api/client';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../components/Toast';

/* ── Font options ─────────────────────────────────────────────────────────── */
const FONTS = [
    {
        key: 'inter',
        label: 'Inter',
        sub: 'Clean sans-serif · default',
        preview: 'Aa',
        style: { fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif' },
    },
    {
        key: 'system',
        label: 'System UI',
        sub: 'Native OS font · Claude-like',
        preview: 'Aa',
        style: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' },
    },
    {
        key: 'serif',
        label: 'Georgia',
        sub: 'Classic serif · Times New Roman fallback',
        preview: 'Aa',
        style: { fontFamily: '"Georgia", "Times New Roman", Times, serif' },
    },
    {
        key: 'mono',
        label: 'Monospace',
        sub: 'JetBrains Mono · code-style',
        preview: 'Aa',
        style: { fontFamily: '"JetBrains Mono", "Courier New", Courier, monospace' },
    },
];

/* ── Main component ──────────────────────────────────────────────────────── */
export default function Settings() {
    const navigate = useNavigate();
    const { settings, set } = useSettings();
    const toast = useToast();

    const user = (() => {
        try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
    })();

    return (
        <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-350">
            {/* Back header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 rounded-xl hover:bg-surface-2 text-muted hover:text-heading transition-colors"
                >
                    <ArrowLeft className="w-4.5 h-4.5" />
                </button>
                <div>
                    <h1 className="text-xl font-extrabold text-heading tracking-tight">Settings</h1>
                    <p className="text-xs text-muted font-medium mt-0.5">{user.full_name} · {user.identifier}</p>
                </div>
            </div>

            {/* ── Appearance ─────────────────────────────────────────────── */}
            <Section title="Appearance">
                {/* Dark mode */}
                <SettingRow
                    icon={settings.darkMode ? Moon : Sun}
                    label="Dark Mode"
                    sub="Switch between light and dark theme"
                >
                    <Toggle
                        value={settings.darkMode}
                        onChange={v => set('darkMode', v)}
                    />
                </SettingRow>

                {/* Font */}
                <div className="px-5 py-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                            <Type className="w-4 h-4 text-muted" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-heading">Font</p>
                            <p className="text-xs text-muted">Choose the interface typeface</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {FONTS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => set('font', f.key)}
                                className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                                    settings.font === f.key
                                        ? 'bg-lime-soft border-lime-border'
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
                                {settings.font === f.key && (
                                    <Check className="w-3.5 h-3.5 text-forest shrink-0 mt-0.5" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Live preview */}
                    <div className="mt-3 p-3.5 rounded-xl bg-surface-2 border border-sidebar-border">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Preview</p>
                        <p
                            className="text-sm text-heading leading-relaxed"
                            style={FONTS.find(f => f.key === settings.font)?.style}
                        >
                            The quick brown fox jumps over the lazy dog. 1234567890.
                        </p>
                    </div>
                </div>
            </Section>

            {/* ── Security ───────────────────────────────────────────────── */}
            <Section title="Security">
                <ChangePasswordForm user={user} toast={toast} />
            </Section>
        </div>
    );
}

/* ── Change Password form ────────────────────────────────────────────────── */
function ChangePasswordForm({ user, toast }) {
    const [form, setForm] = useState({ current: '', next: '', confirm: '' });
    const [show, setShow] = useState({ current: false, next: false });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleChange = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.next !== form.confirm) {
            toast.error('New passwords do not match');
            return;
        }
        if (form.next.length < 8) {
            toast.error('New password must be at least 8 characters');
            return;
        }
        setLoading(true);
        try {
            await apiClient.post('/auth/change-password', {
                current_password: form.current,
                new_password: form.next,
            });
            setSuccess(true);
            setForm({ current: '', next: '', confirm: '' });
            toast.success('Password changed successfully');
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
                    <p className="text-xs text-muted">Update your account password</p>
                </div>
            </div>

            {success && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                    <Check className="w-4 h-4 shrink-0" />
                    <p className="text-sm font-semibold">Password updated successfully.</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
                <PasswordField
                    label="Current Password"
                    value={form.current}
                    onChange={v => handleChange('current', v)}
                    visible={show.current}
                    onToggle={() => setShow(s => ({ ...s, current: !s.current }))}
                    placeholder="Enter current password"
                />
                <PasswordField
                    label="New Password"
                    value={form.next}
                    onChange={v => handleChange('next', v)}
                    visible={show.next}
                    onToggle={() => setShow(s => ({ ...s, next: !s.next }))}
                    placeholder="Min 8 characters"
                />
                <PasswordField
                    label="Confirm New Password"
                    value={form.confirm}
                    onChange={v => handleChange('confirm', v)}
                    visible={show.next}
                    onToggle={() => setShow(s => ({ ...s, next: !s.next }))}
                    placeholder="Repeat new password"
                />

                {/* Strength indicator */}
                {form.next && (
                    <StrengthBar password={form.next} />
                )}

                <button
                    type="submit"
                    disabled={loading || !form.current || !form.next || !form.confirm}
                    className={`w-full flex items-center justify-center gap-2 bg-forest text-white rounded-xl px-5 py-3 text-sm font-bold shadow-md shadow-forest/15 transition-all ${
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
            </form>
        </div>
    );
}

/* ── Password strength bar ───────────────────────────────────────────────── */
function StrengthBar({ password }) {
    let score = 0;
    if (password.length >= 8)  score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
        { label: 'Weak',   color: 'bg-red-400' },
        { label: 'Fair',   color: 'bg-amber-400' },
        { label: 'Fair',   color: 'bg-amber-400' },
        { label: 'Good',   color: 'bg-emerald-400' },
        { label: 'Strong', color: 'bg-emerald-500' },
        { label: 'Strong', color: 'bg-emerald-500' },
    ];
    const { label, color } = levels[score] ?? levels[0];

    return (
        <div className="space-y-1.5">
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                    <div
                        key={i}
                        className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                            i <= score ? color : 'bg-surface-2'
                        }`}
                    />
                ))}
            </div>
            <p className={`text-[10px] font-bold ${
                score <= 1 ? 'text-red-500' : score <= 2 ? 'text-amber-500' : 'text-emerald-600'
            }`}>{label}</p>
        </div>
    );
}

/* ── Reusable sub-components ─────────────────────────────────────────────── */
function Section({ title, children }) {
    return (
        <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-black/5">
                <p className="text-[10px] font-bold text-muted uppercase tracking-[0.18em]">{title}</p>
            </div>
            <div className="divide-y divide-black/5">
                {children}
            </div>
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

function Toggle({ value, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={value}
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                value ? 'bg-forest' : 'bg-gray-200'
            }`}
        >
            <span
                className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    value ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
            />
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
