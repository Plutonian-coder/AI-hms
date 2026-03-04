import { useState } from 'react';
import apiClient from '../api/client';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function ForgotPassword() {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const toast = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!identifier.trim()) return;
        setLoading(true);

        try {
            await apiClient.post('/auth/forgot-password', { identifier: identifier.trim() });
            setSent(true);
            toast.success('Reset instructions sent if the account exists.');
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-cream items-center justify-center p-6">
            <div className="max-w-md w-full animate-in zoom-in-95 duration-300">
                <div className="bg-forest rounded-3xl shadow-2xl p-8 sm:p-10">
                    <div className="text-center mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-lime/15 flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-7 h-7 text-lime" />
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">
                            {sent ? 'Check Your Email' : 'Forgot Password'}
                        </h2>
                        <p className="text-white/50 font-medium text-sm mt-2 max-w-xs mx-auto">
                            {sent
                                ? 'If an account exists with that matric number, we\'ve sent password reset instructions.'
                                : 'Enter your matric number and we\'ll send you a password reset link.'
                            }
                        </p>
                    </div>

                    {!sent ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                                    Matric Number
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-white/10 border border-white/10 text-white rounded-xl focus:ring-lime focus:border-lime block p-3.5 font-medium transition-colors placeholder:text-white/30"
                                    value={identifier}
                                    onChange={e => setIdentifier(e.target.value)}
                                    placeholder="Ex. F/ND/..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full text-forest bg-lime hover:bg-lime-hover focus:ring-4 focus:outline-none focus:ring-lime/30 font-black rounded-full text-lg px-5 py-4 text-center shadow-lg shadow-lime/25 transition-all ${loading ? 'opacity-70 scale-95' : 'hover:scale-[1.02]'}`}
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <button
                                onClick={() => { setSent(false); setIdentifier(''); }}
                                className="w-full text-white/60 bg-white/10 hover:bg-white/15 font-bold rounded-full text-base px-5 py-4 text-center transition-all"
                            >
                                Try Another Matric Number
                            </button>
                        </div>
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
