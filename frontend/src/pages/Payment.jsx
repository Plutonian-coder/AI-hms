import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { CreditCard, ChevronRight, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Payment() {
    const navigate = useNavigate();
    const [hostels, setHostels] = useState([]);
    const [choices, setChoices] = useState([null, null, null]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [eligible, setEligible] = useState(false);
    const [allocated, setAllocated] = useState(false);

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

    const handleChoiceChange = (index, value) => {
        const newChoices = [...choices];
        newChoices[index] = value;
        setChoices(newChoices);
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
                                    Choice {num + 1}
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
                        <p className="text-muted text-sm">
                            You will be redirected to Paystack to complete your payment securely. After payment, you'll be automatically allocated a bed.
                        </p>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-full shadow-lg shadow-lime/25 text-base font-black text-forest bg-lime hover:bg-lime-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lime transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    Pay with Paystack
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
