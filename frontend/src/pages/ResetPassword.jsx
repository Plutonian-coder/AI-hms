import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, CheckCircle, Eye, EyeOff, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const toast = useToast();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(5);

    // Auto-redirect countdown after successful reset
    useEffect(() => {
        if (!success) return;
        if (countdown <= 0) {
            navigate('/login');
            return;
        }
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [success, countdown, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            const res = await apiClient.post('/auth/reset-password', {
                token,
                new_password: password,
            });
            setSuccess(true);
            toast.success(res.data?.message || 'Password reset successfully!');
        } catch (err) {
            const detail = err.response?.data?.detail || 'Failed to reset password. The link may have expired.';
            setError(detail);
            toast.error(detail);
        } finally {
            setLoading(false);
        }
    };

    // No token in URL — invalid access
    if (!token) {
        return (
            <div className="flex h-screen bg-cream items-center justify-center p-6">
                <div className="max-w-md w-full animate-in zoom-in-95 duration-300">
                    <div className="bg-forest rounded-3xl shadow-2xl p-8 sm:p-10 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-7 h-7 text-red-400" />
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Invalid Reset Link</h2>
                        <p className="text-white/50 font-medium text-sm mt-2">
                            This password reset link is invalid or has expired. Please request a new one.
                        </p>
                        <Link
                            to="/forgot-password"
                            className="inline-block mt-6 text-forest bg-lime hover:bg-lime-hover font-black rounded-full text-base px-8 py-3.5 shadow-lg shadow-lime/25 transition-all hover:scale-[1.02]"
                        >
                            Request New Reset Link
                        </Link>
                        <p className="text-sm font-medium text-white/40 mt-6">
                            <Link to="/login" className="text-lime hover:text-lime-hover font-bold inline-flex items-center gap-1">
                                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-cream items-center justify-center p-6">
            <div className="max-w-md w-full animate-in zoom-in-95 duration-300">
                <div className="bg-forest rounded-3xl shadow-2xl p-8 sm:p-10">
                    <div className="text-center mb-8">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors ${success ? 'bg-lime/20' : 'bg-lime/15'}`}>
                            {success ? (
                                <ShieldCheck className="w-7 h-7 text-lime animate-in zoom-in-50 duration-300" />
                            ) : (
                                <KeyRound className="w-7 h-7 text-lime" />
                            )}
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">
                            {success ? 'Password Updated!' : 'Set New Password'}
                        </h2>
                        <p className="text-white/50 font-medium text-sm mt-2 max-w-xs mx-auto">
                            {success
                                ? 'Your password has been changed successfully. You can now sign in with your new password.'
                                : 'Create a new password for your FUOYE Hostel Portal account. Must be at least 8 characters.'
                            }
                        </p>
                    </div>

                    {success ? (
                        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                            <div className="bg-lime/10 border border-lime/20 rounded-2xl p-5 text-center space-y-2">
                                <CheckCircle className="w-8 h-8 text-lime mx-auto" />
                                <p className="text-white/80 text-sm font-semibold">Password changed instantly</p>
                                <p className="text-white/40 text-xs font-medium">
                                    Redirecting to login in <strong className="text-lime">{countdown}s</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full text-forest bg-lime hover:bg-lime-hover focus:ring-4 focus:outline-none focus:ring-lime/30 font-black rounded-full text-lg px-5 py-4 text-center shadow-lg shadow-lime/25 transition-all hover:scale-[1.02]"
                            >
                                Sign In Now →
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-2 animate-in slide-in-from-top-2 duration-200">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                                    New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        className="w-full bg-white/10 border border-white/10 text-white rounded-xl focus:ring-lime focus:border-lime block p-3.5 pr-12 font-medium transition-colors placeholder:text-white/30"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Minimum 8 characters"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                                    Confirm Password
                                </label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    minLength={8}
                                    className="w-full bg-white/10 border border-white/10 text-white rounded-xl focus:ring-lime focus:border-lime block p-3.5 font-medium transition-colors placeholder:text-white/30"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter your new password"
                                    autoComplete="new-password"
                                />
                            </div>

                            {/* Password strength indicator */}
                            {password.length > 0 && (
                                <div className="flex items-center gap-2 animate-in fade-in duration-200">
                                    <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${password.length >= 8 ? 'bg-lime' : 'bg-white/10'}`} />
                                    <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${password.length >= 10 ? 'bg-lime' : 'bg-white/10'}`} />
                                    <div className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${password.length >= 12 ? 'bg-lime' : 'bg-white/10'}`} />
                                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">
                                        {password.length < 8 ? 'Weak' : password.length < 10 ? 'Good' : password.length < 12 ? 'Strong' : 'Excellent'}
                                    </span>
                                </div>
                            )}

                            {/* Match indicator */}
                            {confirmPassword.length > 0 && (
                                <div className={`flex items-center gap-2 text-xs font-medium animate-in fade-in duration-200 ${password === confirmPassword ? 'text-lime' : 'text-red-400'}`}>
                                    {password === confirmPassword ? (
                                        <><CheckCircle className="w-3.5 h-3.5" /> Passwords match</>
                                    ) : (
                                        <><AlertCircle className="w-3.5 h-3.5" /> Passwords do not match</>
                                    )}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || password.length < 8 || password !== confirmPassword}
                                className={`w-full text-forest bg-lime hover:bg-lime-hover focus:ring-4 focus:outline-none focus:ring-lime/30 font-black rounded-full text-lg px-5 py-4 text-center shadow-lg shadow-lime/25 transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-70 scale-95' : password.length >= 8 && password === confirmPassword ? 'hover:scale-[1.02]' : 'opacity-50 cursor-not-allowed'}`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Resetting...
                                    </>
                                ) : 'Reset Password'}
                            </button>
                        </form>
                    )}

                    <p className="text-sm font-medium text-white/40 text-center mt-8">
                        <Link to="/login" className="text-lime hover:text-lime-hover font-bold tracking-tight inline-flex items-center gap-1">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
