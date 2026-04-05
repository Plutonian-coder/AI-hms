import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Receipt, Search, Loader2, TrendingUp, CheckCircle2, Clock } from 'lucide-react';

const STATUS_STYLE = {
    pending:   'bg-amber-50 text-amber-700 border border-amber-200',
    confirmed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    failed:    'bg-red-50 text-red-600 border border-red-200',
};

const TABS = [
    { key: '', label: 'All' },
    { key: 'confirmed', label: 'Confirmed' },
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

    const totalRevenue  = filtered.reduce((sum, t) => sum + (t.status === 'confirmed' ? t.amount : 0), 0);
    const confirmedCount = filtered.filter(t => t.status === 'confirmed').length;
    const pendingCount   = filtered.filter(t => t.status === 'pending').length;

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    return (
        <div className="space-y-5 animate-in fade-in duration-350">
            {/* Header */}
            <div>
                <p className="text-xs font-bold text-forest-muted uppercase tracking-[0.18em]">Records</p>
                <h1 className="text-2xl font-extrabold text-heading tracking-tight mt-0.5">Transaction Monitoring</h1>
                <p className="text-sm text-muted font-medium mt-1">View and track all hostel payment transactions.</p>
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard icon={TrendingUp} label="Total Revenue" value={`₦${totalRevenue.toLocaleString()}`} accent="forest" />
                <SummaryCard icon={CheckCircle2} label="Confirmed" value={confirmedCount} accent="success" />
                <SummaryCard icon={Clock} label="Pending" value={pendingCount} accent="warning" />
            </div>

            {/* Tabs + search */}
            <div className="glass rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex gap-1.5">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                                activeTab === tab.key
                                    ? 'bg-forest text-white shadow-sm'
                                    : 'text-muted hover:text-heading hover:bg-surface-2'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2.5 flex-1 glass-input rounded-xl px-3.5 py-2.5 sm:ml-auto sm:max-w-xs">
                    <Search className="w-4 h-4 text-muted shrink-0" />
                    <input
                        type="text"
                        placeholder="Search name, matric, reference…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="flex-1 bg-transparent text-sm font-medium text-heading placeholder:text-muted-light outline-none"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="glass rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 text-forest animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-14 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
                            <Receipt className="w-6 h-6 text-muted" />
                        </div>
                        <p className="text-muted font-medium text-sm">No transactions found.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-surface border-b border-sidebar-border">
                                        <Th>Student</Th>
                                        <Th>Matric No.</Th>
                                        <Th>Amount</Th>
                                        <Th>Reference</Th>
                                        <Th>Status</Th>
                                        <Th>Hostel Choices</Th>
                                        <Th>Date</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(t => (
                                        <tr key={t.id} className="border-b border-sidebar-border hover:bg-surface/60 transition-colors">
                                            <td className="px-5 py-3.5 font-semibold text-sm text-heading">{t.full_name}</td>
                                            <td className="px-5 py-3.5">
                                                <span className="font-mono text-[11px] font-bold px-2 py-1 rounded-md bg-forest text-white">
                                                    {t.identifier}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-sm font-bold text-heading">₦{t.amount?.toLocaleString()}</td>
                                            <td className="px-5 py-3.5 text-xs font-mono text-muted max-w-[130px] truncate" title={t.reference}>
                                                {t.reference}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[t.status] || STATUS_STYLE.pending}`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-xs text-muted space-y-0.5">
                                                {t.choice_1 && <div>1. {t.choice_1}</div>}
                                                {t.choice_2 && <div>2. {t.choice_2}</div>}
                                                {t.choice_3 && <div>3. {t.choice_3}</div>}
                                            </td>
                                            <td className="px-5 py-3.5 text-xs text-muted whitespace-nowrap">{fmtDate(t.created_at)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="lg:hidden divide-y divide-sidebar-border">
                            {filtered.map(t => (
                                <div key={t.id} className="p-4 space-y-2.5">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-bold text-heading text-sm">{t.full_name}</p>
                                            <span className="inline-flex mt-1 px-2 py-0.5 rounded-md bg-forest text-white text-[10px] font-bold font-mono">
                                                {t.identifier}
                                            </span>
                                        </div>
                                        <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${STATUS_STYLE[t.status] || STATUS_STYLE.pending}`}>
                                            {t.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-heading">₦{t.amount?.toLocaleString()}</span>
                                        <span className="text-xs text-muted">{fmtDate(t.created_at)}</span>
                                    </div>
                                    <p className="text-[11px] font-mono text-muted truncate">Ref: {t.reference}</p>
                                    <p className="text-xs text-muted">{[t.choice_1, t.choice_2, t.choice_3].filter(Boolean).join(' → ')}</p>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Th({ children }) {
    return (
        <th className="px-5 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-[0.15em]">
            {children}
        </th>
    );
}

function SummaryCard({ icon: Icon, label, value, accent }) {
    const styles = {
        forest:  { bg: 'bg-forest/8',  icon: 'text-forest' },
        success: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
        warning: { bg: 'bg-amber-50',   icon: 'text-amber-600' },
    };
    const c = styles[accent] || styles.forest;
    return (
        <div className="glass rounded-xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${c.icon}`} />
            </div>
            <div>
                <p className="text-xl font-black text-heading">{value}</p>
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{label}</p>
            </div>
        </div>
    );
}
