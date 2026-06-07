import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../api/client';
import { useNavigate } from 'react-router-dom';
import {
    FileText, Loader2, CheckCircle, AlertCircle, Upload, X, User,
    HeartPulse, Building, Send, ChevronRight, AlertTriangle, FileUp, Eye, CreditCard
} from 'lucide-react';
import { useToast } from '../components/Toast';

const STAGES = [
    { num: 1, label: 'Profile', icon: User },
    { num: 2, label: 'Disability', icon: HeartPulse },
    { num: 3, label: 'Preferences', icon: Building },
    { num: 4, label: 'Submit', icon: Send },
];

const SPECIAL_NEEDS_TYPES = [
    'Physical Disability', 'Visual Impairment', 'Hearing Impairment', 'Chronic Illness', 'Other'
];

export default function HostelApplication() {
    const navigate = useNavigate();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Pipeline state
    const [appStatus, setAppStatus] = useState(null);
    const [currentStage, setCurrentStage] = useState(1);
    const [stageCompleted, setStageCompleted] = useState(0);

    // Stage 1
    const [academicData, setAcademicData] = useState(null);
    const [progress, setProgress] = useState(null);
    // Stage 2
    const [hasSpecialNeeds, setHasSpecialNeeds] = useState(false);
    const [specialNeedsType, setSpecialNeedsType] = useState('');
    const [otherDisability, setOtherDisability] = useState('');
    const [medicalFile, setMedicalFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [uploadAttempt, setUploadAttempt] = useState(0);
    const fileInputRef = useRef(null);
    // Stage 3
    const [hostels, setHostels] = useState([]);
    const [choice1, setChoice1] = useState('');
    const [choice2, setChoice2] = useState('');

    // Load existing application state
    useEffect(() => {
        const init = async () => {
            try {
                let statusData = { has_application: false };
                try {
                    const statusRes = await apiClient.get('/application/status');
                    statusData = statusRes.data;
                } catch (e) {
                    console.error('Status Error:', e);
                    setError('Failed to load application status: ' + (e.response?.data?.detail || e.message || String(e)));
                    // We don't throw, we just proceed with has_application: false
                }

                const [hRes, dashRes] = await Promise.all([
                    apiClient.get('/allocation/hostels').catch(() => ({ data: [] })),
                    apiClient.get('/allocation/dashboard').catch(() => ({ data: null }))
                ]);

                if (statusData.has_application) {
                    const d = statusData;
                    setAppStatus(d);
                    setStageCompleted(d.stage_completed || 0);
                    setHasSpecialNeeds(d.has_special_needs || false);
                    
                    if (d.special_needs_type?.startsWith('Other: ')) {
                        setSpecialNeedsType('Other');
                        setOtherDisability(d.special_needs_type.replace('Other: ', ''));
                    } else {
                        setSpecialNeedsType(d.special_needs_type || '');
                    }
                    
                    setUploadAttempt(d.upload_attempt || 0);
                    if (d.choices?.[0]?.id) setChoice1(String(d.choices[0].id));
                    if (d.choices?.[1]?.id) setChoice2(String(d.choices[1].id));

                    // Determine which stage to show
                    const isLocked = !['draft', 'medical_rejected'].includes(d.status);
                    if (isLocked) {
                        setCurrentStage(5); // locked view
                    } else if (d.status === 'medical_rejected') {
                        setCurrentStage(2); // re-upload mode
                    } else {
                        setCurrentStage(Math.min((d.stage_completed || 0) + 1, 4));
                    }
                }
                setHostels(hRes.data || []);
                if (dashRes.data?.profile) setAcademicData(dashRes.data.profile);
                if (dashRes.data?.progress) setProgress(dashRes.data.progress);
            } catch (err) {
                setError('Failed to load application data: ' + (err.message || String(err)));
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const handleStage1 = async () => {
        setSubmitting(true); setError('');
        try {
            const res = await apiClient.post('/application/stage1');
            setStageCompleted(Math.max(stageCompleted, 1));
            if (res.data.academic_data) setAcademicData({ ...academicData, ...res.data.academic_data });
            setCurrentStage(2);
            toast.success('Academic eligibility confirmed');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to verify eligibility');
        } finally { setSubmitting(false); }
    };

    const handleStage2 = async () => {
        setSubmitting(true); setError('');
        try {
            const formData = new FormData();
            formData.append('has_special_needs', hasSpecialNeeds);
            if (hasSpecialNeeds) {
                if (!specialNeedsType) { setError('Please select a disability type'); setSubmitting(false); return; }
                if (specialNeedsType === 'Other' && !otherDisability.trim()) { setError('Please describe your disability'); setSubmitting(false); return; }
                
                formData.append('special_needs_type', specialNeedsType === 'Other' ? `Other: ${otherDisability.trim()}` : specialNeedsType);
                
                if (!medicalFile && !appStatus?.medical_doc_name) { setError('Please upload medical documentation'); setSubmitting(false); return; }
                if (medicalFile) formData.append('medical_doc', medicalFile);
            }
            const res = await apiClient.post('/application/stage2', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setStageCompleted(Math.max(stageCompleted, 2));
            setUploadAttempt(res.data.upload_attempt || 0);
            setCurrentStage(3);
            toast.success('Accommodations info saved');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save accommodations');
        } finally { setSubmitting(false); }
    };

    const handleStage3 = async () => {
        setSubmitting(true); setError('');
        if (!choice1 || !choice2) { setError('Please select both hostel preferences'); setSubmitting(false); return; }
        if (choice1 === choice2) { setError('Please select 2 different hostels'); setSubmitting(false); return; }
        try {
            await apiClient.post('/application/stage3', { choice_1_id: parseInt(choice1), choice_2_id: parseInt(choice2) });
            setStageCompleted(Math.max(stageCompleted, 3));
            setCurrentStage(4);
            toast.success('Hostel preferences saved');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save preferences');
        } finally { setSubmitting(false); }
    };

    const handleSubmit = async () => {
        setSubmitting(true); setError('');
        try {
            const res = await apiClient.post('/application/submit');
            setAppStatus(res.data);
            setCurrentStage(5);
            toast.success('Application submitted!');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to submit application');
        } finally { setSubmitting(false); }
    };

    const handleFileDrop = useCallback((e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) { setError('Only PDF, JPEG, PNG allowed'); return; }
        if (file.size > 5 * 1024 * 1024) { setError('File too large (max 5MB)'); return; }
        setMedicalFile(file);
        setError('');
        if (['jpg', 'jpeg', 'png'].includes(ext)) {
            const reader = new FileReader();
            reader.onload = (ev) => setFilePreview(ev.target.result);
            reader.readAsDataURL(file);
        } else {
            setFilePreview(null);
        }
    }, []);

    if (loading) return (
        <div className="max-w-3xl mx-auto p-6 animate-pulse space-y-6">
            <div className="h-8 bg-black/5 rounded w-1/3 mb-8"></div>
            <div className="h-64 bg-black/5 rounded-2xl w-full"></div>
        </div>
    );

    // ── Step Indicator ──
    const StepIndicator = () => (
        <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute top-5 left-8 right-8 h-0.5 bg-surface-2 z-0" />
            <div className="absolute top-5 left-8 h-0.5 bg-gradient-to-r from-forest to-lime z-0 transition-all duration-700" style={{ width: `${Math.max(0, (Math.min(currentStage, 4) - 1) / 3) * (100 - 12)}%` }} />
            {STAGES.map((s) => {
                const done = stageCompleted >= s.num;
                const active = currentStage === s.num;
                const Icon = s.icon;
                return (
                    <div key={s.num} className="flex flex-col items-center relative z-10 w-20">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${done ? 'bg-forest text-white shadow-forest/25' : active ? 'bg-white border-2 border-forest text-forest ring-4 ring-forest/10' : 'bg-white border border-gray-200 text-muted'}`}>
                            {done ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                        </div>
                        <span className={`text-[10px] font-bold mt-2 text-center ${done ? 'text-forest' : active ? 'text-heading' : 'text-muted'}`}>{s.label}</span>
                    </div>
                );
            })}
        </div>
    );

    // ── Locked / Submitted View ──
    if (currentStage === 5 || (appStatus && !['draft', 'medical_rejected'].includes(appStatus.status))) {
        const status = appStatus?.status || 'submitted';
        const isReview = status === 'pending_verification';
        const isReady = ['ready_for_allocation', 'medical_approved'].includes(status);
        return (
            <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
                <h1 className="text-2xl font-extrabold text-heading tracking-tight flex items-center gap-3 mb-6">
                    <FileText className="w-7 h-7 text-forest" /> Hostel Application
                </h1>
                <div className="glass rounded-2xl p-6">
                    <StepIndicator />
                    <div className={`flex items-start gap-4 p-5 rounded-2xl border ${isReview ? 'bg-warning-bg/30 border-warning/20' : 'bg-lime-soft border-lime-border'}`}>
                        {isReview ? <AlertTriangle className="w-6 h-6 text-warning shrink-0 mt-0.5" /> : <CheckCircle className="w-6 h-6 text-forest shrink-0 mt-0.5" />}
                        <div>
                            <h3 className="font-bold text-heading">{isReview ? 'Under Administrative Review' : isReady ? 'Application Cleared' : 'Application Submitted'}</h3>
                            <p className="text-sm text-body mt-1">{isReview ? 'Your medical documentation is being reviewed. You will be notified by email within 3–5 working days.' : isReady ? 'Your application is cleared for allocation. Proceed to make payment.' : `Status: ${status.replace(/_/g, ' ')}`}</p>
                            {appStatus?.admin_status_note && (
                                <div className="mt-3 p-3 rounded-xl bg-white/60 border border-black/5">
                                    <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Admin Note</p>
                                    <p className="text-sm text-body">{appStatus.admin_status_note}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    {appStatus?.choices?.filter(Boolean).length > 0 && (
                        <div className="mt-5 space-y-2">
                            <p className="text-xs font-bold text-muted uppercase tracking-widest">Your Hostel Preferences</p>
                            {appStatus.choices.filter(Boolean).map((c, i) => (
                                <div key={i} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-black/5">
                                    <span className="w-7 h-7 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-xs">{i + 1}</span>
                                    <span className="font-semibold text-heading text-sm">{c.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {isReady && (
                        <button onClick={() => navigate('/payment?type=application')} className="mt-6 w-full flex items-center justify-center gap-2 bg-forest text-white px-5 py-3.5 rounded-xl font-bold shadow-lg shadow-forest/20 hover:bg-forest-hover hover:scale-[1.02] transition-all">
                            Proceed to Payment <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ── Rejection Re-upload Banner ──
    const rejectionBanner = appStatus?.status === 'medical_rejected' && (
        <div className="bg-danger-bg border border-danger/20 rounded-2xl p-5 mb-6 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-danger shrink-0 mt-0.5" />
            <div>
                <h3 className="font-bold text-danger">Document Rejected — Re-upload Required</h3>
                <p className="text-sm text-body mt-1">{appStatus.medical_review_notes || 'Your documentation could not be verified.'}</p>
                <p className="text-xs text-muted mt-2 font-semibold">Attempt {uploadAttempt} of 3</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-2xl font-extrabold text-heading tracking-tight flex items-center gap-3 mb-1">
                <FileText className="w-7 h-7 text-forest" /> Hostel Application
            </h1>
            <p className="text-muted font-medium text-sm mb-6">Complete all 4 stages to submit your application.</p>

            <div className="glass rounded-2xl p-6 sm:p-8">
                <StepIndicator />
                {rejectionBanner}
                {error && (
                    <div className="bg-danger-bg border border-danger/20 text-danger px-4 py-3 rounded-xl font-medium mb-6 flex items-start gap-3 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> {error}
                    </div>
                )}

                {/* ── STAGE 1: Academic Profile ── */}
                {currentStage === 1 && (
                    <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                            <span className="bg-forest text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-black">1</span>
                            <h3 className="text-lg font-bold text-heading">Profile & Academic Eligibility</h3>
                        </div>
                        <p className="text-sm text-muted">Confirm your academic information is correct before proceeding.</p>
                        {academicData ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    ['Matric Number', academicData.identifier || academicData.matric_number],
                                    ['Full Name', `${academicData.surname || academicData.last_name || ''} ${academicData.first_name || ''}`],
                                    ['Gender', academicData.gender],
                                    ['Department', academicData.department],
                                    ['Level', academicData.level],
                                    ['Study Type', academicData.study_type],
                                ].map(([label, val]) => (
                                    <div key={label} className="bg-surface rounded-xl p-3.5 border border-black/5">
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{label}</p>
                                        <p className="text-sm font-semibold text-heading mt-0.5">{val || '—'}</p>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-sm text-muted italic">Loading academic data…</p>}
                        <button onClick={handleStage1} disabled={submitting} className="w-full flex justify-center items-center py-3.5 rounded-xl shadow-lg shadow-forest/15 text-sm font-bold text-white bg-forest hover:bg-forest-hover transition-all hover:scale-[1.02] disabled:opacity-50">
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm & Continue'}
                        </button>
                    </div>
                )}

                {/* ── STAGE 2: Special Accommodations ── */}
                {currentStage === 2 && (
                    <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                            <span className="bg-forest text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-black">2</span>
                            <h3 className="text-lg font-bold text-heading">Disability Information</h3>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-body">Do you have a disability that requires accommodation?</p>
                            <div className="flex gap-3">
                                {[true, false].map(val => (
                                    <button key={String(val)} onClick={() => { setHasSpecialNeeds(val); if (!val) { setSpecialNeedsType(''); setOtherDisability(''); setMedicalFile(null); setFilePreview(null); } }}
                                        className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all ${hasSpecialNeeds === val ? 'border-forest bg-lime-soft text-forest' : 'border-gray-200 text-muted hover:border-forest/30'}`}>
                                        {val ? 'Yes' : 'No'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {hasSpecialNeeds && (
                            <>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-body uppercase tracking-widest">Type of Disability</label>
                                        <select value={specialNeedsType} onChange={e => setSpecialNeedsType(e.target.value)} className="w-full glass-input rounded-xl px-4 py-3 text-sm font-medium">
                                            <option value="">Select type…</option>
                                            {SPECIAL_NEEDS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    {specialNeedsType === 'Other' && (
                                        <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                            <label className="block text-xs font-bold text-body uppercase tracking-widest">Please Specify</label>
                                            <input 
                                                value={otherDisability} 
                                                onChange={e => setOtherDisability(e.target.value)} 
                                                className="w-full glass-input rounded-xl px-4 py-3 text-sm font-medium" 
                                                placeholder="Describe your disability..."
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-bold text-body uppercase tracking-widest">Medical Documentation</label>
                                        <span className="text-xs font-semibold text-muted">Attempt {uploadAttempt + (medicalFile ? 1 : 0)} of 3</span>
                                    </div>
                                    <div onDragOver={e => e.preventDefault()} onDrop={handleFileDrop}
                                        className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-forest/40 transition-colors cursor-pointer"
                                        onClick={() => fileInputRef.current?.click()}>
                                        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileDrop} />
                                        {medicalFile ? (
                                            <div className="space-y-3">
                                                {filePreview ? <img src={filePreview} alt="Preview" className="w-24 h-24 object-cover rounded-xl mx-auto border" /> : <FileUp className="w-10 h-10 text-forest mx-auto" />}
                                                <p className="text-sm font-semibold text-heading">{medicalFile.name}</p>
                                                <p className="text-xs text-muted">{(medicalFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                                <button onClick={e => { e.stopPropagation(); setMedicalFile(null); setFilePreview(null); }} className="text-xs text-danger font-bold hover:underline">Remove</button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <Upload className="w-8 h-8 text-muted mx-auto" />
                                                <p className="text-sm font-semibold text-body">Drop file here or click to browse</p>
                                                <p className="text-xs text-muted">PDF, JPEG, PNG — Max 5MB</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                        <div className="flex gap-3">
                            {stageCompleted >= 1 && <button onClick={() => setCurrentStage(1)} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-bold text-muted hover:text-heading hover:bg-surface transition-all">Back</button>}
                            <button onClick={handleStage2} disabled={submitting} className="flex-1 flex justify-center items-center py-3.5 rounded-xl shadow-lg shadow-forest/15 text-sm font-bold text-white bg-forest hover:bg-forest-hover transition-all hover:scale-[1.02] disabled:opacity-50">
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STAGE 3: Hostel Preferences ── */}
                {currentStage === 3 && (
                    <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                            <span className="bg-forest text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-black">3</span>
                            <h3 className="text-lg font-bold text-heading">Hostel Preferences</h3>
                        </div>
                        <p className="text-sm text-muted">Select 2 hostels in order of priority.</p>
                        {[{ label: '1st Choice (Primary)', val: choice1, set: setChoice1 }, { label: '2nd Choice', val: choice2, set: setChoice2 }].map((item, i) => (
                            <div key={i} className="space-y-2">
                                <label className="block text-xs font-bold text-body uppercase tracking-widest">{item.label}</label>
                                <select value={item.val} onChange={e => item.set(e.target.value)} className="w-full glass-input rounded-xl px-4 py-3 text-sm font-medium">
                                    <option value="">Select a hostel…</option>
                                    {hostels.map(h => <option key={h.id} value={h.id} disabled={h.available === 0}>{h.name} — {h.available} beds {h.available === 0 ? '(Full)' : ''}</option>)}
                                </select>
                            </div>
                        ))}
                        <div className="flex gap-3">
                            <button onClick={() => setCurrentStage(2)} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-bold text-muted hover:text-heading hover:bg-surface transition-all">Back</button>
                            <button onClick={handleStage3} disabled={submitting} className="flex-1 flex justify-center items-center py-3.5 rounded-xl shadow-lg shadow-forest/15 text-sm font-bold text-white bg-forest hover:bg-forest-hover transition-all hover:scale-[1.02] disabled:opacity-50">
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STAGE 4: Review & Submit ── */}
                {currentStage === 4 && (
                    <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="flex items-center gap-2 border-b border-black/5 pb-3">
                            <span className="bg-forest text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-black">4</span>
                            <h3 className="text-lg font-bold text-heading">Review & Submit</h3>
                        </div>
                        <p className="text-sm text-muted">Please review your application before final submission.</p>
                        {/* Summary cards */}
                        <div className="space-y-3">
                            <div className="bg-surface rounded-xl p-4 border border-black/5">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Academic Profile</p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-muted">Name</span><span className="font-semibold text-heading text-right">{academicData?.surname || academicData?.last_name} {academicData?.first_name}</span>
                                    <span className="text-muted">Matric</span><span className="font-semibold text-heading text-right font-mono text-xs">{academicData?.identifier || academicData?.matric_number}</span>
                                    <span className="text-muted">Department</span><span className="font-semibold text-heading text-right">{academicData?.department}</span>
                                </div>
                            </div>
                            <div className="bg-surface rounded-xl p-4 border border-black/5">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Disability Information</p>
                                <p className="text-sm font-semibold text-heading">
                                    {hasSpecialNeeds 
                                        ? `Yes — ${specialNeedsType === 'Other' ? otherDisability : specialNeedsType}` 
                                        : 'No disability requiring accommodation'}
                                </p>
                            </div>
                            <div className="bg-surface rounded-xl p-4 border border-black/5">
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Hostel Preferences</p>
                                {[choice1, choice2].map((cId, i) => {
                                    const h = hostels.find(x => String(x.id) === cId);
                                    return h ? (
                                        <div key={i} className="flex items-center gap-2 mt-1">
                                            <span className="w-5 h-5 rounded-full bg-forest text-lime text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                                            <span className="text-sm font-semibold text-heading">{h.name}</span>
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        </div>
                        <div className="p-4 bg-warning-bg/30 border border-warning/20 rounded-xl">
                            <p className="text-xs text-warning font-semibold">⚠️ You must pay the Application Fee before you can submit. Your application will be locked after submission.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setCurrentStage(3)} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-bold text-muted hover:text-heading hover:bg-surface transition-all">Back</button>
                            {progress?.app_fee_paid ? (
                                <button onClick={handleSubmit} disabled={submitting} className="flex-1 flex justify-center items-center py-3.5 rounded-xl shadow-lg shadow-lime/25 text-sm font-black text-forest bg-lime hover:bg-lime-hover transition-all hover:scale-[1.02] disabled:opacity-50">
                                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Submit Application</>}
                                </button>
                            ) : (
                                <button onClick={() => navigate('/payment?type=application')} className="flex-1 flex justify-center items-center py-3.5 rounded-xl shadow-lg shadow-forest/25 text-sm font-black text-white bg-forest hover:bg-forest-hover transition-all hover:scale-[1.02]">
                                    <CreditCard className="w-4 h-4 mr-2" /> Pay Application Fee
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
