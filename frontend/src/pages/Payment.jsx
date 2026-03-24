import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { CreditCard, ChevronRight, Loader2, AlertCircle, ShieldCheck, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Payment() {
    const navigate = useNavigate();
    const [hostels, setHostels] = useState([]);
    const [choices, setChoices] = useState([null, null, null]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState('');
    const [eligible, setEligible] = useState(false);
    const [allocated, setAllocated] = useState(false);
    const [pendingPayment, setPendingPayment] = useState(null);
    const [priceInfo, setPriceInfo] = useState(null);
    const [priceLoading, setPriceLoading] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                // Check eligibility
                const eligRes = await apiClient.get('/eligibility/status');
                if (!eligRes.data.is_eligible) {
                    setEligible(false);
                    setLoading(false);
                    return;
                }
                setEligible(true);

                // Check if already allocated
                const dashRes = await apiClient.get('/allocation/dashboard');
                if (dashRes.data.allocation) {
                    setAllocated(true);
                    setLoading(false);
                    return;
                }

                // Check for pending payment
                const payRes = await apiClient.get('/payment/status');
                if (payRes.data.has_pending) {
                    setPendingPayment(payRes.data);
                    setLoading(false);
                    return;
                }

                // Fetch hostels
                const hostRes = await apiClient.get('/allocation/hostels');
                setHostels(hostRes.data);
            } catch {
                setError('Failed to load data. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleChoiceChange = async (index, value) => {
        const newChoices = [...choices];
        newChoices[index] = value;
        setChoices(newChoices);

        // Fetch price when first choice is selected
        if (index === 0 && value) {
            setPriceLoading(true);
            try {
                const res = await apiClient.get(`/payment/price?hostel_id=${value}`);
                setPriceInfo(res.data);
            } catch {
                setPriceInfo(null);
            } finally {
                setPriceLoading(false);
            }
        }
    };

    const handleCancelPending = async () => {
        setCancelling(true);
        try {
            await apiClient.delete('/payment/cancel');
            setPendingPayment(null);
            // Fetch hostels now
            const hostRes = await apiClient.get('/allocation/hostels');
            setHostels(hostRes.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to cancel payment.');
        } finally {
            setCancelling(false);
        }
    };

    const handlePay = async (e) => {
        e.preventDefault();
        setError('');

        if (choices.includes(null)) {
            setError('Please select exactly 3 hostel choices.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await apiClient.post('/payment/initialize', {
                choice_1_id: parseInt(choices[0]),
                choice_2_id: parseInt(choices[1]),
                choice_3_id: parseInt(choices[2]),
            });

            // Redirect to Paystack checkout
            window.location.href = res.data.authorization_url;
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to initialize payment. Please try again.');
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-forest animate-spin" />
            </div>
        );
    }

    if (!eligible) {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-amber-800">Not Eligible</h3>
                        <p className="text-amber-700 text-sm mt-1">You need to verify your eligibility before making a payment.</p>
                        <button
                            onClick={() => navigate('/eligibility')}
                            className="mt-3 text-sm font-bold text-forest underline"
                        >
                            Go to Eligibility Verification
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (allocated) {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-lime/10 border border-lime/30 rounded-2xl p-6 flex items-start gap-4">
                    <ShieldCheck className="w-6 h-6 text-lime shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-forest">Already Allocated</h3>
                        <p className="text-forest/70 text-sm mt-1">You already have an active bed allocation for this session.</p>
                        <button
                            onClick={() => navigate('/my-allocation')}
                            className="mt-3 text-sm font-bold text-forest underline"
                        >
                            View My Allocation
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Pending payment recovery view
    if (pendingPayment) {
        const createdAt = pendingPayment.created_at ? new Date(pendingPayment.created_at) : null;
        const timeAgo = createdAt ? getTimeAgo(createdAt) : 'recently';

        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight flex items-center gap-3">
                        <Clock className="w-8 h-8 text-amber-500" />
                        Pending Payment
                    </h1>
                    <p className="text-muted mt-2 font-medium">You have an incomplete payment from {timeAgo}.</p>
                </div>

                <div className="mt-6 bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-amber-800 text-sm">Payment Not Completed</p>
                                <p className="text-amber-700 text-sm mt-1">
                                    A payment of <span className="font-bold">{'\u20A6'}{pendingPayment.amount?.toLocaleString()}</span> was
                                    initiated {timeAgo} but was not completed. You can either complete it via Paystack or cancel and start over.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between py-2 border-b border-black/5">
                            <span className="text-xs font-bold text-muted uppercase tracking-widest">Reference</span>
                            <span className="text-sm font-mono font-semibold text-heading">{pendingPayment.reference}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-black/5">
                            <span className="text-xs font-bold text-muted uppercase tracking-widest">Amount</span>
                            <span className="text-sm font-bold text-heading">{'\u20A6'}{pendingPayment.amount?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-black/5">
                            <span className="text-xs font-bold text-muted uppercase tracking-widest">Status</span>
                            <span className="text-sm font-bold text-amber-600 uppercase">Pending</span>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg font-medium mb-4">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => navigate(`/payment/callback?reference=${pendingPayment.reference}`)}
                            className="flex-1 flex justify-center items-center py-3.5 px-4 rounded-full shadow-lg shadow-lime/25 text-base font-black text-forest bg-lime hover:bg-lime-hover transition-all hover:scale-[1.02]"
                        >
                            <span className="flex items-center gap-2">
                                Verify Payment
                                <ChevronRight className="w-5 h-5" />
                            </span>
                        </button>

                        <button
                            onClick={handleCancelPending}
                            disabled={cancelling}
                            className="flex-1 flex justify-center items-center py-3.5 px-4 rounded-full border-2 border-red-200 text-base font-bold text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                        >
                            {cancelling ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    <XCircle className="w-5 h-5" />
                                    Cancel & Start Over
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl animate-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight flex items-center gap-3">
                    <CreditCard className="w-8 h-8 text-forest" />
                    Hostel Allocation Payment
                </h1>
                <p className="text-muted mt-2 font-medium">Select your hostel preferences and pay to secure your bed space.</p>
            </div>

            {/* Eligibility badge */}
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-lime/10 border border-lime/30 rounded-full">
                <ShieldCheck className="w-4 h-4 text-lime" />
                <span className="text-sm font-bold text-forest">Eligible</span>
            </div>

            <div className="mt-6 bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg font-medium mb-6">
                        {error}
                    </div>
                )}

                <form onSubmit={handlePay} className="space-y-8">
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-heading border-b border-black/5 pb-3 flex items-center gap-2">
                            <span className="bg-lime text-forest w-6 h-6 rounded-full flex items-center justify-center text-sm font-black">1</span>
                            Select Hostel Preferences
                        </h3>

                        {[0, 1, 2].map((num) => (
                            <div key={num} className="space-y-2">
                                <label className="block text-sm font-bold text-body uppercase tracking-widest">
                                    Choice {num + 1} {num === 0 && '(Primary)'}
                                </label>
                                <select
                                    required
                                    className="mt-1 block w-full rounded-xl border-black/10 shadow-sm focus:border-lime focus:ring-lime sm:text-lg bg-cream py-3 px-4 font-medium transition-colors hover:bg-white"
                                    value={choices[num] || ''}
                                    onChange={(e) => handleChoiceChange(num, e.target.value)}
                                >
                                    <option value="" disabled>Select a hostel...</option>
                                    {hostels.map((h) => (
                                        <option key={h.id} value={h.id} disabled={h.available === 0 && choices[num] != h.id}>
                                            {h.name} {h.available === 0 && '(Full)'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-heading border-b border-black/5 pb-3 flex items-center gap-2">
                            <span className="bg-forest text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-black">2</span>
                            Payment
                        </h3>

                        {/* Dynamic price display */}
                        {priceLoading ? (
                            <div className="flex items-center gap-2 text-muted text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" /> Fetching price...
                            </div>
                        ) : priceInfo ? (
                            <div className="bg-forest rounded-2xl p-5 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Hostel Fee</p>
                                    <p className="text-sm font-medium text-white/60 mt-1">{priceInfo.program_label} &mdash; {priceInfo.hostel_name}</p>
                                </div>
                                <p className="text-2xl font-black text-lime">{'\u20A6'}{priceInfo.amount?.toLocaleString()}</p>
                            </div>
                        ) : (
                            <p className="text-muted text-sm">
                                Select your primary hostel choice above to see the fee. You will be redirected to Paystack to complete your payment securely.
                            </p>
                        )}
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={submitting || !priceInfo}
                            className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-full shadow-lg shadow-lime/25 text-base font-black text-forest bg-lime hover:bg-lime-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lime transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    Pay {priceInfo ? `${'\u20A6'}${priceInfo.amount?.toLocaleString()}` : ''} with Paystack
                                    <ChevronRight className="w-5 h-5" />
                                </span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}
