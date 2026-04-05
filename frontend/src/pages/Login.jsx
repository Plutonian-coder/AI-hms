import { useState } from 'react';
import apiClient from '../api/client';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Building2, ArrowRight } from 'lucide-react';

export default function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await apiClient.post('/auth/login', { identifier, password });
            localStorage.setItem('access_token', res.data.access_token);
            localStorage.setItem('user', JSON.stringify(res.data));
            navigate(res.data.role === 'admin' ? '/admin' : '/');
        } catch (err) {
            setError(err.response?.data?.detail || 'Invalid login credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center p-5"
            style={{ background: 'linear-gradient(135deg, #D8F3DC 0%, #E8F5EE 30%, #B7E4C7 60%, #D8F3DC 100%)' }}
        >
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-forest/8 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-lime/10 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md animate-in zoom-in duration-300">
                {/* Card */}
                <div className="glass-elevated rounded-3xl p-8 sm:p-10">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-forest flex items-center justify-center shadow-lg mb-4">
                            <Building2 className="w-7 h-7 text-lime" />
                        </div>
                        <h1 className="text-2xl font-black text-heading tracking-tight">Hostel Management</h1>
                        <p className="text-sm text-muted font-medium mt-1">Sign in to your portal</p>
                    </div>

                    {error && (
                        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-muted uppercase tracking-widest">
                                Matric Number / Admin ID
                            </label>
                            <input
                                type="text"
                                required
                                className="glass-input w-full rounded-xl px-4 py-3 text-sm font-medium text-heading placeholder:text-muted-light"
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                placeholder="e.g. FPT/CSC/25/..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-muted uppercase tracking-widest">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="glass-input w-full rounded-xl px-4 py-3 pr-11 text-sm font-medium text-heading placeholder:text-muted-light"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-light hover:text-muted transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Link to="/forgot-password" className="text-xs font-semibold text-forest hover:text-forest-light transition-colors">
                                Forgot password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full flex items-center justify-center gap-2 bg-forest text-white rounded-xl px-5 py-3.5 text-sm font-bold shadow-lg shadow-forest/20 transition-all ${
                                loading ? 'opacity-70 scale-[0.98]' : 'hover:bg-forest-hover hover:scale-[1.01] hover:shadow-forest/30'
                            }`}
                        >
                            {loading ? 'Signing in…' : (
                                <>Sign In <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-xs text-muted font-medium mt-6">
                        New student?{' '}
                        <Link to="/register" className="font-bold text-forest hover:text-forest-light transition-colors">
                            Register here
                        </Link>
                    </p>
                </div>

                <p className="text-center text-[11px] text-muted/70 font-medium mt-5">
                    AI-Driven Hostel Management System · Federal University Oye-Ekiti
                </p>
            </div>
        </div>
    );
}
