import { useState } from 'react';
import apiClient from '../api/client';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const toast = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) return;
        setLoading(true);

        try {
            await apiClient.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
            setSent(true);
            toast.success('Password reset link sent to your email!');
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
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${sent ? 'bg-lime/20' : 'bg-lime/15'}`}>
                            {sent ? <CheckCircle className="w-7 h-7 text-lime" /> : <Mail className="w-7 h-7 text-lime" />}
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight">
                            {sent ? 'Check Your Inbox' : 'Forgot Password'}
                        </h2>
                        <p className="text-white/50 font-medium text-sm mt-2 max-w-xs mx-auto">
                            {sent
                                ? `We've sent a password reset link to your registered Gmail. Check your inbox and spam folder.`
                                : 'Enter the Gmail address you registered with on HMS. The reset link will be sent to that email only.'
                            }
                        </p>
                    </div>

                    {!sent ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                                    Registered Gmail Address
                                </label>
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-white/10 border border-white/10 text-white rounded-xl focus:ring-lime focus:border-lime block p-3.5 font-medium transition-colors placeholder:text-white/30"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="youremail@gmail.com"
                                    autoComplete="email"
                                />
                                <p className="text-white/30 text-[11px] font-medium mt-2">
                                    Must be the same @gmail.com address from your HMS account.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full text-forest bg-lime hover:bg-lime-hover focus:ring-4 focus:outline-none focus:ring-lime/30 font-black rounded-full text-lg px-5 py-4 text-center shadow-lg shadow-lime/25 transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-70 scale-95' : 'hover:scale-[1.02]'}`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Sending...
                                    </>
                                ) : 'Send Reset Link'}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-lime/10 border border-lime/20 rounded-2xl p-5 text-center space-y-2">
                                <p className="text-white/80 text-sm font-semibold">Sent to</p>
                                <p className="text-lime font-bold text-base">{email}</p>
                                <p className="text-white/40 text-xs font-medium">Link expires in <strong className="text-lime">15 minutes</strong></p>
                            </div>
                            <button
                                onClick={() => { setSent(false); setEmail(''); }}
                                className="w-full text-white/60 bg-white/10 hover:bg-white/15 font-bold rounded-full text-base px-5 py-4 text-center transition-all"
                            >
                                Try Another Email
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
