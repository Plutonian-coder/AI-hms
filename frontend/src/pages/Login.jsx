import { useState } from 'react';
import apiClient from '../api/client';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
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
        <div className="flex h-screen bg-cream items-center justify-center p-6">
            <div className="max-w-md w-full animate-in zoom-in-95 duration-300">
                <div className="bg-forest rounded-3xl shadow-2xl p-8 sm:p-10">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-black text-white tracking-tight">HMS</h2>
                        <p className="text-white/50 font-medium text-sm mt-2">Sign in to the Automated Hostel Allocation portal</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/15 border border-red-500/20 text-red-300 text-sm font-bold text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Matric No.</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-white/10 border border-white/10 text-white rounded-xl focus:ring-lime focus:border-lime block p-3.5 font-medium transition-colors placeholder:text-white/30"
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                placeholder="Ex. F/ND/..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Password</label>
                            <input
                                type="password"
                                required
                                className="w-full bg-white/10 border border-white/10 text-white rounded-xl focus:ring-lime focus:border-lime block p-3.5 font-medium transition-colors placeholder:text-white/30"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full text-forest bg-lime hover:bg-lime-hover focus:ring-4 focus:outline-none focus:ring-lime/30 font-black rounded-full text-lg px-5 py-4 text-center shadow-lg shadow-lime/25 transition-all ${loading ? 'opacity-70 scale-95' : 'hover:scale-[1.02]'}`}
                        >
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-sm font-medium text-white/40 text-center mt-8">
                        Don't have an account? <Link to="/register" className="text-lime hover:text-lime-hover font-bold tracking-tight">Register</Link>
                    </p>
                    <p className="text-sm font-medium text-white/30 text-center mt-3">
                        <Link to="/forgot-password" className="text-white/50 hover:text-white/70 font-semibold transition-colors">Forgot Password?</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
