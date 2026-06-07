import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Plus, Pencil, Trash2, DollarSign, CheckCircle, X, AlertCircle, Save } from 'lucide-react';
import { useToast } from '../../components/Toast';

const APPLIES_TO_OPTIONS = [
    { value: 'all',           label: 'All Students' },
    { value: 'fulltime_only', label: 'Full-time Only' },
    { value: 'parttime_only', label: 'Part-time Only' },
    { value: 'codfel_only', label: 'CODFEL Only' },
    { value: 'freshers_only', label: 'Freshers (100L) Only' },
];

const EMPTY_FORM = {
    name: '',
    amount_fulltime: '',
    amount_parttime: '',
    amount_codfel: '',
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

    const totalFulltime = components
        .filter(c => c.applies_to !== 'parttime_only' && c.applies_to !== 'codfel_only')
        .reduce((s, c) => s + (c.amount_fulltime || 0), 0);
    const totalParttime = components
        .filter(c => c.applies_to !== 'fulltime_only' && c.applies_to !== 'codfel_only')
        .reduce((s, c) => s + (c.amount_parttime || 0), 0);
    const totalCodfel = components
        .filter(c => c.applies_to !== 'fulltime_only' && c.applies_to !== 'parttime_only')
        .reduce((s, c) => s + (c.amount_codfel || 0), 0);

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
            amount_codfel: (comp.amount_codfel / 100).toString(),
            applies_to: comp.applies_to,
            is_mandatory: comp.is_mandatory,
            sort_order: comp.sort_order,
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const payload = {
            name: form.name.trim(),
            amount_fulltime: nairaToKobo(form.amount_fulltime),
            amount_parttime: nairaToKobo(form.amount_parttime),
            amount_codfel: nairaToKobo(form.amount_codfel),
            applies_to: form.applies_to,
            is_mandatory: form.is_mandatory,
            sort_order: parseInt(form.sort_order) || 0,
        };
        try {
            if (editingId) {
                await apiClient.put(`/admin/fee-components/${editingId}`, payload);
                toast.success('Fee line updated');
            } else {
                await apiClient.post('/admin/fee-components', payload);
                toast.success('Fee line added');
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
        if (!window.confirm(`Remove "${name}" from the fee structure?`)) return;
        setDeletingId(id);
        try {
            await apiClient.delete(`/admin/fee-components/${id}`);
            toast.success(`"${name}" removed`);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Delete failed');
        } finally {
            setDeletingId(null);
        }
    };

    const cancelForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
    };

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Loading fee structure...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-350">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <p className="text-xs font-bold text-forest-muted uppercase tracking-[0.18em]">Session</p>
                    <h1 className="text-2xl font-extrabold text-heading tracking-tight mt-0.5">Fee Structure Builder</h1>
                    <p className="text-sm text-muted font-medium mt-1">
                        Define each charge for the active session. Every line item adds to the total.
                    </p>
                </div>
                {!showForm && (
                    <button
                        onClick={openCreate}
                        disabled={!session}
                        className="flex items-center gap-2 bg-lime text-forest px-5 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all self-start sm:self-auto shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-5 h-5" />
                        Add Fee Line
                    </button>
                )}
            </div>

            {/* No active session warning */}
            {!session && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-sm font-bold text-amber-800">No active session. Create a session first to manage fees.</p>
                </div>
            )}

            {/* Add / Edit Form */}
            {showForm && (
                <div className="glass rounded-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between bg-surface/50">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-forest" />
                            <h3 className="text-base font-bold text-heading">
                                {editingId ? 'Edit Fee Line' : 'New Fee Line'}
                            </h3>
                        </div>
                        <button onClick={cancelForm} className="p-1.5 text-muted hover:text-heading hover:bg-surface rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6">
                        {/* Line item description */}
                        <div className="mb-5">
                            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">
                                What is this fee for? *
                            </label>
                            <input
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Accommodation, Electricity Levy, Caution Deposit, Security Levy…"
                                required
                                className="w-full glass-input text-heading rounded-xl p-3.5 font-medium text-sm focus:outline-none focus:border-lime"
                            />
                        </div>

                        {/* Amount fields — 3 columns */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                            {[
                                { label: 'Full-time Amount (₦)', key: 'amount_fulltime', required: true },
                                { label: 'Part-time Amount (₦)', key: 'amount_parttime', required: false },
                                { label: 'CODFEL Amount (₦)',  key: 'amount_codfel', required: false },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">
                                        {f.label} {f.required ? '*' : <span className="text-muted/50">(optional)</span>}
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">₦</span>
                                        <input
                                            type="number" min="0" step="0.01"
                                            value={form[f.key]}
                                            onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                            placeholder="0.00"
                                            required={f.required}
                                            className="w-full glass-input text-heading rounded-xl p-3.5 pl-7 font-medium text-sm focus:outline-none focus:border-lime"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Bottom row: applies-to + mandatory + save */}
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5">Applies To</label>
                                <select
                                    value={form.applies_to}
                                    onChange={e => setForm(f => ({ ...f, applies_to: e.target.value }))}
                                    className="w-full glass-input text-heading rounded-xl p-3.5 font-medium text-sm focus:outline-none focus:border-lime"
                                >
                                    {APPLIES_TO_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-3 pb-1">
                                <input
                                    type="checkbox" id="is_mandatory"
                                    checked={form.is_mandatory}
                                    onChange={e => setForm(f => ({ ...f, is_mandatory: e.target.checked }))}
                                    className="w-4 h-4 accent-lime rounded"
                                />
                                <label htmlFor="is_mandatory" className="text-sm font-bold text-heading cursor-pointer whitespace-nowrap">
                                    Mandatory charge
                                </label>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex items-center gap-2 bg-lime text-forest px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-lime/25 transition-all ${submitting ? 'opacity-60' : 'hover:bg-lime-hover'}`}
                                >
                                    <Save className="w-4 h-4" />
                                    {submitting ? 'Saving…' : editingId ? 'Update' : 'Add to Fee'}
                                </button>
                                <button type="button" onClick={cancelForm}
                                    className="px-5 py-3.5 rounded-xl font-bold bg-surface text-heading hover:bg-black/5 transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Fee Table */}
            <div className="glass rounded-2xl overflow-hidden">
                {/* Table header */}
                <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
                    <h3 className="text-base font-bold text-heading flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted" />
                        Fee Structure
                        <span className="text-xs font-bold text-muted bg-surface px-2 py-0.5 rounded-full">
                            {components.length} {components.length === 1 ? 'line' : 'lines'}
                        </span>
                    </h3>
                    {session && (
                        <span className="text-xs font-bold text-forest bg-lime-soft border border-lime-border px-3 py-1 rounded-full">
                            {session.session_name}
                        </span>
                    )}
                </div>

                {components.length === 0 ? (
                    <div className="p-14 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-4">
                            <DollarSign className="w-7 h-7 text-muted/40" />
                        </div>
                        <p className="text-heading font-bold text-base">No fee lines yet</p>
                        <p className="text-sm text-muted mt-1 max-w-xs mx-auto">
                            Start building by clicking "Add Fee Line". Add items like Accommodation, Electricity Levy, Caution Deposit…
                        </p>
                        {session && (
                            <button onClick={openCreate}
                                className="mt-5 inline-flex items-center gap-2 bg-lime text-forest px-5 py-2.5 rounded-full font-bold text-sm hover:bg-lime-hover transition-colors">
                                <Plus className="w-4 h-4" /> Add First Fee Line
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm min-w-[700px]">
                                <thead>
                                    <tr className="bg-surface border-b border-black/5">
                                        <th className="px-5 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-widest">#</th>
                                        <th className="px-5 py-3 text-left text-[10px] font-bold text-muted uppercase tracking-widest">Description / Charge</th>
                                        <th className="px-5 py-3 text-right text-[10px] font-bold text-muted uppercase tracking-widest">Full-time</th>
                                        <th className="px-5 py-3 text-right text-[10px] font-bold text-muted uppercase tracking-widest">Part-time</th>
                                        <th className="px-5 py-3 text-right text-[10px] font-bold text-muted uppercase tracking-widest">CODFEL</th>
                                        <th className="px-5 py-3 text-center text-[10px] font-bold text-muted uppercase tracking-widest">Applies To</th>
                                        <th className="px-5 py-3 text-center text-[10px] font-bold text-muted uppercase tracking-widest">Type</th>
                                        <th className="px-5 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5">
                                    {components.map((c, idx) => (
                                        <tr key={c.id} className="hover:bg-surface/40 transition-colors group">
                                            <td className="px-5 py-3.5 text-xs font-bold text-muted/50">{idx + 1}</td>
                                            <td className="px-5 py-3.5">
                                                <p className="font-bold text-heading">{c.name}</p>
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-bold text-heading">₦{koboToNaira(c.amount_fulltime)}</td>
                                            <td className="px-5 py-3.5 text-right font-medium text-body">₦{koboToNaira(c.amount_parttime)}</td>
                                            <td className="px-5 py-3.5 text-right font-medium text-body">₦{koboToNaira(c.amount_codfel)}</td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className="text-[10px] font-bold bg-forest/8 text-forest px-2.5 py-1 rounded-full">
                                                    {APPLIES_TO_OPTIONS.find(o => o.value === c.applies_to)?.label || c.applies_to}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                {c.is_mandatory
                                                    ? <span className="text-[10px] font-bold bg-lime/10 text-lime px-2.5 py-1 rounded-full">Mandatory</span>
                                                    : <span className="text-[10px] font-bold bg-black/5 text-muted px-2.5 py-1 rounded-full">Optional</span>
                                                }
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openEdit(c)}
                                                        className="p-1.5 rounded-lg text-muted hover:text-heading hover:bg-surface transition-colors" title="Edit">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => handleDelete(c.id, c.name)}
                                                        disabled={deletingId === c.id}
                                                        className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-colors" title="Remove">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>

                                {/* Totals footer */}
                                <tfoot>
                                    <tr className="border-t-2 border-forest/20 bg-forest/5">
                                        <td className="px-5 py-4 text-xs font-black text-muted/50">{components.length}</td>
                                        <td className="px-5 py-4 font-black text-heading text-sm">TOTAL</td>
                                        <td className="px-5 py-4 text-right">
                                            <p className="text-lg font-black text-heading">₦{koboToNaira(totalFulltime)}</p>
                                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Full-time</p>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <p className="text-lg font-black text-heading">₦{koboToNaira(totalParttime)}</p>
                                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Part-time</p>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <p className="text-lg font-black text-heading">₦{koboToNaira(totalCodfel)}</p>
                                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">CODFEL</p>
                                        </td>
                                        <td colSpan={3}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-black/5">
                            {components.map((c, idx) => (
                                <div key={c.id} className="p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-muted/50">#{idx + 1}</span>
                                                <p className="font-bold text-heading">{c.name}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                <span className="text-[10px] font-bold bg-forest/8 text-forest px-2 py-0.5 rounded-full">
                                                    {APPLIES_TO_OPTIONS.find(o => o.value === c.applies_to)?.label || c.applies_to}
                                                </span>
                                                {c.is_mandatory
                                                    ? <span className="text-[10px] font-bold bg-lime/10 text-lime px-2 py-0.5 rounded-full">Mandatory</span>
                                                    : <span className="text-[10px] font-bold bg-black/5 text-muted px-2 py-0.5 rounded-full">Optional</span>
                                                }
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={() => openEdit(c)} className="p-2 rounded-lg text-muted hover:text-heading hover:bg-surface transition-colors">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDelete(c.id, c.name)} disabled={deletingId === c.id}
                                                className="p-2 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { label: 'Full-time', val: c.amount_fulltime },
                                            { label: 'Part-time', val: c.amount_parttime },
                                            { label: 'CODFEL',  val: c.amount_codfel },
                                        ].map(r => (
                                            <div key={r.label} className="bg-surface rounded-xl p-2.5 text-center">
                                                <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{r.label}</p>
                                                <p className="text-sm font-black text-heading mt-0.5">₦{koboToNaira(r.val)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Mobile totals */}
                            <div className="p-4 bg-forest/5 border-t-2 border-forest/20">
                                <p className="text-xs font-black text-heading uppercase tracking-widest mb-3">Total Fee</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: 'Full-time', val: totalFulltime },
                                        { label: 'Part-time', val: totalParttime },
                                        { label: 'CODFEL',  val: totalCodfel },
                                    ].map(r => (
                                        <div key={r.label} className="bg-white/70 rounded-xl p-3 text-center">
                                            <p className="text-[9px] font-bold text-muted uppercase tracking-widest">{r.label}</p>
                                            <p className="text-base font-black text-heading mt-0.5">₦{koboToNaira(r.val)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
