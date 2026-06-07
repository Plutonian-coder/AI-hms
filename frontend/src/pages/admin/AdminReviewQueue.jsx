import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { ShieldCheck, Loader2, Search, Eye, CheckCircle, XCircle, Download, FileText, AlertCircle, ChevronDown } from 'lucide-react';
import { useToast } from '../../components/Toast';

const STATUS_TABS = [
    { key: '', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
];

const STATUS_BADGES = {
    pending_verification: { bg: 'bg-warning-bg', text: 'text-warning', border: 'border-warning/30', label: 'Pending' },
    medical_approved: { bg: 'bg-success-bg', text: 'text-success', border: 'border-success/30', label: 'Approved' },
    ready_for_allocation: { bg: 'bg-success-bg', text: 'text-success', border: 'border-success/30', label: 'Approved' },
    medical_rejected: { bg: 'bg-danger-bg', text: 'text-danger', border: 'border-danger/30', label: 'Rejected' },
    allocated: { bg: 'bg-info-bg', text: 'text-info', border: 'border-info/30', label: 'Allocated' },
    paid: { bg: 'bg-success-bg', text: 'text-success', border: 'border-success/30', label: 'Paid' },
};

export default function AdminReviewQueue() {
    const toast = useToast();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(null);
    const [fetchingFile, setFetchingFile] = useState({ id: null, type: null });

    const handleViewDoc = async (appId, fileName) => {
        setFetchingFile({ id: appId, type: 'view' });
        try {
            const res = await apiClient.get(`/admin/medical-doc/${appId}`, {
                responseType: 'blob',
            });
            const blob = new Blob([res.data], { type: res.headers['content-type'] });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (error) {
            let msg = 'Failed to view medical document';
            if (error.response && error.response.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const json = JSON.parse(text);
                    msg = json.detail || msg;
                } catch (e) {}
            }
            toast.error(msg);
        } finally {
            setFetchingFile({ id: null, type: null });
        }
    };

    const handleDownloadDoc = async (appId, fileName) => {
        setFetchingFile({ id: appId, type: 'download' });
        try {
            const res = await apiClient.get(`/admin/medical-doc/${appId}`, {
                responseType: 'blob',
            });
            const blob = new Blob([res.data], { type: res.headers['content-type'] });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || 'document';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (error) {
            let msg = 'Failed to download medical document';
            if (error.response && error.response.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const json = JSON.parse(text);
                    msg = json.detail || msg;
                } catch (e) {}
            }
            toast.error(msg);
        } finally {
            setFetchingFile({ id: null, type: null });
        }
    };

    const fetchQueue = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/admin/review-queue', { params: { status_filter: filter || undefined } });
            setItems(res.data || []);
        } catch { toast.error('Failed to load review queue'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchQueue(); }, [filter]);

    const handleApprove = async (appId) => {
        if (!confirm('Approve this medical document?')) return;
        setActionLoading(appId);
        try {
            await apiClient.post(`/admin/review/${appId}`, { action: 'approve', notes: 'Approved by admin' });
            toast.success('Document approved');
            fetchQueue();
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed to approve'); }
        finally { setActionLoading(null); }
    };

    const handleReject = async (appId) => {
        if (!rejectNotes.trim()) { toast.error('Rejection notes are required'); return; }
        setActionLoading(appId);
        try {
            await apiClient.post(`/admin/review/${appId}`, { action: 'reject', notes: rejectNotes.trim() });
            toast.success('Document rejected — student notified');
            setShowRejectModal(null);
            setRejectNotes('');
            fetchQueue();
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed to reject'); }
        finally { setActionLoading(null); }
    };

    const pendingCount = items.filter(i => i.status === 'pending_verification').length;

    return (
        <div className="space-y-6 animate-in fade-in duration-350">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-heading tracking-tight flex items-center gap-3">
                        <ShieldCheck className="w-7 h-7 text-forest" /> Medical Review Queue
                    </h1>
                    <p className="text-sm text-muted mt-1">Review and action student medical documentation.</p>
                </div>
                {pendingCount > 0 && (
                    <span className="inline-flex items-center gap-2 bg-warning-bg text-warning px-4 py-2 rounded-full text-sm font-bold border border-warning/20">
                        {pendingCount} pending review{pendingCount > 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-surface rounded-xl p-1">
                {STATUS_TABS.map(tab => (
                    <button key={tab.key} onClick={() => setFilter(tab.key)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${filter === tab.key ? 'bg-white text-forest shadow-sm' : 'text-muted hover:text-heading'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-forest animate-spin" /></div>
            ) : items.length === 0 ? (
                <div className="glass rounded-2xl p-12 text-center">
                    <ShieldCheck className="w-12 h-12 text-muted mx-auto mb-3" />
                    <p className="text-muted font-medium">No items in queue</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map(item => {
                        const badge = STATUS_BADGES[item.status] || STATUS_BADGES.pending_verification;
                        const isExpanded = expandedId === item.application_id;
                        const isPending = item.status === 'pending_verification';
                        return (
                            <div key={item.application_id} className="glass rounded-2xl overflow-hidden transition-all">
                                <button onClick={() => setExpandedId(isExpanded ? null : item.application_id)}
                                    className="w-full p-5 flex items-center gap-4 text-left hover:bg-surface/50 transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-forest text-lime font-bold flex items-center justify-center shrink-0 text-sm">
                                        {item.full_name?.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-heading text-sm truncate">{item.full_name}</p>
                                        <p className="text-xs text-muted font-mono">{item.identifier}</p>
                                    </div>
                                    <div className="hidden sm:block text-right">
                                        <p className="text-xs font-semibold text-body">{item.special_needs_type}</p>
                                        <p className="text-[10px] text-muted">Attempt {item.upload_attempt}/3</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.bg} ${badge.text} ${badge.border}`}>
                                        {badge.label}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>

                                {isExpanded && (
                                    <div className="px-5 pb-5 border-t border-black/5 pt-4 animate-in slide-in-from-top-2 duration-200 space-y-4">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {[['Department', item.department], ['Level', item.level], ['Gender', item.gender], ['Submitted', item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—']].map(([l, v]) => (
                                                <div key={l} className="bg-surface rounded-xl p-3">
                                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{l}</p>
                                                    <p className="text-sm font-semibold text-heading mt-0.5">{v || '—'}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {item.medical_doc_name && (
                                            <div className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-black/5">
                                                <FileText className="w-5 h-5 text-forest shrink-0" />
                                                <span className="text-sm font-medium text-heading flex-1 truncate">{item.medical_doc_name}</span>
                                                <button onClick={() => handleViewDoc(item.application_id, item.medical_doc_name)} disabled={fetchingFile.id !== null}
                                                    className="flex items-center gap-1 text-xs font-bold text-forest hover:text-forest-light transition-colors disabled:opacity-50 font-sans">
                                                    {fetchingFile.id === item.application_id && fetchingFile.type === 'view' ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Eye className="w-3.5 h-3.5" />
                                                    )} View
                                                </button>
                                                <button onClick={() => handleDownloadDoc(item.application_id, item.medical_doc_name)} disabled={fetchingFile.id !== null}
                                                    className="flex items-center gap-1 text-xs font-bold text-forest hover:text-forest-light transition-colors disabled:opacity-50 font-sans">
                                                    {fetchingFile.id === item.application_id && fetchingFile.type === 'download' ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Download className="w-3.5 h-3.5" />
                                                    )} Download
                                                </button>
                                            </div>
                                        )}

                                        {item.review_notes && (
                                            <div className="bg-surface rounded-xl p-3 border border-black/5">
                                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Review Notes</p>
                                                <p className="text-sm text-body mt-1">{item.review_notes}</p>
                                            </div>
                                        )}

                                        {isPending && (
                                            <div className="flex gap-3 pt-2">
                                                <button onClick={() => handleApprove(item.application_id)} disabled={actionLoading === item.application_id}
                                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-forest text-white font-bold text-sm shadow-lg shadow-forest/20 hover:bg-forest-hover transition-all disabled:opacity-50">
                                                    {actionLoading === item.application_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Approve</>}
                                                </button>
                                                <button onClick={() => { setShowRejectModal(item.application_id); setRejectNotes(''); }}
                                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-danger-bg text-danger font-bold text-sm border border-danger/20 hover:bg-red-100 transition-all">
                                                    <XCircle className="w-4 h-4" /> Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowRejectModal(null)}>
                    <div className="glass-elevated rounded-2xl p-6 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-danger" /> Reject Document
                        </h3>
                        <p className="text-sm text-muted mt-2">Provide notes explaining why the document was rejected. The student will receive these notes via email.</p>
                        <textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} placeholder="Enter rejection reason…" rows={4}
                            className="w-full glass-input rounded-xl px-4 py-3 mt-4 text-sm font-medium resize-none" />
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setShowRejectModal(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-muted hover:bg-surface transition-all">Cancel</button>
                            <button onClick={() => handleReject(showRejectModal)} disabled={actionLoading} className="flex-1 py-3 rounded-xl bg-danger text-white font-bold text-sm hover:bg-red-700 transition-all disabled:opacity-50">
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
