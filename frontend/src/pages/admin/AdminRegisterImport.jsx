import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import {
    Upload, FileSpreadsheet, CheckCircle, AlertCircle, Trash2,
    UserPlus, Download, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { useToast } from '../../components/Toast';

const LEVELS = ['100L', '200L', '300L', '400L', '500L'];
const STUDY_TYPES = ['Full-time', 'Part-time', 'Sandwich'];
const GENDERS = ['male', 'female'];

export default function AdminRegisterImport() {
    const [registerStats, setRegisterStats] = useState(null);
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [showManualForm, setShowManualForm] = useState(false);
    const [manualSubmitting, setManualSubmitting] = useState(false);
    const [bulkExpanded, setBulkExpanded] = useState(true);
    const [manualForm, setManualForm] = useState({
        matric_number: '', surname: '', first_name: '', gender: '',
        department: '', level: '', study_type: '', faculty: '',
    });
    const toast = useToast();

    const fetchStats = () => {
        apiClient.get('/admin/register/stats')
            .then(res => setRegisterStats(res.data))
            .catch(() => { });
    };

    useEffect(() => { fetchStats(); }, []);

    // CSV Template download
    const downloadTemplate = () => {
        apiClient.get('/admin/register/template', { responseType: 'blob' })
            .then(res => {
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = 'session_register_template.csv';
                a.click();
                window.URL.revokeObjectURL(url);
                toast.success('Template downloaded');
            })
            .catch(() => toast.error('Failed to download template'));
    };

    // File handling
    const handleFileSelect = (selectedFile) => {
        if (!selectedFile) return;
        const ext = selectedFile.name.split('.').pop().toLowerCase();
        if (ext !== 'csv') { toast.error('Only CSV files are allowed'); return; }
        setFile(selectedFile);
        setPreview(null);
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setPreview(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiClient.post('/admin/register/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setPreview(res.data);
            if (res.data.error_count > 0) {
                toast.error(`${res.data.error_count} validation error(s) found.`);
            } else {
                toast.success(`${res.data.total_rows} rows validated successfully.`);
            }
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to upload CSV');
        } finally {
            setUploading(false);
        }
    };

    const handleConfirm = async () => {
        if (!preview) return;
        setConfirming(true);
        try {
            const res = await apiClient.post('/admin/register/confirm', {
                session_id: preview.session_id,
                rows: preview.all_rows,
            });
            toast.success(res.data.message);
            setPreview(null);
            setFile(null);
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to import register');
        } finally {
            setConfirming(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFileSelect(e.dataTransfer.files[0]);
    };

    // Manual add
    const handleManualChange = (field, value) => {
        setManualForm(prev => ({ ...prev, [field]: value }));
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setManualSubmitting(true);
        try {
            const res = await apiClient.post('/admin/register/add-student', manualForm);
            toast.success(res.data.message);
            setManualForm({
                matric_number: '', surname: '', first_name: '', gender: '',
                department: '', level: '', study_type: '', faculty: '',
            });
            fetchStats();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to add student');
        } finally {
            setManualSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-350">
            <div>
                <h1 className="text-2xl font-extrabold text-heading tracking-tight">Session Register Import</h1>
                <p className="text-muted mt-2 font-medium">
                    Upload a CSV of enrolled students or add them manually to verify registrations for the current session.
                </p>
            </div>

            {/* Current Register Stats */}
            {registerStats && (
                <div className="bg-forest p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Active Session Register</p>
                        <p className="text-white text-lg font-bold mt-1">{registerStats.session_name || 'No active session'}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 rounded-xl px-5 py-3 text-center">
                            <p className="text-2xl font-black text-lime">{registerStats.count}</p>
                            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Students Imported</p>
                        </div>
                        <button
                            onClick={downloadTemplate}
                            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            CSV Template
                        </button>
                    </div>
                </div>
            )}

            {/* Two-tab toggle: Bulk CSV / Manual Add */}
            <div className="flex gap-2">
                <button
                    onClick={() => { setBulkExpanded(true); setShowManualForm(false); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all ${bulkExpanded && !showManualForm
                        ? 'bg-lime text-forest shadow-lg shadow-lime/25'
                        : 'bg-white text-muted border border-black/10 hover:bg-surface'
                    }`}
                >
                    <Upload className="w-4 h-4" />
                    Bulk CSV Import
                </button>
                <button
                    onClick={() => { setShowManualForm(true); setBulkExpanded(false); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all ${showManualForm
                        ? 'bg-lime text-forest shadow-lg shadow-lime/25'
                        : 'bg-white text-muted border border-black/10 hover:bg-surface'
                    }`}
                >
                    <UserPlus className="w-4 h-4" />
                    Add Single Student
                </button>
            </div>

            {/* ── Manual Add Student Form ── */}
            {showManualForm && (
                <div className="glass rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-muted" />
                            Add Student Manually
                        </h3>
                        <button onClick={() => setShowManualForm(false)} className="text-muted hover:text-heading transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleManualSubmit} className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Matric Number *</label>
                                <input
                                    value={manualForm.matric_number}
                                    onChange={e => handleManualChange('matric_number', e.target.value)}
                                    placeholder="e.g. FPT/CSC/25/0001"
                                    required
                                    className="w-full glass-input text-heading rounded-xl p-3 font-medium text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Surname *</label>
                                <input
                                    value={manualForm.surname}
                                    onChange={e => handleManualChange('surname', e.target.value)}
                                    placeholder="Surname"
                                    required
                                    className="w-full glass-input text-heading rounded-xl p-3 font-medium text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">First Name *</label>
                                <input
                                    value={manualForm.first_name}
                                    onChange={e => handleManualChange('first_name', e.target.value)}
                                    placeholder="First name"
                                    required
                                    className="w-full glass-input text-heading rounded-xl p-3 font-medium text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Gender *</label>
                                <select
                                    value={manualForm.gender}
                                    onChange={e => handleManualChange('gender', e.target.value)}
                                    required
                                    className="w-full glass-input text-heading rounded-xl p-3 font-medium text-sm"
                                >
                                    <option value="">Select gender</option>
                                    {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Department</label>
                                <input
                                    value={manualForm.department}
                                    onChange={e => handleManualChange('department', e.target.value)}
                                    placeholder="e.g. Computer Science"
                                    className="w-full glass-input text-heading rounded-xl p-3 font-medium text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Level</label>
                                <select
                                    value={manualForm.level}
                                    onChange={e => handleManualChange('level', e.target.value)}
                                    className="w-full glass-input text-heading rounded-xl p-3 font-medium text-sm"
                                >
                                    <option value="">Select level</option>
                                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Study Type *</label>
                                <select
                                    value={manualForm.study_type}
                                    onChange={e => handleManualChange('study_type', e.target.value)}
                                    required
                                    className="w-full glass-input text-heading rounded-xl p-3 font-medium text-sm"
                                >
                                    <option value="">Select type</option>
                                    {STUDY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Faculty</label>
                                <input
                                    value={manualForm.faculty}
                                    onChange={e => handleManualChange('faculty', e.target.value)}
                                    placeholder="e.g. Science"
                                    className="w-full glass-input text-heading rounded-xl p-3 font-medium text-sm"
                                />
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end">
                            <button
                                type="submit"
                                disabled={manualSubmitting}
                                className={`flex items-center gap-2 bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 transition-all ${manualSubmitting ? 'opacity-60' : 'hover:bg-lime-hover hover:scale-[1.02]'}`}
                            >
                                <UserPlus className="w-4 h-4" />
                                {manualSubmitting ? 'Adding...' : 'Add Student'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Bulk CSV Import Section ── */}
            {!showManualForm && (
                <div className="glass rounded-2xl overflow-hidden">
                    <button
                        onClick={() => setBulkExpanded(!bulkExpanded)}
                        className="w-full px-6 py-5 border-b border-black/5 flex items-center justify-between hover:bg-surface/30 transition-colors"
                    >
                        <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                            <Upload className="w-5 h-5 text-muted" />
                            Upload Student Register CSV
                        </h3>
                        {bulkExpanded ? <ChevronUp className="w-5 h-5 text-muted" /> : <ChevronDown className="w-5 h-5 text-muted" />}
                    </button>

                    {bulkExpanded && (
                        <div className="p-6 space-y-4 animate-in fade-in duration-200">
                            {/* Required format */}
                            <div className="bg-surface/50 border border-black/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold text-heading mb-2">Required CSV Columns:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {['matric_number', 'surname', 'first_name', 'gender', 'department', 'level', 'study_type'].map(col => (
                                            <span key={col} className="text-[10px] font-bold bg-forest/10 text-forest px-2.5 py-1 rounded-full">{col}</span>
                                        ))}
                                        <span className="text-[10px] font-bold bg-black/5 text-muted px-2.5 py-1 rounded-full">faculty (optional)</span>
                                    </div>
                                    <p className="text-[10px] text-muted mt-2">Gender: male/female • Study type: Full-time/Part-time/Sandwich • Level: 100L–500L</p>
                                </div>
                                <button
                                    onClick={downloadTemplate}
                                    className="flex items-center gap-2 bg-forest text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-forest/90 transition-colors shrink-0"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Download Template
                                </button>
                            </div>

                            {/* Drop Zone */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${dragOver
                                    ? 'border-lime bg-lime/5'
                                    : 'border-black/10 hover:border-lime/50 hover:bg-surface/50'
                                }`}
                                onClick={() => document.getElementById('csv-input').click()}
                            >
                                <input
                                    id="csv-input"
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={e => handleFileSelect(e.target.files[0])}
                                />
                                <FileSpreadsheet className={`w-12 h-12 mx-auto mb-3 ${dragOver ? 'text-lime' : 'text-black/15'}`} />
                                {file ? (
                                    <div>
                                        <p className="text-sm font-bold text-heading">{file.name}</p>
                                        <p className="text-xs text-muted mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                                            className="mt-2 text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1 mx-auto"
                                        >
                                            <Trash2 className="w-3 h-3" /> Remove
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-sm font-medium text-muted">
                                        Drop your CSV file here or <span className="text-lime font-bold">click to browse</span>
                                    </p>
                                )}
                            </div>

                            {/* Upload button */}
                            {file && !preview && (
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className={`w-full flex items-center justify-center gap-2 bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 transition-all ${uploading ? 'opacity-60' : 'hover:bg-lime-hover hover:scale-[1.02]'}`}
                                >
                                    <Upload className="w-4 h-4" />
                                    {uploading ? 'Validating...' : 'Upload & Validate'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Preview Section ── */}
            {preview && (
                <div className="glass rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-heading">Validation Results</h3>
                            <p className="text-xs text-muted mt-1">
                                Session: <span className="font-bold text-heading">{preview.session_name}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-center">
                                <p className="text-xl font-black text-heading">{preview.total_rows}</p>
                                <p className="text-[10px] text-muted font-bold uppercase">Valid Rows</p>
                            </div>
                            <div className="text-center">
                                <p className={`text-xl font-black ${preview.error_count > 0 ? 'text-red-500' : 'text-lime'}`}>
                                    {preview.error_count}
                                </p>
                                <p className="text-[10px] text-muted font-bold uppercase">Errors</p>
                            </div>
                        </div>
                    </div>

                    {/* Validation errors */}
                    {preview.errors.length > 0 && (
                        <div className="px-6 py-4 bg-red-50 border-b border-red-100">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                <span className="text-sm font-bold text-red-700">Validation Errors</span>
                            </div>
                            <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                                {preview.errors.map((err, i) => (
                                    <li key={i} className="font-medium">• {err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Preview table */}
                    <div className="overflow-auto max-h-72">
                        <table className="w-full text-xs">
                            <thead className="bg-surface sticky top-0">
                                <tr>
                                    {['Matric No.', 'Surname', 'First Name', 'Gender', 'Department', 'Level', 'Study Type'].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left font-bold text-muted uppercase tracking-widest whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                                {preview.preview.map((row, i) => (
                                    <tr key={i} className="hover:bg-surface/30 transition-colors">
                                        <td className="px-3 py-2 font-bold text-heading whitespace-nowrap">{row.matric_number}</td>
                                        <td className="px-3 py-2 font-medium text-heading">{row.surname}</td>
                                        <td className="px-3 py-2 font-medium text-heading">{row.first_name}</td>
                                        <td className="px-3 py-2 font-medium text-heading capitalize">{row.gender}</td>
                                        <td className="px-3 py-2 font-medium text-heading">{row.department}</td>
                                        <td className="px-3 py-2 font-medium text-heading">{row.level}</td>
                                        <td className="px-3 py-2 font-medium text-heading">{row.study_type}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {preview.total_rows > 10 && (
                            <div className="text-center text-xs text-muted py-2 bg-surface/50 font-medium">
                                Showing first 10 of {preview.total_rows} rows
                            </div>
                        )}
                    </div>

                    {/* Confirm / Cancel */}
                    <div className="px-6 py-4 border-t border-black/5 flex gap-3">
                        <button
                            onClick={handleConfirm}
                            disabled={confirming || preview.total_rows === 0}
                            className={`flex-1 flex items-center justify-center gap-2 bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 transition-all ${confirming || preview.total_rows === 0 ? 'opacity-60' : 'hover:bg-lime-hover hover:scale-[1.02]'}`}
                        >
                            <CheckCircle className="w-4 h-4" />
                            {confirming ? 'Importing...' : `Import ${preview.total_rows} Students`}
                        </button>
                        <button
                            onClick={() => { setPreview(null); setFile(null); }}
                            className="px-6 py-3 rounded-full font-bold bg-surface text-heading hover:bg-black/5 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
