import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Shield, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';
import { useToast } from '../../components/Toast';

const ACTION_TYPES = [
    'STUDENT_REGISTERED', 'STUDENT_LOGIN', 'PROFILE_UPDATED', 'PASSWORD_CHANGED',
    'APPLICATION_SUBMITTED', 'PAYMENT_INITIALIZED', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED',
    'RECEIPT_GENERATED', 'QUIZ_SUBMITTED', 'BED_ALLOCATED', 'ALLOCATION_REVOKED',
    'SESSION_CREATED', 'SESSION_ACTIVATED', 'SESSION_ENDED', 'PORTAL_TOGGLED',
    'FEE_COMPONENT_ADDED', 'FEE_COMPONENT_UPDATED', 'REGISTER_IMPORTED',
    'HOSTEL_CREATED', 'REPORT_GENERATED', 'ADMIN_NL_QUERY',
];

const ACTION_COLORS = {
    STUDENT_REGISTERED: 'bg-emerald-100 text-emerald-700',
    STUDENT_LOGIN: 'bg-blue-100 text-blue-700',
    PAYMENT_CONFIRMED: 'bg-lime/15 text-lime',
    PAYMENT_FAILED: 'bg-red-100 text-red-700',
    BED_ALLOCATED: 'bg-purple-100 text-purple-700',
    ALLOCATION_REVOKED: 'bg-red-100 text-red-700',
    SESSION_CREATED: 'bg-amber-100 text-amber-700',
    PORTAL_TOGGLED: 'bg-sky-100 text-sky-700',
    ADMIN_NL_QUERY: 'bg-violet-100 text-violet-700',
    REPORT_GENERATED: 'bg-teal-100 text-teal-700',
};

export default function AdminAuditLogs() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [actionType, setActionType] = useState('');
    const [actorId, setActorId] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const toast = useToast();
    const limit = 25;

    const fetchLogs = () => {
        setLoading(true);
        const params = new URLSearchParams({ page, limit });
        if (actionType) params.append('action_type', actionType);
        if (actorId.trim()) params.append('actor_id', actorId.trim());

        apiClient.get(`/admin/audit-logs?${params}`)
            .then(res => {
                setLogs(res.data.logs);
                setTotal(res.data.total);
            })
            .catch(() => toast.error('Failed to load audit logs'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchLogs(); }, [page, actionType]);

    const totalPages = Math.ceil(total / limit);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchLogs();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-350">
            <div>
                <h1 className="text-2xl font-extrabold text-heading tracking-tight">Audit Trail</h1>
                <p className="text-muted mt-2 font-medium">Immutable record of all {total} system events.</p>
            </div>

            {/* Filters */}
            <div className="glass rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1.5">Action Type</label>
                        <select
                            value={actionType}
                            onChange={e => { setActionType(e.target.value); setPage(1); }}
                            className="w-full glass-input text-heading rounded-xl p-3 font-medium text-sm"
                        >
                            <option value="">All Actions</option>
                            {ACTION_TYPES.map(t => (
                                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                            ))}
                        </select>
                    </div>
                    <form onSubmit={handleSearch} className="flex-1">
                        <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1.5">Actor ID</label>
                        <div className="flex gap-2">
                            <input
                                value={actorId}
                                onChange={e => setActorId(e.target.value)}
                                placeholder="e.g. ADMIN001 or matric"
                                className="flex-1 glass-input text-heading rounded-xl p-3 font-medium text-sm"
                            />
                            <button
                                type="submit"
                                className="bg-forest text-white px-4 rounded-xl font-bold hover:bg-forest/90 transition-colors"
                            >
                                <Search className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Logs Table */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                        <Shield className="w-5 h-5 text-muted" />
                        Audit Events
                    </h3>
                    <span className="text-xs font-bold text-muted bg-surface px-3 py-1.5 rounded-full">
                        Page {page} of {totalPages || 1}
                    </span>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-muted animate-pulse font-medium">Loading audit logs...</div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center text-muted font-medium">No audit events found.</div>
                ) : (
                    <div className="divide-y divide-black/5">
                        {logs.map(log => (
                            <div
                                key={log.id}
                                className="px-6 py-4 hover:bg-surface/50 transition-colors cursor-pointer"
                                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${ACTION_COLORS[log.action_type] || 'bg-surface text-muted'}`}>
                                                {log.action_type.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-xs font-bold text-forest bg-forest/5 px-2 py-0.5 rounded-full">
                                                {log.actor_type}: {log.actor_id}
                                            </span>
                                        </div>
                                        <p className="text-sm font-medium text-heading mt-1.5 truncate">{log.description}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs font-medium text-muted">
                                            {new Date(log.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                        <p className="text-xs text-muted/60">
                                            {new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </p>
                                    </div>
                                </div>

                                {/* Expanded metadata */}
                                {expandedId === log.id && (
                                    <div className="mt-3 p-3 bg-surface/70 rounded-xl text-xs space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <div><span className="font-bold text-muted">ID:</span> <span className="text-heading font-medium">{log.id}</span></div>
                                            <div><span className="font-bold text-muted">Target:</span> <span className="text-heading font-medium">{log.target_entity || '-'}</span></div>
                                            <div><span className="font-bold text-muted">Target ID:</span> <span className="text-heading font-medium">{log.target_id || '-'}</span></div>
                                            <div><span className="font-bold text-muted">Session:</span> <span className="text-heading font-medium">{log.session_id || '-'}</span></div>
                                        </div>
                                        {Object.keys(log.metadata || {}).length > 0 && (
                                            <div className="mt-2">
                                                <span className="font-bold text-muted">Metadata:</span>
                                                <pre className="mt-1 bg-forest/5 text-heading p-2 rounded-lg overflow-x-auto text-[11px] font-mono">
                                                    {JSON.stringify(log.metadata, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-black/5 flex items-center justify-between">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-surface text-heading font-bold text-sm disabled:opacity-40 hover:bg-black/5 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Previous
                        </button>
                        <span className="text-sm font-bold text-muted">
                            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-surface text-heading font-bold text-sm disabled:opacity-40 hover:bg-black/5 transition-colors"
                        >
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
