import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Receipt, Search, Loader2 } from 'lucide-react';

const STATUS_BADGES = {
    pending:   'bg-amber-50 text-amber-700 border border-amber-200',
    completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    failed:    'bg-red-50 text-red-600 border border-red-200',
};

const TABS = [
    { key: '', label: 'All' },
    { key: 'completed', label: 'Completed' },
    { key: 'pending', label: 'Pending' },
    { key: 'failed', label: 'Failed' },
];

export default function AdminTransactions() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('');
    const [search, setSearch] = useState('');

    const fetchTransactions = (status) => {
        setLoading(true);
        const url = status ? `/admin/transactions?status=${status}` : '/admin/transactions';
        apiClient.get(url)
            .then(res => setTransactions(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchTransactions(activeTab); }, [activeTab]);

    const filtered = search.trim()
        ? transactions.filter(t =>
            t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            t.identifier?.toLowerCase().includes(search.toLowerCase()) ||
            t.reference?.toLowerCase().includes(search.toLowerCase())
        )
        : transactions;

    const totalAmount = filtered.reduce((sum, t) => sum + (t.status === 'completed' ? t.amount : 0), 0);
    const completedCount = filtered.filter(t => t.status === 'completed').length;
    const pendingCount = filtered.filter(t => t.status === 'pending').length;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight flex items-center gap-3">
                    <Receipt className="w-8 h-8 text-forest" />
                    Transaction Monitoring
                </h1>
                <p className="text-muted mt-2 font-medium">View and track all hostel payment transactions.</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-forest p-5 rounded-2xl shadow-lg shadow-forest/20">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em]">Total Revenue</p>
                    <p className="text-xl font-black text-lime mt-1">{'\u20A6'}{totalAmount.toLocaleString()}</p>
                </div>
                <div className="bg-forest p-5 rounded-2xl shadow-lg shadow-forest/20">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em]">Completed</p>
                    <p className="text-xl font-black text-emerald-400 mt-1">{completedCount}</p>
                </div>
                <div className="bg-forest p-5 rounded-2xl shadow-lg shadow-forest/20">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em]">Pending</p>
                    <p className="text-xl font-black text-amber-400 mt-1">{pendingCount}</p>
                </div>
            </div>

            {/* Tabs + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex gap-2">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                                activeTab === tab.key
                                    ? 'bg-forest text-lime shadow-md'
                                    : 'bg-cream text-muted hover:bg-black/5'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                        type="text"
                        placeholder="Search by name, matric, or reference..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10 pr-4 py-2.5 bg-white border border-black/10 rounded-xl text-sm font-medium focus:ring-lime focus:border-lime transition-colors w-full sm:w-80"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 text-forest animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="bg-cream rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                            <Receipt className="w-8 h-8 text-muted" />
                        </div>
                        <p className="text-muted font-medium">No transactions found.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-black/5">
                                        <th className="text-left px-5 py-4 text-xs font-bold text-muted uppercase tracking-widest">Student</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-muted uppercase tracking-widest">Matric No.</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-muted uppercase tracking-widest">Amount</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-muted uppercase tracking-widest">Reference</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-muted uppercase tracking-widest">Status</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-muted uppercase tracking-widest">Choices</th>
                                        <th className="text-left px-5 py-4 text-xs font-bold text-muted uppercase tracking-widest">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(t => (
                                        <tr key={t.id} className="border-b border-black/5 hover:bg-cream/50 transition-colors">
                                            <td className="px-5 py-4 font-semibold text-heading text-sm">{t.full_name}</td>
                                            <td className="px-5 py-4 text-sm font-mono text-muted">{t.identifier}</td>
                                            <td className="px-5 py-4 text-sm font-bold text-heading">{'\u20A6'}{t.amount?.toLocaleString()}</td>
                                            <td className="px-5 py-4 text-xs font-mono text-muted truncate max-w-[120px]" title={t.reference}>{t.reference}</td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGES[t.status] || STATUS_BADGES.pending}`}>
                                                    {t.status?.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-xs text-muted">
                                                <div className="space-y-0.5">
                                                    {t.choice_1 && <div>1. {t.choice_1}</div>}
                                                    {t.choice_2 && <div>2. {t.choice_2}</div>}
                                                    {t.choice_3 && <div>3. {t.choice_3}</div>}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-xs text-muted whitespace-nowrap">
                                                {t.created_at ? new Date(t.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="lg:hidden divide-y divide-black/5">
                            {filtered.map(t => (
                                <div key={t.id} className="p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-heading text-sm">{t.full_name}</p>
                                            <p className="text-xs font-mono text-muted">{t.identifier}</p>
                                        </div>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGES[t.status] || STATUS_BADGES.pending}`}>
                                            {t.status?.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-bold text-heading">{'\u20A6'}{t.amount?.toLocaleString()}</span>
                                        <span className="text-xs text-muted">
                                            {t.created_at ? new Date(t.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : '-'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted">
                                        Choices: {[t.choice_1, t.choice_2, t.choice_3].filter(Boolean).join(' → ')}
                                    </div>
                                    <p className="text-[11px] font-mono text-muted/60 truncate">Ref: {t.reference}</p>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
