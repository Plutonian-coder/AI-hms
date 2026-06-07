import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Activity, Loader2, Search, ChevronDown, CheckCircle, Clock, Send, AlertCircle } from 'lucide-react';
import { useToast } from '../../components/Toast';

const PIPELINE_STATES = [
    { key: 'draft', label: 'Draft', color: 'bg-gray-200 text-gray-700' },
    { key: 'pending_verification', label: 'Under Review', color: 'bg-warning-bg text-warning' },
    { key: 'medical_approved', label: 'Med. Approved', color: 'bg-info-bg text-info' },
    { key: 'medical_rejected', label: 'Med. Rejected', color: 'bg-danger-bg text-danger' },
    { key: 'ready_for_allocation', label: 'Ready', color: 'bg-success-bg text-success' },
    { key: 'allocated', label: 'Allocated', color: 'bg-info-bg text-info' },
    { key: 'paid', label: 'Paid', color: 'bg-success-bg text-success' },
    { key: 'cancelled', label: 'Cancelled', color: 'bg-gray-200 text-gray-500' },
];

export default function AdminApplicationTracker() {
    const toast = useToast();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [noteText, setNoteText] = useState('');
    const [noteStatus, setNoteStatus] = useState('');
    const [updating, setUpdating] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter) params.status_filter = statusFilter;
            if (searchQuery.trim()) params.search = searchQuery.trim();
            const res = await apiClient.get('/admin/application-tracker', { params });
            setItems(res.data || []);
        } catch { toast.error('Failed to load applications'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [statusFilter]);
    useEffect(() => { const t = setTimeout(fetchData, 400); return () => clearTimeout(t); }, [searchQuery]);

    const handleUpdateStatus = async (appId) => {
        if (!noteText.trim()) { toast.error('Note is required'); return; }
        setUpdating(true);
        try {
            await apiClient.post(`/admin/application/${appId}/update-status`, { note: noteText.trim(), status: noteStatus || undefined });
            toast.success('Status updated');
            setNoteText(''); setNoteStatus('');
            fetchData();
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update'); }
        finally { setUpdating(false); }
    };

    const getBadge = (status) => {
        const s = PIPELINE_STATES.find(p => p.key === status);
        return s || { label: status, color: 'bg-gray-100 text-gray-600' };
    };

    const PipelineViz = ({ status, hasSpecialNeeds }) => {
        const stages = ['draft', hasSpecialNeeds ? 'pending_verification' : null, 'ready_for_allocation', 'allocated', 'paid'].filter(Boolean);
        const currentIdx = stages.indexOf(status);
        return (
            <div className="flex items-center gap-1">
                {stages.map((s, i) => {
                    const reached = i <= currentIdx && currentIdx >= 0;
                    const isCurrent = s === status;
                    return (
                        <div key={s} className="flex items-center gap-1">
                            <div className={`w-2.5 h-2.5 rounded-full transition-all ${reached ? (isCurrent ? 'bg-forest ring-2 ring-forest/20' : 'bg-forest') : 'bg-gray-200'}`} />
                            {i < stages.length - 1 && <div className={`w-4 h-0.5 ${reached ? 'bg-forest' : 'bg-gray-200'}`} />}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-350">
            <div>
                <h1 className="text-2xl font-extrabold text-heading tracking-tight flex items-center gap-3">
                    <Activity className="w-7 h-7 text-forest" /> Application Tracker
                </h1>
                <p className="text-sm text-muted mt-1">Track all student applications through the pipeline.</p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by matric or name…"
                        className="w-full glass-input rounded-xl pl-10 pr-4 py-3 text-sm font-medium" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="glass-input rounded-xl px-4 py-3 text-sm font-medium min-w-[180px]">
                    <option value="">All Statuses</option>
                    {PIPELINE_STATES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-forest animate-spin" /></div>
            ) : items.length === 0 ? (
                <div className="glass rounded-2xl p-12 text-center">
                    <Activity className="w-12 h-12 text-muted mx-auto mb-3" />
                    <p className="text-muted font-medium">No applications found</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {items.map(item => {
                        const badge = getBadge(item.status);
                        const isExpanded = expandedId === item.application_id;
                        return (
                            <div key={item.application_id} className="glass rounded-2xl overflow-hidden">
                                <button onClick={() => { setExpandedId(isExpanded ? null : item.application_id); setNoteText(''); setNoteStatus(''); }}
                                    className="w-full p-4 flex items-center gap-3 text-left hover:bg-surface/50 transition-colors">
                                    <div className="w-9 h-9 rounded-full bg-forest text-lime font-bold flex items-center justify-center shrink-0 text-xs">
                                        {item.full_name?.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-heading text-sm truncate">{item.full_name}</p>
                                        <p className="text-[10px] text-muted font-mono">{item.identifier}</p>
                                    </div>
                                    <div className="hidden sm:block"><PipelineViz status={item.status} hasSpecialNeeds={item.has_special_needs} /></div>
                                    <div className="hidden md:block text-right">
                                        <p className="text-xs text-muted">Stage {item.stage_completed}/3</p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
                                        {badge.label}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>

                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-black/5 pt-4 animate-in slide-in-from-top-2 duration-200 space-y-4">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {[
                                                ['Department', item.department], ['Level', item.level], ['Gender', item.gender],
                                                ['Special Needs', item.has_special_needs ? 'Yes' : 'No'],
                                                ['Submitted', item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'],
                                                ['Created', item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'],
                                                ['Med. Review', item.medical_reviewed_at ? new Date(item.medical_reviewed_at).toLocaleDateString() : '—'],
                                                ['Stage', `${item.stage_completed}/3`],
                                            ].map(([l, v]) => (
                                                <div key={l} className="bg-surface rounded-xl p-3">
                                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{l}</p>
                                                    <p className="text-sm font-semibold text-heading mt-0.5">{v || '—'}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {item.admin_status_note && (
                                            <div className="bg-surface rounded-xl p-3 border-l-4 border-forest">
                                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Last Admin Note</p>
                                                <p className="text-sm text-body mt-1">{item.admin_status_note}</p>
                                                {item.admin_status_updated_at && <p className="text-[10px] text-muted mt-1">{new Date(item.admin_status_updated_at).toLocaleString()}</p>}
                                            </div>
                                        )}

                                        {/* Admin update panel */}
                                        <div className="bg-surface rounded-xl p-4 space-y-3 border border-black/5">
                                            <p className="text-xs font-bold text-heading uppercase tracking-widest">Commit Status Update</p>
                                            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Write a status note for this student…" rows={2}
                                                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-sm font-medium resize-none" />
                                            <div className="flex gap-3 items-end">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Transition Status (optional)</label>
                                                    <select value={noteStatus} onChange={e => setNoteStatus(e.target.value)} className="w-full glass-input rounded-xl px-3.5 py-2.5 text-sm font-medium mt-1">
                                                        <option value="">Keep current status</option>
                                                        {PIPELINE_STATES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                                    </select>
                                                </div>
                                                <button onClick={() => handleUpdateStatus(item.application_id)} disabled={updating}
                                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest text-white font-bold text-sm shadow-lg shadow-forest/15 hover:bg-forest-hover transition-all disabled:opacity-50">
                                                    {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Commit</>}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
