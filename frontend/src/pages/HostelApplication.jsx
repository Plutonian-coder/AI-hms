import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function HostelApplication() {
    const navigate = useNavigate();
    const toast = useToast();
    const [hostels, setHostels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [existingApp, setExistingApp] = useState(null);
    const [feeSummary, setFeeSummary] = useState(null);
    const [feeLoading, setFeeLoading] = useState(false);

    const [choices, setChoices] = useState([null, null, null]);
    const [specialNotes, setSpecialNotes] = useState('');

    useEffect(() => {
        const init = async () => {
            try {
                // Check existing application
                try {
                    const appRes = await apiClient.get('/application/status');
                    if (appRes.data.has_application) {
                        setExistingApp(appRes.data);
                        setLoading(false);
                        return;
                    }
                } catch { /* no application yet */ }

                // Fetch hostels + fee summary in parallel
                const [hostRes, feeRes] = await Promise.all([
                    apiClient.get('/allocation/hostels'),
                    apiClient.get('/application/fee-summary').catch(() => null),
                ]);
                setHostels(hostRes.data);
                if (feeRes) setFeeSummary(feeRes.data);
            } catch {
                setError('Failed to load data. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (choices.some(c => !c)) {
            setError('Please select all 3 hostel preferences.');
            return;
        }

        // Check for duplicates
        const unique = new Set(choices);
        if (unique.size !== 3) {
            setError('Please select 3 different hostels.');
            return;
        }

        setSubmitting(true);
        try {
            await apiClient.post('/application/submit', {
                choice_1_id: parseInt(choices[0]),
                choice_2_id: parseInt(choices[1]),
                choice_3_id: parseInt(choices[2]),
                special_notes: specialNotes.trim() || undefined,
            });
            toast.success('Application submitted successfully!');
            navigate('/payment');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to submit application.');
        } finally {
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

    // Already applied
    if (existingApp) {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight flex items-center gap-3">
                        <FileText className="w-8 h-8 text-forest" />
                        Hostel Application
                    </h1>
                </div>

                <div className="mt-6 bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-lime/5 border border-lime/20">
                        <CheckCircle className="w-6 h-6 text-lime shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-forest">Application Submitted</h3>
                            <p className="text-forest/70 text-sm mt-1">
                                Status: <span className="font-bold uppercase">{existingApp.status}</span>
                            </p>
                        </div>
                    </div>

                    {existingApp.choices && (
                        <div className="mt-6 space-y-3">
                            <p className="text-xs font-bold text-muted uppercase tracking-widest">Your Hostel Preferences</p>
                            {existingApp.choices.map((c, i) => (
                                <div key={i} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-black/5">
                                    <span className="w-7 h-7 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-xs">{i + 1}</span>
                                    <span className="font-semibold text-heading text-sm">{c.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {existingApp.status === 'pending' && (
                        <button
                            onClick={() => navigate('/payment')}
                            className="mt-6 w-full flex items-center justify-center gap-2 bg-lime text-forest px-5 py-3.5 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all"
                        >
                            Proceed to Payment
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl animate-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight flex items-center gap-3">
                    <FileText className="w-8 h-8 text-forest" />
                    Hostel Application
                </h1>
                <p className="text-muted mt-2 font-medium">Select your hostel preferences in order of priority.</p>
            </div>

            <div className="mt-6 bg-white p-8 rounded-3xl shadow-sm border border-black/5">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl font-medium mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Hostel Choices */}
                    <div className="space-y-5">
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
                                    className="mt-1 block w-full rounded-xl border-black/10 shadow-sm focus:border-lime focus:ring-lime sm:text-lg bg-surface py-3 px-4 font-medium transition-colors hover:bg-white"
                                    value={choices[num] || ''}
                                    onChange={(e) => {
                                        const newChoices = [...choices];
                                        newChoices[num] = e.target.value;
                                        setChoices(newChoices);
                                    }}
                                >
                                    <option value="" disabled>Select a hostel...</option>
                                    {hostels.map((h) => (
                                        <option key={h.id} value={h.id} disabled={h.available === 0}>
                                            {h.name} — {h.available} beds available {h.available === 0 ? '(Full)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    {/* Special Notes */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold text-heading border-b border-black/5 pb-3 flex items-center gap-2">
                            <span className="bg-forest text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-black">2</span>
                            Additional Information
                        </h3>
                        <label className="block text-sm font-bold text-body uppercase tracking-widest">
                            Special Notes <span className="text-muted font-normal normal-case">(optional)</span>
                        </label>
                        <textarea
                            className="w-full rounded-xl border-black/10 shadow-sm focus:border-lime focus:ring-lime bg-surface py-3 px-4 font-medium transition-colors hover:bg-white resize-none"
                            rows={3}
                            value={specialNotes}
                            onChange={(e) => setSpecialNotes(e.target.value)}
                            placeholder="Medical conditions, disability accommodations, etc."
                        />
                    </div>

                    {/* Fee Summary */}
                    {feeSummary && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-bold text-heading border-b border-black/5 pb-3 flex items-center gap-2">
                                <span className="bg-forest text-lime w-6 h-6 rounded-full flex items-center justify-center text-sm font-black">3</span>
                                Fee Summary
                            </h3>
                            <div className="bg-forest rounded-2xl p-5 space-y-3">
                                {feeSummary.components?.map((comp, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <span className="text-white/60 text-sm font-medium">{comp.name}</span>
                                        <span className="text-white font-bold">{'\u20A6'}{comp.amount?.toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                                    <span className="text-white/80 font-bold">Total</span>
                                    <span className="text-2xl font-black text-lime">{'\u20A6'}{feeSummary.total?.toLocaleString()}</span>
                                </div>
                                <p className="text-white/30 text-xs font-medium">
                                    Study type: {feeSummary.study_type} | Payment to be made after application
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`w-full flex justify-center items-center py-4 px-4 rounded-full shadow-lg shadow-lime/25 text-base font-black text-forest bg-lime hover:bg-lime-hover transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100`}
                        >
                            {submitting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                'Submit Application'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
