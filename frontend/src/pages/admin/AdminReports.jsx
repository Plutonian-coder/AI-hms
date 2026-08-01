import { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';
import {
    FileBarChart, Download, Eye, ChevronDown, ChevronRight, Plus, X, Filter
} from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function AdminReports() {
    const [catalogue, setCatalogue] = useState(null);
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [filters, setFilters] = useState({});
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [expandedFilterCats, setExpandedFilterCats] = useState({});
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const [expandedColCats, setExpandedColCats] = useState({});
    const pickerRef = useRef(null);
    const toast = useToast();

    useEffect(() => {
        apiClient.get('/admin/reports/catalogue')
            .then(res => {
                setCatalogue(res.data);
                // Expand all filter categories by default
                const fExpanded = {};
                Object.keys(res.data.filters).forEach(k => fExpanded[k] = true);
                setExpandedFilterCats(fExpanded);
                // Expand all column categories by default in picker
                const cExpanded = {};
                Object.keys(res.data.columns).forEach(k => cExpanded[k] = true);
                setExpandedColCats(cExpanded);
            })
            .catch(() => toast.error('Failed to load report catalogue'))
            .finally(() => setLoading(false));
    }, []);

    // Close column picker when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                setShowColumnPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleFilterCat = (key) => setExpandedFilterCats(prev => ({ ...prev, [key]: !prev[key] }));
    const toggleColCat = (key) => setExpandedColCats(prev => ({ ...prev, [key]: !prev[key] }));

    const addColumn = (colExpr) => {
        setSelectedColumns(prev =>
            prev.includes(colExpr) ? prev : [...prev, colExpr]
        );
    };

    const removeColumn = (colExpr) => {
        setSelectedColumns(prev => prev.filter(c => c !== colExpr));
        setPreview(null);
    };

    const updateFilter = (key, value) => {
        setFilters(prev => {
            const next = { ...prev };
            if (value === '' || value === null) delete next[key];
            else next[key] = value;
            return next;
        });
        setPreview(null);
    };

    // Build a flat map: colExpr → label for displaying chip labels
    const colLabelMap = {};
    if (catalogue) {
        Object.values(catalogue.columns).forEach(cat => {
            Object.entries(cat.columns).forEach(([expr, label]) => {
                colLabelMap[expr] = label;
            });
        });
    }

    const generatePreview = async () => {
        if (selectedColumns.length === 0) { toast.error('Add at least one column'); return; }
        setGenerating(true);
        try {
            const res = await apiClient.post('/admin/reports/preview', {
                columns: selectedColumns, filters, limit: 50,
            });
            setPreview(res.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to generate preview');
        } finally {
            setGenerating(false);
        }
    };

    const exportCSV = async () => {
        if (selectedColumns.length === 0) { toast.error('Add at least one column'); return; }
        setExporting(true);
        try {
            const res = await apiClient.post('/admin/reports/export', {
                columns: selectedColumns, filters,
            }, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'fuoye_report.csv';
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('Report exported successfully');
        } catch (err) {
            toast.error('Failed to export report');
        } finally {
            setExporting(false);
        }
    };

    const exportPDF = async () => {
        if (selectedColumns.length === 0) { toast.error('Add at least one column'); return; }
        try {
            let rows = preview ? preview.rows : null;
            if (!rows) {
                const res = await apiClient.post('/admin/reports/preview', {
                    columns: selectedColumns, filters, limit: 500
                });
                rows = res.data.rows;
            }

            const headers = selectedColumns.map(c => colLabelMap[c] || c);
            const win = window.open('', '_blank');
            win.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Official Senate Hostel Allocation Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
                        .header { text-align: center; border-bottom: 3px double #1B4332; padding-bottom: 15px; margin-bottom: 20px; }
                        .header h1 { font-size: 18px; margin: 0; color: #1B4332; text-transform: uppercase; letter-spacing: 1px; }
                        .header h2 { font-size: 14px; margin: 6px 0 0 0; color: #333; }
                        .meta { display: flex; justify-content: space-between; font-size: 11px; color: #555; margin-bottom: 15px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                        th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
                        th { background-color: #e8f5e9; color: #1B4332; font-weight: bold; text-transform: uppercase; font-size: 10px; }
                        tr:nth-child(even) { background-color: #f9f9f9; }
                        .footer { margin-top: 40px; text-align: right; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
                        @media print { body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Federal University Oye-Ekiti</h1>
                        <h2>Student Affairs Division — Official Senate Hostel Allocation Report</h2>
                    </div>
                    <div class="meta">
                        <span>GENERATED AT: ${new Date().toLocaleString()}</span>
                        <span>TOTAL RECORDS: ${rows.length}</span>
                        <span>CONFIDENTIALITY: OFFICIAL SENATE RECORD</span>
                    </div>
                    <table>
                        <thead>
                            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${rows.map(r => `<tr>${selectedColumns.map(c => `<td>${r[c] !== null && r[c] !== undefined ? r[c] : '—'}</td>`).join('')}</tr>`).join('')}
                        </tbody>
                    </table>
                    <div class="footer">
                        <p>Certified & Signed: ___________________________ (Dean of Student Affairs)</p>
                    </div>
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
                </html>
            `);
            win.document.close();
            toast.success('Official Senate PDF Report ready for print / export');
        } catch (err) {
            toast.error('Failed to generate PDF report');
        }
    };

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Loading Report Builder...</div>;
    if (!catalogue) return <div className="text-muted p-8">Failed to load catalogue.</div>;

    return (
        <div className="animate-in fade-in duration-350">
            {/* Page header */}
            <div className="mb-5">
                <h1 className="text-2xl font-extrabold text-heading tracking-tight">Report Builder</h1>
                <p className="text-muted mt-1 font-medium text-sm">Pick filters, build your columns, then preview or export.</p>
            </div>

            {/* Main layout: filter sub-sidebar + content area */}
            <div className="flex gap-4 items-start">

                {/* ── Filter sub-sidebar ──────────────────────────────────── */}
                <aside className="w-56 shrink-0 glass rounded-2xl overflow-hidden self-start sticky top-20">
                    <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-muted" />
                        <span className="text-xs font-bold text-heading uppercase tracking-widest">Filters</span>
                        {Object.keys(filters).length > 0 && (
                            <button
                                onClick={() => { setFilters({}); setPreview(null); }}
                                className="ml-auto text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="p-3 space-y-2 max-h-[75vh] overflow-y-auto scrollbar-thin">
                        {Object.entries(catalogue.filters).map(([catKey, cat]) => (
                            <div key={catKey} className="border border-black/5 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleFilterCat(catKey)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-surface/50 hover:bg-surface transition-colors"
                                >
                                    <span className="text-[10px] font-bold text-heading uppercase tracking-widest">{cat.label}</span>
                                    {expandedFilterCats[catKey]
                                        ? <ChevronDown className="w-3 h-3 text-muted" />
                                        : <ChevronRight className="w-3 h-3 text-muted" />}
                                </button>
                                {expandedFilterCats[catKey] && (
                                    <div className="p-2.5 space-y-2">
                                        {Object.entries(cat.filters).map(([fKey, fDef]) => (
                                            <div key={fKey}>
                                                <label className="block text-[9px] font-bold text-muted uppercase tracking-widest mb-1">{fDef.label}</label>
                                                {fDef.type === 'select' && fDef.options ? (
                                                    <select
                                                        value={filters[fKey] || ''}
                                                        onChange={e => updateFilter(fKey, e.target.value)}
                                                        className="w-full glass-input text-heading rounded-lg px-2 py-1.5 text-xs font-medium"
                                                    >
                                                        <option value="">All</option>
                                                        {fDef.options.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                ) : fDef.type === 'date' ? (
                                                    <input
                                                        type="date"
                                                        value={filters[fKey] || ''}
                                                        onChange={e => updateFilter(fKey, e.target.value)}
                                                        className="w-full glass-input text-heading rounded-lg px-2 py-1.5 text-xs font-medium"
                                                    />
                                                ) : fDef.type === 'number' ? (
                                                    <input
                                                        type="number"
                                                        value={filters[fKey] || ''}
                                                        onChange={e => updateFilter(fKey, e.target.value)}
                                                        placeholder="0"
                                                        className="w-full glass-input text-heading rounded-lg px-2 py-1.5 text-xs font-medium"
                                                    />
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={filters[fKey] || ''}
                                                        onChange={e => updateFilter(fKey, e.target.value)}
                                                        placeholder={`Filter…`}
                                                        className="w-full glass-input text-heading rounded-lg px-2 py-1.5 text-xs font-medium"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </aside>

                {/* ── Main content area ───────────────────────────────────── */}
                <div className="flex-1 min-w-0 space-y-4">

                    {/* Column chips bar */}
                    <div className="glass rounded-2xl p-4 relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-bold text-heading uppercase tracking-widest">Columns</span>
                            {selectedColumns.length > 0 && (
                                <span className="text-xs font-bold text-lime bg-lime/10 px-2 py-0.5 rounded-full">
                                    {selectedColumns.length}
                                </span>
                            )}
                        </div>

                        {/* Chips + add button */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {selectedColumns.map(expr => (
                                <div
                                    key={expr}
                                    className="flex items-center gap-1.5 bg-forest text-white text-xs font-semibold px-3 py-1.5 rounded-full"
                                >
                                    <span>{colLabelMap[expr] || expr}</span>
                                    <button
                                        onClick={() => removeColumn(expr)}
                                        className="hover:text-red-300 transition-colors ml-0.5"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}

                            {/* + Add Column button with dropdown */}
                            <div className="relative" ref={pickerRef}>
                                <button
                                    onClick={() => setShowColumnPicker(v => !v)}
                                    className="flex items-center gap-1.5 border-2 border-dashed border-forest/30 hover:border-forest/60 text-forest/60 hover:text-forest text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Column
                                </button>

                                {showColumnPicker && (
                                    <div className="absolute left-0 top-full mt-2 w-72 glass-elevated rounded-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-200 shadow-xl">
                                        <div className="px-4 py-3 border-b border-black/5">
                                            <p className="text-xs font-bold text-heading">Select columns to include</p>
                                        </div>
                                        <div className="p-3 space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                                            {Object.entries(catalogue.columns).map(([catKey, cat]) => (
                                                <div key={catKey} className="border border-black/5 rounded-xl overflow-hidden">
                                                    <button
                                                        onClick={() => toggleColCat(catKey)}
                                                        className="w-full flex items-center justify-between px-3 py-2 bg-surface/50 hover:bg-surface transition-colors"
                                                    >
                                                        <span className="text-[10px] font-bold text-heading uppercase tracking-widest">{cat.label}</span>
                                                        {expandedColCats[catKey]
                                                            ? <ChevronDown className="w-3 h-3 text-muted" />
                                                            : <ChevronRight className="w-3 h-3 text-muted" />}
                                                    </button>
                                                    {expandedColCats[catKey] && (
                                                        <div className="p-1.5 space-y-0.5">
                                                            {Object.entries(cat.columns).map(([colExpr, colLabel]) => {
                                                                const selected = selectedColumns.includes(colExpr);
                                                                return (
                                                                    <button
                                                                        key={colExpr}
                                                                        onClick={() => { addColumn(colExpr); }}
                                                                        disabled={selected}
                                                                        className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${selected
                                                                            ? 'text-lime font-bold bg-lime/10 cursor-default'
                                                                            : 'text-heading hover:bg-surface/70 cursor-pointer'
                                                                            }`}
                                                                    >
                                                                        {selected && <span className="text-lime">✓</span>}
                                                                        {colLabel}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {selectedColumns.length > 0 && (
                                <button
                                    onClick={() => { setSelectedColumns([]); setPreview(null); }}
                                    className="text-[10px] font-bold text-muted hover:text-red-500 transition-colors ml-1"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-black/5">
                            <button
                                onClick={generatePreview}
                                disabled={generating || selectedColumns.length === 0}
                                className={`flex items-center gap-2 bg-forest text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-md transition-all ${generating || selectedColumns.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-forest-hover hover:shadow-lg'}`}
                            >
                                <Eye className="w-4 h-4" />
                                {generating ? 'Generating…' : 'Generate Preview'}
                            </button>
                            <button
                                onClick={exportPDF}
                                disabled={selectedColumns.length === 0}
                                className={`flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-md transition-all ${selectedColumns.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700 hover:shadow-lg'}`}
                            >
                                <FileBarChart className="w-4 h-4" />
                                Download Official PDF
                            </button>
                            <button
                                onClick={exportCSV}
                                disabled={exporting || selectedColumns.length === 0}
                                className={`flex items-center gap-2 bg-lime text-forest px-5 py-2.5 rounded-full text-sm font-bold shadow-md transition-all ${exporting || selectedColumns.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-lime-hover hover:shadow-lg'}`}
                            >
                                <Download className="w-4 h-4" />
                                {exporting ? 'Exporting…' : 'Export CSV'}
                            </button>
                        </div>
                    </div>

                    {/* Preview table */}
                    <div className="glass rounded-2xl overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-black/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-heading flex items-center gap-2">
                                <FileBarChart className="w-4 h-4 text-muted" />
                                Preview
                            </h3>
                            {preview && (
                                <span className="text-xs text-muted font-medium">
                                    Showing {preview.showing} of {preview.total} rows
                                </span>
                            )}
                        </div>

                        {!preview ? (
                            <div className="py-16 text-center text-muted">
                                <FileBarChart className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p className="font-semibold text-sm">No preview yet</p>
                                <p className="text-xs mt-1">Add columns and click Generate Preview</p>
                            </div>
                        ) : preview.error ? (
                            <div className="p-6 text-center text-red-600 font-medium text-sm">{preview.error}</div>
                        ) : (
                            <>
                                <div className="overflow-x-auto w-full">
                                    <table className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-surface/60">
                                                {preview.columns.map((col, i) => (
                                                    <th
                                                        key={i}
                                                        className="px-4 py-3 text-left font-bold text-muted uppercase tracking-widest whitespace-nowrap border-b border-black/5"
                                                    >
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.rows.map((row, i) => (
                                                <tr
                                                    key={i}
                                                    className={`border-b border-black/[0.04] transition-colors ${i % 2 === 0 ? '' : 'bg-surface/30'} hover:bg-lime/5`}
                                                >
                                                    {row.map((cell, j) => (
                                                        <td
                                                            key={j}
                                                            className="px-4 py-2.5 text-heading font-medium whitespace-nowrap"
                                                        >
                                                            {cell ?? <span className="text-muted italic">—</span>}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Aggregates */}
                                {preview.aggregates && Object.keys(preview.aggregates).length > 0 && (
                                    <div className="border-t border-forest/10 px-5 py-3 bg-forest/5 flex flex-wrap gap-6">
                                        {Object.entries(preview.aggregates).map(([key, value]) => (
                                            <div key={key} className="flex items-center gap-2 text-xs">
                                                <span className="font-medium text-muted">{key}</span>
                                                <span className="font-bold text-heading">{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
