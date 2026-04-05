import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Loader2, CheckCircle, XCircle, ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function CompatibilityQuiz() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [quizCompleted, setQuizCompleted] = useState(false);
    const [error, setError] = useState('');

    // SSE submission state
    const [submitting, setSubmitting] = useState(false);
    const [steps, setSteps] = useState([]);
    const [pipelineError, setPipelineError] = useState(null);
    const [pipelineResult, setPipelineResult] = useState(null);

    useEffect(() => {
        const init = async () => {
            try {
                // Check if quiz already done
                const statusRes = await apiClient.get('/quiz/status');
                if (statusRes.data.completed) {
                    setQuizCompleted(true);
                    setLoading(false);
                    return;
                }

                // Fetch questions
                const qRes = await apiClient.get('/quiz/questions');
                setQuestions(qRes.data.questions);
                setAnswers(new Array(qRes.data.questions.length).fill(null));
            } catch {
                setError('Failed to load quiz.');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleSelect = (value) => {
        const newAnswers = [...answers];
        newAnswers[currentQ] = value;
        setAnswers(newAnswers);
    };

    const handleSubmit = useCallback(async () => {
        if (answers.some(a => a === null)) {
            setError('Please answer all questions before submitting.');
            return;
        }

        setSubmitting(true);
        setSteps([]);
        setPipelineError(null);
        setPipelineResult(null);

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_BASE}/quiz/submit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ answers }),
            });

            if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
                const err = await response.json().catch(() => ({ detail: 'Server error' }));
                setPipelineError({ step: 0, title: 'Submission Failed', detail: err.detail || 'Could not submit quiz' });
                setSubmitting(false);
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
                                setPipelineResult(data);
                            }
                        } catch { /* skip */ }
                        currentEvent = null;
                    }
                }
            }
        } catch {
            setPipelineError({ step: 0, title: 'Network Error', detail: 'Failed to connect to the server.' });
        } finally {
            setSubmitting(false);
        }
    }, [answers]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-forest animate-spin" />
            </div>
        );
    }

    // Already completed quiz
    if (quizCompleted) {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-lime/10 border border-lime/30 rounded-2xl p-6 flex items-start gap-4">
                    <CheckCircle className="w-6 h-6 text-lime shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-forest">Quiz Already Completed</h3>
                        <p className="text-forest/70 text-sm mt-1">You have already completed the compatibility quiz for this session.</p>
                        <button onClick={() => navigate('/my-allocation')} className="mt-3 text-sm font-bold text-forest underline">
                            View My Allocation
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Showing SSE pipeline (submission in progress or complete)
    if (submitting || steps.length > 0 || pipelineResult || pipelineError) {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight">AI Allocation</h1>
                    <p className="text-muted mt-2 font-medium">Matching you with compatible roommates...</p>
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
                                        'bg-surface border border-black/5'
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
                                    <h3 className="font-bold text-forest">Submitting Quiz</h3>
                                    <p className="text-sm text-forest/70 font-medium">Processing your preferences...</p>
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

                    {/* Success result */}
                    {pipelineResult && (
                        <div className="mt-6 p-5 bg-lime/5 border border-lime/20 rounded-2xl">
                            <div className="flex items-center gap-3 mb-4">
                                <CheckCircle className="w-6 h-6 text-lime" />
                                <h3 className="font-bold text-forest text-lg">You've Been Allocated!</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white rounded-xl p-3 border border-black/5">
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Hostel</p>
                                    <p className="text-sm font-bold text-heading mt-0.5">{pipelineResult.hostel_name}</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 border border-black/5">
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Block</p>
                                    <p className="text-sm font-bold text-heading mt-0.5">{pipelineResult.block_name}</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 border border-black/5">
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Room</p>
                                    <p className="text-sm font-bold text-heading mt-0.5">{pipelineResult.room_number}</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 border border-black/5">
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Bed</p>
                                    <p className="text-sm font-bold text-heading mt-0.5">Bed {pipelineResult.bed_number}</p>
                                </div>
                            </div>
                            <div className="mt-3 text-center">
                                <p className="text-sm font-bold text-forest">
                                    Compatibility: {pipelineResult.avg_compatibility_score?.toFixed(1)}%
                                    {pipelineResult.matched_from_preference && (
                                        <span className="text-muted font-medium"> (Choice #{pipelineResult.matched_from_preference})</span>
                                    )}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 flex gap-3">
                        {pipelineError && (
                            <button onClick={() => { setSteps([]); setPipelineError(null); }} className="flex items-center gap-2 bg-surface text-heading px-6 py-3 rounded-full font-bold hover:bg-black/5 transition-colors">
                                Back to Quiz
                            </button>
                        )}
                        {pipelineResult && (
                            <button
                                onClick={() => navigate('/my-allocation')}
                                className="w-full flex items-center justify-center gap-2 bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all"
                            >
                                View My Allocation <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Quiz UI
    const q = questions[currentQ];
    const allAnswered = answers.every(a => a !== null);

    return (
        <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight flex items-center gap-3">
                    <ClipboardCheck className="w-8 h-8 text-forest" />
                    Compatibility Quiz
                </h1>
                <p className="text-muted mt-2 font-medium">Answer 8 lifestyle questions so we can match you with compatible roommates.</p>
            </div>

            {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl font-medium">
                    {error}
                </div>
            )}

            {/* Progress */}
            <div className="mt-6 flex items-center gap-2">
                {questions.map((_, i) => (
                    <div
                        key={i}
                        className={`flex-1 h-2 rounded-full transition-colors cursor-pointer ${
                            answers[i] !== null ? 'bg-lime' : i === currentQ ? 'bg-forest/30' : 'bg-black/10'
                        }`}
                        onClick={() => setCurrentQ(i)}
                    />
                ))}
            </div>
            <p className="text-xs font-bold text-muted mt-2">Question {currentQ + 1} of {questions.length}</p>

            {/* Question Card */}
            {q && (
                <div className="mt-4 bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                    <div className="mb-2">
                        <span className="inline-block px-3 py-1 bg-forest/5 text-forest rounded-full text-xs font-bold uppercase tracking-widest">
                            {q.dimension}
                        </span>
                    </div>
                    <h2 className="text-xl font-bold text-heading mt-3">{q.question}</h2>

                    <div className="mt-6 space-y-3">
                        {q.options.map((opt, i) => {
                            const isSelected = answers[currentQ] === opt.value;
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleSelect(opt.value)}
                                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                                        isSelected
                                            ? 'border-lime bg-lime/5 shadow-sm'
                                            : 'border-black/5 hover:border-forest/20 hover:bg-surface'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                            isSelected ? 'border-lime bg-lime' : 'border-black/20'
                                        }`}>
                                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                        <span className={`font-medium ${isSelected ? 'text-heading' : 'text-body'}`}>{opt.label}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Navigation */}
                    <div className="mt-8 flex items-center justify-between">
                        <button
                            onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                            disabled={currentQ === 0}
                            className="flex items-center gap-2 text-muted hover:text-heading font-medium transition-colors disabled:opacity-30"
                        >
                            <ChevronLeft className="w-4 h-4" /> Previous
                        </button>

                        {currentQ < questions.length - 1 ? (
                            <button
                                onClick={() => setCurrentQ(currentQ + 1)}
                                className="flex items-center gap-2 bg-forest text-white px-5 py-2.5 rounded-full font-bold hover:bg-forest-light transition-colors"
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={!allAnswered || submitting}
                                className={`flex items-center gap-2 bg-lime text-forest px-6 py-2.5 rounded-full font-bold shadow-lg shadow-lime/25 transition-all ${
                                    allAnswered && !submitting ? 'hover:bg-lime-hover hover:scale-[1.02]' : 'opacity-50'
                                }`}
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit & Allocate'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Answer summary */}
            {allAnswered && currentQ === questions.length - 1 && (
                <div className="mt-4 p-4 bg-lime/5 border border-lime/20 rounded-2xl text-center">
                    <p className="text-sm font-bold text-forest">All questions answered! Click "Submit & Allocate" to find your best match.</p>
                </div>
            )}
        </div>
    );
}
