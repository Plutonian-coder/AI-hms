import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { CreditCard, ChevronRight, Loader2, AlertCircle, ShieldCheck, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Payment() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [paymentStatus, setPaymentStatus] = useState(null); // null | { status, hms_reference, amount }
    const [feeSummary, setFeeSummary] = useState(null);
    const [noApplication, setNoApplication] = useState(false);
    const [allocated, setAllocated] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                // Check payment status first
                const payRes = await apiClient.get('/payment/status');
                if (payRes.data.has_payment) {
                    setPaymentStatus(payRes.data);
                    if (payRes.data.status === 'confirmed') {
                        setLoading(false);
                        return;
                    }
                }

                // Check if already allocated
                const dashRes = await apiClient.get('/allocation/dashboard');
                if (dashRes.data.progress?.allocated) {
                    setAllocated(true);
                    setLoading(false);
                    return;
                }

                // Check application exists
                if (!dashRes.data.progress?.applied) {
                    setNoApplication(true);
                    setLoading(false);
                    return;
                }

                // Get fee summary
                const feeRes = await apiClient.get('/application/fee-summary');
                setFeeSummary(feeRes.data);
            } catch {
                setError('Failed to load payment data.');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handlePay = async () => {
        setError('');
        setSubmitting(true);
        try {
            const res = await apiClient.post('/payment/initialize');
            window.location.href = res.data.authorization_url;
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to initialize payment.');
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

    if (allocated) {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-lime/10 border border-lime/30 rounded-2xl p-6 flex items-start gap-4">
                    <ShieldCheck className="w-6 h-6 text-lime shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-forest">Already Allocated</h3>
                        <p className="text-forest/70 text-sm mt-1">You already have an active bed allocation for this session.</p>
                        <button onClick={() => navigate('/my-allocation')} className="mt-3 text-sm font-bold text-forest underline">
                            View My Allocation
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (noApplication) {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-amber-800">Application Required</h3>
                        <p className="text-amber-700 text-sm mt-1">You need to submit a hostel application before making payment.</p>
                        <button onClick={() => navigate('/apply')} className="mt-3 text-sm font-bold text-forest underline">
                            Submit Application
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Already paid and confirmed
    if (paymentStatus?.status === 'confirmed') {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight flex items-center gap-3">
                        <CreditCard className="w-8 h-8 text-forest" />
                        Payment
                    </h1>
                </div>

                <div className="mt-6 bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                    <div className="flex items-start gap-4 p-5 rounded-2xl bg-lime/5 border border-lime/20">
                        <CheckCircle className="w-6 h-6 text-lime shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-forest">Payment Confirmed</h3>
                            <p className="text-forest/70 text-sm mt-1">
                                HMS Reference: <span className="font-mono font-bold">{paymentStatus.hms_reference}</span>
                            </p>
                            <p className="text-forest/70 text-sm">
                                Amount: <span className="font-bold">{'\u20A6'}{paymentStatus.amount?.toLocaleString()}</span>
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => navigate('/receipt')}
                            className="flex-1 flex items-center justify-center gap-2 bg-forest text-white px-5 py-3 rounded-full font-bold hover:bg-forest-light transition-colors"
                        >
                            View Receipt
                        </button>
                        <button
                            onClick={() => navigate('/quiz')}
                            className="flex-1 flex items-center justify-center gap-2 bg-lime text-forest px-5 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all"
                        >
                            Take Compatibility Quiz <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Pending payment — allow re-verify
    if (paymentStatus?.status === 'pending') {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight flex items-center gap-3">
                        <CreditCard className="w-8 h-8 text-forest" />
                        Pending Payment
                    </h1>
                    <p className="text-muted mt-2 font-medium">You have an incomplete payment.</p>
                </div>

                <div className="mt-6 bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between py-2 border-b border-black/5">
                            <span className="text-xs font-bold text-muted uppercase tracking-widest">Reference</span>
                            <span className="text-sm font-mono font-semibold text-heading">{paymentStatus.reference}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-black/5">
                            <span className="text-xs font-bold text-muted uppercase tracking-widest">Amount</span>
                            <span className="text-sm font-bold text-heading">{'\u20A6'}{paymentStatus.amount?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-black/5">
                            <span className="text-xs font-bold text-muted uppercase tracking-widest">HMS Reference</span>
                            <span className="text-sm font-mono font-bold text-heading">{paymentStatus.hms_reference}</span>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg font-medium mb-4">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={() => navigate(`/payment/callback?reference=${paymentStatus.reference}`)}
                        className="w-full flex justify-center items-center py-3.5 px-4 rounded-full shadow-lg shadow-lime/25 text-base font-black text-forest bg-lime hover:bg-lime-hover transition-all hover:scale-[1.02]"
                    >
                        Verify Payment <ChevronRight className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>
        );
    }

    // Fresh payment — show fee breakdown and pay button
    return (
        <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight flex items-center gap-3">
                    <CreditCard className="w-8 h-8 text-forest" />
                    Hostel Fee Payment
                </h1>
                <p className="text-muted mt-2 font-medium">Review your fee breakdown and pay securely via Paystack.</p>
            </div>

            <div className="mt-6 bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl font-medium mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                {feeSummary && (
                    <div className="space-y-6">
                        <div className="bg-forest rounded-2xl p-6 space-y-3">
                            <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Fee Breakdown</p>
                            {feeSummary.components?.map((comp, i) => (
                                <div key={i} className="flex items-center justify-between py-1">
                                    <span className="text-white/70 text-sm font-medium">{comp.name}</span>
                                    <span className="text-white font-bold">{'\u20A6'}{comp.amount?.toLocaleString()}</span>
                                </div>
                            ))}
                            <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                                <span className="text-white/80 font-bold text-sm">Total Hostel Fee</span>
                                <span className="text-3xl font-black text-lime">{'\u20A6'}{feeSummary.total?.toLocaleString()}</span>
                            </div>
                            <p className="text-white/30 text-xs font-medium">Study type: {feeSummary.study_type}</p>
                        </div>

                        <button
                            onClick={handlePay}
                            disabled={submitting}
                            className={`w-full flex justify-center items-center py-4 px-4 rounded-full shadow-lg shadow-lime/25 text-base font-black text-forest bg-lime hover:bg-lime-hover transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100`}
                        >
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    Pay {'\u20A6'}{feeSummary.total?.toLocaleString()} with Paystack
                                    <ChevronRight className="w-5 h-5" />
                                </span>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
