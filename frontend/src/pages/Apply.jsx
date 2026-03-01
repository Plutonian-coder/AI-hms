import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { UploadCloud, ChevronRight, CheckCircle, XCircle, Loader2, RotateCcw, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function Apply() {
    const [hostels, setHostels] = useState([]);
    const [choices, setChoices] = useState([null, null, null]);
    const [receipt, setReceipt] = useState(null);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Pipeline state
    const [pipelineActive, setPipelineActive] = useState(false);
    const [steps, setSteps] = useState([]);
    const [pipelineError, setPipelineError] = useState(null);
    const [pipelineSuccess, setPipelineSuccess] = useState(false);

    useEffect(() => {
        apiClient.get('/allocation/hostels')
            .then(res => setHostels(res.data))
            .catch(() => {});
    }, []);

    const handleChoiceChange = (index, value) => {
        const newChoices = [...choices];
        newChoices[index] = value;
        setChoices(newChoices);
    };

    const resetPipeline = () => {
        setPipelineActive(false);
        setSteps([]);
        setPipelineError(null);
        setPipelineSuccess(false);
    };

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError('');

        if (choices.includes(null) || !receipt) {
            setError('Please select exactly 3 choices and upload your school fee receipt.');
            return;
        }

        setPipelineActive(true);
        setPipelineError(null);
        setPipelineSuccess(false);
        setSteps([]);

        const formData = new FormData();
        formData.append('choice_1_id', choices[0]);
        formData.append('choice_2_id', choices[1]);
        formData.append('choice_3_id', choices[2]);
        formData.append('receipt', receipt);

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_BASE}/allocation/apply`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
                const err = await response.json().catch(() => ({ detail: 'Server error' }));
                setPipelineError({ step: 0, title: 'Connection', detail: err.detail || 'Failed to start allocation' });
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
                                    if (idx >= 0) {
                                        updated[idx] = data;
                                    } else {
                                        updated.push(data);
                                    }
                                    return updated;
                                });
                            } else if (currentEvent === 'error') {
                                setPipelineError(data);
                            } else if (currentEvent === 'result') {
                                setPipelineSuccess(true);
                            }
                        } catch { /* skip malformed JSON */ }
                        currentEvent = null;
                    }
                }
            }
        } catch (err) {
            setPipelineError({ step: 0, title: 'Network Error', detail: 'Failed to connect to the server. Check your connection.' });
        }
    }, [choices, receipt]);

    // Pipeline Progress View
    if (pipelineActive) {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight">AI Allocation Pipeline</h1>
                    <p className="text-muted mt-2 font-medium">Processing your application in real-time...</p>
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
                                        <div className={`absolute left-5 top-12 w-0.5 h-6 ${
                                            isComplete ? 'bg-lime/30' : isFailed ? 'bg-red-200' : 'bg-black/5'
                                        }`} />
                                    )}

                                    <div className={`flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 ${
                                        isFailed ? 'bg-red-50 border border-red-100' :
                                        isProcessing ? 'bg-forest/5 border border-forest/10' :
                                        isComplete ? 'bg-lime/5 border border-lime/20' :
                                        'bg-cream border border-black/5'
                                    }`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            isFailed ? 'bg-red-100' :
                                            isProcessing ? 'bg-forest/10' :
                                            isComplete ? 'bg-lime/20' :
                                            'bg-black/5'
                                        }`}>
                                            {isFailed && <XCircle className="w-5 h-5 text-red-600" />}
                                            {isProcessing && <Loader2 className="w-5 h-5 text-forest animate-spin" />}
                                            {isComplete && <CheckCircle className="w-5 h-5 text-lime" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-bold text-muted uppercase tracking-widest">
                                                Step {step.step}/{step.total}
                                            </span>
                                            <h3 className={`font-bold text-base mt-0.5 ${
                                                isFailed ? 'text-red-800' :
                                                isProcessing ? 'text-forest' :
                                                'text-heading'
                                            }`}>
                                                {step.title}
                                            </h3>
                                            <p className={`text-sm mt-1 font-medium ${
                                                isFailed ? 'text-red-600' :
                                                isProcessing ? 'text-forest/70' :
                                                'text-muted'
                                            }`}>
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
                                    <h3 className="font-bold text-forest">Initializing Pipeline</h3>
                                    <p className="text-sm text-forest/70 font-medium">Connecting to allocation engine...</p>
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
                        {(pipelineError) && (
                            <button
                                onClick={resetPipeline}
                                className="flex items-center gap-2 bg-cream text-heading px-6 py-3 rounded-full font-bold hover:bg-black/5 transition-colors"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Try Again
                            </button>
                        )}
                        {pipelineSuccess && (
                            <button
                                onClick={() => navigate('/my-allocation')}
                                className="flex items-center gap-2 bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all"
                            >
                                View My Allocation
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Form View
    return (
        <div className="max-w-3xl animate-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight">Apply for Bed Space</h1>
                <p className="text-muted mt-2 font-medium">Complete the form below to automatically secure a bed using First-Come-First-Serve processing.</p>
            </div>

            <div className="mt-8 bg-white p-8 rounded-3xl shadow-sm border border-black/5 relative overflow-hidden">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg font-medium mb-6">
                        Error: {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-heading border-b border-black/5 pb-3 flex items-center gap-2">
                            <span className="bg-lime text-forest w-6 h-6 rounded-full flex items-center justify-center text-sm font-black text-center">1</span>
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

                    <div className="space-y-6">
                        <h3 className="text-lg font-bold text-heading border-b border-black/5 pb-3 mt-8 flex items-center gap-2">
                            <span className="bg-forest text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-black text-center">2</span>
                            Remita Receipt Validation (AI)
                        </h3>

                        <label htmlFor="file-upload" className={`mt-2 flex justify-center rounded-2xl border-2 border-dashed px-6 py-12 group cursor-pointer transition-colors ${receipt ? 'border-lime bg-lime/5' : 'border-black/10 bg-cream hover:bg-lime/5'}`}>
                            <div className="text-center group-hover:scale-105 transition-transform">
                                <UploadCloud className={`mx-auto h-12 w-12 ${receipt ? 'text-lime' : 'text-muted group-hover:text-forest'}`} />
                                <p className="mt-4 text-sm font-bold text-forest">
                                    {receipt ? 'Click to change file' : 'Upload a receipt image'}
                                </p>
                                <p className="text-xs font-semibold text-muted mt-2 tracking-wide">
                                    {receipt ? <span className="text-lime">{receipt.name}</span> : 'PNG, JPG, up to 10MB'}
                                </p>
                                <input id="file-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={(e) => e.target.files[0] && setReceipt(e.target.files[0])} />
                            </div>
                        </label>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-full shadow-lg shadow-lime/25 text-base font-black text-forest bg-lime hover:bg-lime-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lime transition-all hover:scale-[1.02]"
                        >
                            <span className="flex items-center gap-2">Secure Bed Space <ChevronRight className="w-5 h-5" /></span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
