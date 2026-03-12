import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { ShieldCheck, UploadCloud, CheckCircle, XCircle, Loader2, RotateCcw, ArrowRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const DOC_LABELS = {
    acceptance_fee: 'Acceptance Fee Receipt',
    e_screening: 'E-Screening Receipt',
    school_fees: 'School Fees Receipt',
};

const LEVELS = ['ND1', 'ND2', 'HND1', 'HND2'];

export default function Eligibility() {
    const navigate = useNavigate();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [levelSaving, setLevelSaving] = useState(false);

    // Upload pipeline state (per document)
    const [activeUpload, setActiveUpload] = useState(null); // document_type being uploaded
    const [steps, setSteps] = useState([]);
    const [pipelineError, setPipelineError] = useState(null);
    const [pipelineSuccess, setPipelineSuccess] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await apiClient.get('/eligibility/status');
            setStatus(res.data);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    const handleSetLevel = async (level) => {
        setLevelSaving(true);
        try {
            const formData = new FormData();
            formData.append('level', level);
            await apiClient.patch('/allocation/profile', formData);
            await fetchStatus();
        } catch {
            // ignore
        } finally {
            setLevelSaving(false);
        }
    };

    const resetPipeline = () => {
        setActiveUpload(null);
        setSteps([]);
        setPipelineError(null);
        setPipelineSuccess(false);
    };

    const handleUpload = useCallback(async (docType, file) => {
        setActiveUpload(docType);
        setSteps([]);
        setPipelineError(null);
        setPipelineSuccess(false);

        const formData = new FormData();
        formData.append('document_type', docType);
        formData.append('document', file);

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_BASE}/eligibility/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
                const err = await response.json().catch(() => ({ detail: 'Server error' }));
                setPipelineError({ step: 0, title: 'Connection', detail: err.detail || 'Failed to start verification' });
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
                                // Refresh status
                                setTimeout(() => fetchStatus(), 500);
                            }
                        } catch { /* skip */ }
                        currentEvent = null;
                    }
                }
            }
        } catch {
            setPipelineError({ step: 0, title: 'Network Error', detail: 'Failed to connect to the server.' });
        }
    }, [fetchStatus]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-forest animate-spin" />
            </div>
        );
    }

    // Pipeline view when uploading
    if (activeUpload) {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight">Document Verification</h1>
                    <p className="text-muted mt-2 font-medium">Verifying your {DOC_LABELS[activeUpload]}...</p>
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
                                    <h3 className="font-bold text-forest">Initializing Verification</h3>
                                    <p className="text-sm text-forest/70 font-medium">Connecting to AI engine...</p>
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
                            <button onClick={resetPipeline} className="flex items-center gap-2 bg-cream text-heading px-6 py-3 rounded-full font-bold hover:bg-black/5 transition-colors">
                                <RotateCcw className="w-4 h-4" /> Try Again
                            </button>
                        )}
                        {pipelineSuccess && (
                            <button onClick={resetPipeline} className="flex items-center gap-2 bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all">
                                Continue <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Main eligibility view
    const portalOpen = status?.portal_open;
    const levelSet = status?.level_set;
    const isEligible = status?.is_eligible;
    const requiredDocs = status?.required_docs || [];
    const documents = status?.documents || [];

    const getDocStatus = (docType) => {
        return documents.find(d => d.document_type === docType);
    };

    return (
        <div className="max-w-3xl animate-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-forest" />
                    Eligibility Verification
                </h1>
                <p className="text-muted mt-2 font-medium">
                    Verify your eligibility before applying for hostel accommodation.
                </p>
                {status?.session && (
                    <span className="inline-block mt-2 px-3 py-1 bg-forest/10 text-forest text-sm font-bold rounded-full">
                        {status.session.name}
                    </span>
                )}
            </div>

            {/* Portal closed */}
            {!portalOpen && (
                <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
                    <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-amber-800">Eligibility Portal Closed</h3>
                        <p className="text-amber-700 text-sm mt-1">The eligibility verification portal is currently closed. Please check back later.</p>
                    </div>
                </div>
            )}

            {/* Already eligible */}
            {isEligible && (
                <div className="mt-8 bg-lime/10 border border-lime/30 rounded-2xl p-6 flex items-start gap-4">
                    <CheckCircle className="w-6 h-6 text-lime shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-bold text-forest text-lg">You are Eligible!</h3>
                        <p className="text-forest/70 text-sm mt-1">All required documents have been verified. You can now proceed to pay for hostel allocation.</p>
                        <button
                            onClick={() => navigate('/payment')}
                            className="mt-4 flex items-center gap-2 bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all"
                        >
                            Proceed to Payment <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {portalOpen && (
                <div className="mt-8 space-y-6">
                    {/* Step 1: Set Level */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                        <h3 className="text-lg font-bold text-heading flex items-center gap-2 mb-4">
                            <span className="bg-lime text-forest w-6 h-6 rounded-full flex items-center justify-center text-sm font-black">1</span>
                            Your Academic Level
                        </h3>

                        {!levelSet ? (
                            <div>
                                <p className="text-muted text-sm mb-4">Select your current level to see which documents you need to upload.</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {LEVELS.map(lvl => (
                                        <button
                                            key={lvl}
                                            onClick={() => handleSetLevel(lvl)}
                                            disabled={levelSaving}
                                            className="py-3 px-4 rounded-xl font-bold text-forest bg-cream hover:bg-lime/20 border border-black/5 hover:border-lime/30 transition-all disabled:opacity-50"
                                        >
                                            {levelSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : lvl}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <span className="px-4 py-2 bg-forest text-white font-bold rounded-xl">{status.level}</span>
                                <span className="text-muted text-sm">
                                    {(status.level === 'ND1' || status.level === 'HND1') ? 'Freshman' : 'Returning Student'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Step 2: Upload Documents */}
                    {levelSet && !isEligible && (
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
                            <h3 className="text-lg font-bold text-heading flex items-center gap-2 mb-4">
                                <span className="bg-forest text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-black">2</span>
                                Upload Required Documents
                            </h3>
                            <p className="text-muted text-sm mb-6">
                                Upload each document below. Our AI will verify them automatically.
                            </p>

                            <div className="space-y-4">
                                {requiredDocs.map(docType => {
                                    const doc = getDocStatus(docType);
                                    const isVerified = doc?.ai_verdict === 'verified';
                                    const isRejected = doc?.ai_verdict === 'rejected';

                                    return (
                                        <div key={docType} className={`p-4 rounded-2xl border ${
                                            isVerified ? 'bg-lime/5 border-lime/20' :
                                            isRejected ? 'bg-red-50 border-red-100' :
                                            'bg-cream border-black/5'
                                        }`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {isVerified && <CheckCircle className="w-5 h-5 text-lime" />}
                                                    {isRejected && <XCircle className="w-5 h-5 text-red-500" />}
                                                    {!doc && <UploadCloud className="w-5 h-5 text-muted" />}
                                                    <div>
                                                        <h4 className="font-bold text-heading">{DOC_LABELS[docType]}</h4>
                                                        {isVerified && <p className="text-sm text-lime font-medium">Verified</p>}
                                                        {isRejected && <p className="text-sm text-red-600 font-medium">{doc.rejection_reason || 'Rejected'}</p>}
                                                        {!doc && <p className="text-sm text-muted">Not uploaded yet</p>}
                                                    </div>
                                                </div>

                                                {!isVerified && (
                                                    <label className="cursor-pointer bg-forest text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-forest/90 transition-colors">
                                                        {isRejected ? 'Re-upload' : 'Upload'}
                                                        <input
                                                            type="file"
                                                            className="sr-only"
                                                            accept="image/png, image/jpeg"
                                                            onChange={(e) => {
                                                                if (e.target.files[0]) handleUpload(docType, e.target.files[0]);
                                                            }}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Progress indicator */}
                            <div className="mt-6 flex items-center gap-2">
                                <div className="flex-1 bg-black/5 rounded-full h-2">
                                    <div
                                        className="bg-lime h-2 rounded-full transition-all duration-500"
                                        style={{ width: `${(status.docs_submitted / status.docs_required) * 100}%` }}
                                    />
                                </div>
                                <span className="text-sm font-bold text-muted">{status.docs_submitted}/{status.docs_required}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
