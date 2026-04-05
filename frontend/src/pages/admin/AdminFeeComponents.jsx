import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Plus, Pencil, Trash2, DollarSign, CheckCircle, X, AlertCircle } from 'lucide-react';
import { useToast } from '../../components/Toast';

const APPLIES_TO_OPTIONS = [
    { value: 'all', label: 'All Students' },
    { value: 'fulltime_only', label: 'Full-time Only' },
    { value: 'parttime_only', label: 'Part-time Only' },
    { value: 'sandwich_only', label: 'Sandwich Only' },
    { value: 'freshers_only', label: 'Freshers (100L) Only' },
];

const EMPTY_FORM = {
    name: '',
    amount_fulltime: '',
    amount_parttime: '',
    amount_sandwich: '',
    applies_to: 'all',
    is_mandatory: true,
    sort_order: 0,
};

function koboToNaira(k) {
    return k ? (k / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 }) : '0.00';
}
function nairaToKobo(n) {
    return Math.round(parseFloat(n || 0) * 100);
}

export default function AdminFeeComponents() {
    const [components, setComponents] = useState([]);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const toast = useToast();

    const fetchData = () => {
        Promise.all([
            apiClient.get('/admin/fee-components'),
            apiClient.get('/admin/sessions'),
        ])
            .then(([feeRes, sessionsRes]) => {
                setComponents(feeRes.data);
                const active = sessionsRes.data.find(s => s.is_active) || null;
                setSession(active);
            })
            .catch(() => toast.error('Failed to load fee data'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    const totalFulltime = components.filter(c => c.applies_to !== 'parttime_only' && c.applies_to !== 'sandwich_only').reduce((s, c) => s + (c.amount_fulltime || 0), 0);
    const totalParttime = components.filter(c => c.applies_to !== 'fulltime_only' && c.applies_to !== 'sandwich_only').reduce((s, c) => s + (c.amount_parttime || 0), 0);
    const totalSandwich = components.filter(c => c.applies_to !== 'fulltime_only' && c.applies_to !== 'parttime_only').reduce((s, c) => s + (c.amount_sandwich || 0), 0);

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...EMPTY_FORM, sort_order: components.length });
        setShowForm(true);
    };

    const openEdit = (comp) => {
        setEditingId(comp.id);
        setForm({
            name: comp.name,
            amount_fulltime: (comp.amount_fulltime / 100).toString(),
            amount_parttime: (comp.amount_parttime / 100).toString(),
            amount_sandwich: (comp.amount_sandwich / 100).toString(),
            applies_to: comp.applies_to,
            is_mandatory: comp.is_mandatory,
            sort_order: comp.sort_order,
        });
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const payload = {
            name: form.name.trim(),
            amount_fulltime: nairaToKobo(form.amount_fulltime),
            amount_parttime: nairaToKobo(form.amount_parttime),
            amount_sandwich: nairaToKobo(form.amount_sandwich),
            applies_to: form.applies_to,
            is_mandatory: form.is_mandatory,
            sort_order: parseInt(form.sort_order) || 0,
        };
        try {
            if (editingId) {
                await apiClient.put(`/admin/fee-components/${editingId}`, payload);
                toast.success('Fee component updated');
            } else {
                await apiClient.post('/admin/fee-components', payload);
                toast.success('Fee component created');
            }
            setShowForm(false);
            setForm(EMPTY_FORM);
            setEditingId(null);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Save failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete fee component "${name}"? This cannot be undone.`)) return;
        setDeletingId(id);
        try {
            await apiClient.delete(`/admin/fee-components/${id}`);
            toast.success(`"${name}" deleted`);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Delete failed');
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Loading fee components...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-350">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-heading tracking-tight">Fee Management</h1>
                    <p className="text-muted mt-2 font-medium">
                        Define hostel fee components per study type for the active session.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-lime text-forest px-5 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all shrink-0"
                >
                    <Plus className="w-5 h-5" />
                    Add Component
                </button>
            </div>

            {/* Active session badge */}
            {session ? (
                <div className="bg-forest px-6 py-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Active Session</p>
                        <p className="text-white text-lg font-bold mt-0.5">{session.session_name}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Full-time Total', value: totalFulltime },
                            { label: 'Part-time Total', value: totalParttime },
                            { label: 'Sandwich Total', value: totalSandwich },
                        ].map(t => (
                            <div key={t.label} className="bg-white/10 rounded-xl px-4 py-2.5 text-center">
                                <p className="text-lime font-black text-base">₦{koboToNaira(t.value)}</p>
                                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-0.5">{t.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-sm font-bold text-amber-800">No active session. Create a session first to manage fees.</p>
                </div>
            )}

            {/* Add/Edit Form */}
            {showForm && (
                <div className="glass rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-muted" />
                            {editingId ? 'Edit Fee Component' : 'New Fee Component'}
                        </h3>
                        <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }} className="text-muted hover:text-heading transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Component Name *</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Accommodation, Electricity Levy, Caution Deposit"
                                    required
                                    className="w-full glass-input text-heading rounded-xl p-3 font-medium text-sm focus:outline-none focus:border-lime"
                                />
                            </div>

                            {/* Amounts */}
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Full-time Amount (₦) *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">₦</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.amount_fulltime}
                                        onChange={e => setForm(f => ({ ...f, amount_fulltime: e.target.value }))}
                                        placeholder="0.00"
                                        required
                                        className="w-full glass-input text-heading rounded-xl p-3 pl-7 font-medium text-sm focus:outline-none focus:border-lime"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Part-time Amount (₦)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">₦</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.amount_parttime}
                                        onChange={e => setForm(f => ({ ...f, amount_parttime: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full glass-input text-heading rounded-xl p-3 pl-7 font-medium text-sm focus:outline-none focus:border-lime"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Sandwich Amount (₦)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">₦</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.amount_sandwich}
                                        onChange={e => setForm(f => ({ ...f, amount_sandwich: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full glass-input text-heading rounded-xl p-3 pl-7 font-medium text-sm focus:outline-none focus:border-lime"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Applies To</label>
                                <select
                                    value={form.applies_to}
                                    onChange={e => setForm(f => ({ ...f, applies_to: e.target.value }))}
                                    className="w-full glass-input text-heading rounded-xl p-3 font-medium text-sm focus:outline-none focus:border-lime"
                                >
                                    {APPLIES_TO_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Sort Order</label>
                                <input
                                    type="number"
                                    value={form.sort_order}
                                    onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                                    placeholder="0"
                                    className="w-full glass-input text-heading rounded-xl p-3 font-medium text-sm focus:outline-none focus:border-lime"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_mandatory"
                                    checked={form.is_mandatory}
                                    onChange={e => setForm(f => ({ ...f, is_mandatory: e.target.checked }))}
                                    className="w-4 h-4 accent-lime"
                                />
                                <label htmlFor="is_mandatory" className="text-sm font-bold text-heading cursor-pointer">
                                    Mandatory fee (cannot be waived)
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={submitting || !session}
                                className={`flex items-center gap-2 bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 transition-all ${submitting || !session ? 'opacity-60' : 'hover:bg-lime-hover hover:scale-[1.02]'}`}
                            >
                                <CheckCircle className="w-4 h-4" />
                                {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Component'}
                            </button>
                            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
                                className="px-6 py-3 rounded-full font-bold bg-surface text-heading hover:bg-black/5 transition-colors">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Fee Components Table */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-muted" />
                        Fee Components ({components.length})
                    </h3>
                </div>

                {components.length === 0 ? (
                    <div className="p-12 text-center">
                        <DollarSign className="w-10 h-10 text-black/10 mx-auto mb-3" />
                        <p className="text-muted font-medium">No fee components yet for this session.</p>
                        <p className="text-sm text-muted mt-1">Add components like Accommodation, Electricity Levy, Caution Deposit, etc.</p>
                        <button onClick={openCreate} className="mt-4 bg-lime text-forest px-5 py-2.5 rounded-full font-bold text-sm hover:bg-lime-hover transition-colors">
                            Add First Component
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-surface">
                                <tr>
                                    <th className="px-5 py-3.5 text-left font-bold text-muted uppercase tracking-widest text-[10px]">Component</th>
                                    <th className="px-5 py-3.5 text-right font-bold text-muted uppercase tracking-widest text-[10px]">Full-time</th>
                                    <th className="px-5 py-3.5 text-right font-bold text-muted uppercase tracking-widest text-[10px]">Part-time</th>
                                    <th className="px-5 py-3.5 text-right font-bold text-muted uppercase tracking-widest text-[10px]">Sandwich</th>
                                    <th className="px-5 py-3.5 text-center font-bold text-muted uppercase tracking-widest text-[10px]">Applies To</th>
                                    <th className="px-5 py-3.5 text-center font-bold text-muted uppercase tracking-widest text-[10px]">Mandatory</th>
                                    <th className="px-5 py-3.5 text-right font-bold text-muted uppercase tracking-widest text-[10px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                                {components.map((c) => (
                                    <tr key={c.id} className="hover:bg-surface/40 transition-colors">
                                        <td className="px-5 py-4">
                                            <p className="font-bold text-heading">{c.name}</p>
                                            <p className="text-[10px] text-muted font-medium mt-0.5">Order: {c.sort_order}</p>
                                        </td>
                                        <td className="px-5 py-4 text-right font-bold text-heading">₦{koboToNaira(c.amount_fulltime)}</td>
                                        <td className="px-5 py-4 text-right font-bold text-heading">₦{koboToNaira(c.amount_parttime)}</td>
                                        <td className="px-5 py-4 text-right font-bold text-heading">₦{koboToNaira(c.amount_sandwich)}</td>
                                        <td className="px-5 py-4 text-center">
                                            <span className="text-[10px] font-bold bg-forest/10 text-forest px-2.5 py-1 rounded-full">
                                                {APPLIES_TO_OPTIONS.find(o => o.value === c.applies_to)?.label || c.applies_to}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            {c.is_mandatory
                                                ? <span className="text-[10px] font-bold bg-lime/10 text-lime px-2.5 py-1 rounded-full">Yes</span>
                                                : <span className="text-[10px] font-bold bg-black/5 text-muted px-2.5 py-1 rounded-full">No</span>
                                            }
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEdit(c)}
                                                    className="p-2 rounded-lg text-muted hover:text-heading hover:bg-surface transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(c.id, c.name)}
                                                    disabled={deletingId === c.id}
                                                    className="p-2 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {/* Totals footer */}
                            <tfoot className="bg-forest/5 border-t border-black/10">
                                <tr>
                                    <td className="px-5 py-3 font-black text-heading text-sm">TOTAL</td>
                                    <td className="px-5 py-3 text-right font-black text-heading">₦{koboToNaira(totalFulltime)}</td>
                                    <td className="px-5 py-3 text-right font-black text-heading">₦{koboToNaira(totalParttime)}</td>
                                    <td className="px-5 py-3 text-right font-black text-heading">₦{koboToNaira(totalSandwich)}</td>
                                    <td colSpan={3}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
