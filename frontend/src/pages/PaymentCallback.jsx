import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, RotateCcw, ArrowRight } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function PaymentCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const reference = searchParams.get('reference') || searchParams.get('trxref');

    const [steps, setSteps] = useState([]);
    const [pipelineError, setPipelineError] = useState(null);
    const [pipelineSuccess, setPipelineSuccess] = useState(false);
    const [started, setStarted] = useState(false);

    const verify = useCallback(async () => {
        if (!reference || started) return;
        setStarted(true);

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_BASE}/payment/verify/${reference}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
                const err = await response.json().catch(() => ({ detail: 'Server error' }));
                setPipelineError({ step: 0, title: 'Verification Failed', detail: err.detail || 'Could not verify payment' });
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let currentEvent = null;
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ') && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (currentEvent === 'step') {
                                setSteps(prev => {
                                    const updated = [...prev];
                                    const idx = updated.findIndex(s => s.step === data.step);
                                    if (idx >= 0) updated[idx] = data;
                                    else updated.push(data);
                                    return updated;
                                });
                            } else if (currentEvent === 'error') {
                                setPipelineError(data);
                            } else if (currentEvent === 'result') {
                                setPipelineSuccess(true);
                            }
                        } catch { /* skip */ }
                        currentEvent = null;
                    }
                }
            }
        } catch {
            setPipelineError({ step: 0, title: 'Network Error', detail: 'Failed to connect to the server.' });
        }
    }, [reference, started]);

    useEffect(() => { verify(); }, [verify]);

    if (!reference) {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
                    <XCircle className="w-6 h-6 text-red-600 shrink-0" />
                    <div>
                        <h3 className="font-bold text-red-800">No Payment Reference</h3>
                        <p className="text-red-600 text-sm mt-1">No payment reference was found. Please try again from the payment page.</p>
                        <button onClick={() => navigate('/payment')} className="mt-3 text-sm font-bold text-forest underline">
                            Back to Payment
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight">Payment Verification</h1>
                <p className="text-muted mt-2 font-medium">Verifying your payment and allocating your bed space...</p>
            </div>

            <div className="mt-8 bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                <div className="space-y-1">
                    {steps.map((step, i) => {
                        const isFailed = pipelineError && pipelineError.step === step.step;
                        const isProcessing = step.status === 'processing' && !isFailed;
                        const isComplete = step.status === 'complete' && !isFailed;

                        return (
                            <div key={step.step} className="relative">
                                {i < steps.length - 1 && (
                                    <div className={`absolute left-5 top-12 w-0.5 h-6 ${isComplete ? 'bg-lime/30' : isFailed ? 'bg-red-200' : 'bg-black/5'}`} />
                                )}
                                <div className={`flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 ${
                                    isFailed ? 'bg-red-50 border border-red-100' :
                                    isProcessing ? 'bg-forest/5 border border-forest/10' :
                                    isComplete ? 'bg-lime/5 border border-lime/20' :
                                    'bg-cream border border-black/5'
                                }`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                        isFailed ? 'bg-red-100' : isProcessing ? 'bg-forest/10' : isComplete ? 'bg-lime/20' : 'bg-black/5'
                                    }`}>
                                        {isFailed && <XCircle className="w-5 h-5 text-red-600" />}
                                        {isProcessing && <Loader2 className="w-5 h-5 text-forest animate-spin" />}
                                        {isComplete && <CheckCircle className="w-5 h-5 text-lime" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-bold text-muted uppercase tracking-widest">Step {step.step}/{step.total}</span>
                                        <h3 className={`font-bold text-base mt-0.5 ${isFailed ? 'text-red-800' : isProcessing ? 'text-forest' : 'text-heading'}`}>{step.title}</h3>
                                        <p className={`text-sm mt-1 font-medium ${isFailed ? 'text-red-600' : isProcessing ? 'text-forest/70' : 'text-muted'}`}>
                                            {isFailed ? pipelineError.detail : step.detail}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {steps.length === 0 && !pipelineError && (
                        <div className="flex items-center gap-4 p-4 bg-forest/5 rounded-2xl border border-forest/10">
                            <div className="w-10 h-10 rounded-xl bg-forest/10 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 text-forest animate-spin" />
                            </div>
                            <div>
                                <h3 className="font-bold text-forest">Verifying Payment</h3>
                                <p className="text-sm text-forest/70 font-medium">Connecting to payment gateway...</p>
                            </div>
                        </div>
                    )}
                </div>

                {pipelineError && steps.length === 0 && (
                    <div className="flex items-start gap-4 p-4 bg-red-50 rounded-2xl border border-red-100">
                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                            <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-red-800">{pipelineError.title}</h3>
                            <p className="text-sm text-red-600 font-medium mt-1">{pipelineError.detail}</p>
                        </div>
                    </div>
                )}

                <div className="mt-8 flex gap-3">
                    {pipelineError && (
                        <button onClick={() => navigate('/payment')} className="flex items-center gap-2 bg-cream text-heading px-6 py-3 rounded-full font-bold hover:bg-black/5 transition-colors">
                            <RotateCcw className="w-4 h-4" /> Try Again
                        </button>
                    )}
                    {pipelineSuccess && (
                        <button
                            onClick={() => navigate('/my-allocation')}
                            className="flex items-center gap-2 bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all"
                        >
                            View My Allocation <ArrowRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
