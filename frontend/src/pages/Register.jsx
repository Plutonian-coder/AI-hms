import { useState } from 'react';
import apiClient from '../api/client';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Search, CheckCircle, Loader2, Building2, ArrowRight } from 'lucide-react';

export default function Register() {
    const [step, setStep] = useState('verify'); // 'verify' | 'form'
    const [matric, setMatric] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState('');
    const [studentInfo, setStudentInfo] = useState(null);

    const [formData, setFormData] = useState({
        password: '', email: '', phone: '', next_of_kin_name: '', next_of_kin_phone: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleVerifyMatric = async (e) => {
        e.preventDefault();
        setVerifyError('');
        setVerifying(true);
        try {
            const res = await apiClient.get(`/auth/verify-matric?matric=${encodeURIComponent(matric.trim())}`);
            setStudentInfo(res.data);
            setStep('form');
        } catch (err) {
            setVerifyError(err.response?.data?.detail || 'Matric number not found in session register. Contact Student Affairs.');
        } finally {
            setVerifying(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await apiClient.post('/auth/register', {
                identifier: matric.trim(),
                password: formData.password,
                email: formData.email || undefined,
                phone: formData.phone || undefined,
                next_of_kin_name: formData.next_of_kin_name || undefined,
                next_of_kin_phone: formData.next_of_kin_phone || undefined,
            });
            localStorage.setItem('access_token', res.data.access_token);
            localStorage.setItem('user', JSON.stringify(res.data));
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.detail || 'An error occurred during registration');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    return (
        <div
            className="min-h-screen flex items-center justify-center p-5 py-10"
            style={{ background: 'linear-gradient(135deg, #D8F3DC 0%, #E8F5EE 30%, #B7E4C7 60%, #D8F3DC 100%)' }}
        >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-forest/8 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-lime/10 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-lg animate-in zoom-in duration-300">
                <div className="glass-elevated rounded-3xl p-8 sm:p-10">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-7">
                        <div className="w-13 h-13 rounded-2xl bg-forest flex items-center justify-center shadow-lg mb-3">
                            <Building2 className="w-6 h-6 text-lime" />
                        </div>
                        <h1 className="text-2xl font-black text-heading tracking-tight">Student Registration</h1>
                        <p className="text-sm text-muted font-medium mt-1">
                            {step === 'verify' ? 'Verify your matric number to begin' : 'Complete your account setup'}
                        </p>
                    </div>

                    {/* Step 1: Matric verification */}
                    {step === 'verify' && (
                        <>
                            {verifyError && (
                                <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold text-center">
                                    {verifyError}
                                </div>
                            )}
                            <form onSubmit={handleVerifyMatric} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-muted uppercase tracking-widest">Matric Number</label>
                                    <input
                                        required
                                        className="glass-input w-full rounded-xl px-4 py-3 text-sm font-medium text-heading placeholder:text-muted-light"
                                        value={matric}
                                        onChange={e => setMatric(e.target.value)}
                                        placeholder="e.g. FPT/CSC/25/0130902"
                                    />
                                    <p className="text-xs text-muted font-medium">Must be on the current session register.</p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={verifying || !matric.trim()}
                                    className={`w-full flex items-center justify-center gap-2 bg-forest text-white rounded-xl px-5 py-3.5 text-sm font-bold shadow-lg shadow-forest/20 transition-all ${
                                        verifying ? 'opacity-70' : 'hover:bg-forest-hover hover:scale-[1.01]'
                                    }`}
                                >
                                    {verifying
                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                                        : <><Search className="w-4 h-4" /> Verify Matric Number</>
                                    }
                                </button>
                            </form>
                        </>
                    )}

                    {/* Step 2: Registration form */}
                    {step === 'form' && studentInfo && (
                        <>
                            {/* Verified badge */}
                            <div className="mb-5 px-4 py-3 rounded-xl bg-lime-soft border border-lime-border flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-forest shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-forest">Identity Verified</p>
                                    <p className="text-xs text-muted font-medium font-mono mt-0.5 truncate">{matric}</p>
                                </div>
                                <button onClick={() => { setStep('verify'); setStudentInfo(null); }} className="text-xs font-bold text-muted hover:text-heading transition-colors shrink-0">
                                    Change
                                </button>
                            </div>

                            {error && (
                                <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold text-center">
                                    {error}
                                </div>
                            )}

                            {/* Auto-populated read-only fields */}
                            <div className="mb-5 p-4 rounded-2xl bg-surface-2 border border-sidebar-border space-y-3">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-[0.15em]">From Session Register</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <InfoRow label="Surname" value={studentInfo.surname} />
                                    <InfoRow label="First Name" value={studentInfo.first_name} />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <InfoRow label="Gender" value={studentInfo.gender?.charAt(0).toUpperCase() + studentInfo.gender?.slice(1)} />
                                    <InfoRow label="Level" value={studentInfo.level} />
                                    <InfoRow label="Type" value={studentInfo.study_type} />
                                </div>
                                <InfoRow label="Department" value={studentInfo.department} />
                            </div>

                            <form onSubmit={handleRegister} className="space-y-4">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-[0.15em]">Your Details</p>

                                <div className="grid grid-cols-2 gap-3">
                                    <FormField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="student@email.com" />
                                    <FormField label="Phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="08012345678" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-muted uppercase tracking-widest">Password</label>
                                    <div className="relative">
                                        <input
                                            name="password" type={showPassword ? 'text' : 'password'} required
                                            className="glass-input w-full rounded-xl px-4 py-3 pr-11 text-sm font-medium text-heading placeholder:text-muted-light"
                                            value={formData.password} onChange={handleChange} placeholder="Min 8 characters"
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-light hover:text-muted transition-colors">
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <p className="text-[10px] font-bold text-muted uppercase tracking-[0.15em] pt-1">Next of Kin</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField label="Full Name" name="next_of_kin_name" value={formData.next_of_kin_name} onChange={handleChange} placeholder="Guardian name" />
                                    <FormField label="Phone" name="next_of_kin_phone" type="tel" value={formData.next_of_kin_phone} onChange={handleChange} placeholder="08012345678" />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full mt-2 flex items-center justify-center gap-2 bg-forest text-white rounded-xl px-5 py-3.5 text-sm font-bold shadow-lg shadow-forest/20 transition-all ${
                                        loading ? 'opacity-70 scale-[0.98]' : 'hover:bg-forest-hover hover:scale-[1.01]'
                                    }`}
                                >
                                    {loading ? 'Creating Account…' : <><ArrowRight className="w-4 h-4" /> Create Account</>}
                                </button>
                            </form>
                        </>
                    )}

                    <p className="text-center text-xs text-muted font-medium mt-6">
                        Already registered?{' '}
                        <Link to="/login" className="font-bold text-forest hover:text-forest-light transition-colors">Sign in</Link>
                    </p>
                </div>

                <p className="text-center text-[11px] text-muted/70 font-medium mt-5">
                    AI-Driven Hostel Management System · Federal University Oye-Ekiti
                </p>
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-heading">{value || '—'}</p>
        </div>
    );
}

function FormField({ label, name, type = 'text', value, onChange, placeholder }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-bold text-muted uppercase tracking-widest">{label}</label>
            <input
                name={name} type={type} value={value} onChange={onChange} placeholder={placeholder}
                className="glass-input w-full rounded-xl px-4 py-3 text-sm font-medium text-heading placeholder:text-muted-light"
            />
        </div>
    );
}
