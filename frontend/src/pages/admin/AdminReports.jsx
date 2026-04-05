import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { FileBarChart, Download, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function AdminReports() {
    const [catalogue, setCatalogue] = useState(null);
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [filters, setFilters] = useState({});
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState({});
    const toast = useToast();

    useEffect(() => {
        apiClient.get('/admin/reports/catalogue')
            .then(res => {
                setCatalogue(res.data);
                // Expand all categories by default
                const expanded = {};
                Object.keys(res.data.columns).forEach(k => expanded[`col_${k}`] = true);
                Object.keys(res.data.filters).forEach(k => expanded[`fil_${k}`] = true);
                setExpandedCategories(expanded);
            })
            .catch(() => toast.error('Failed to load report catalogue'))
            .finally(() => setLoading(false));
    }, []);

    const toggleCategory = (key) => {
        setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleColumn = (colExpr) => {
        setSelectedColumns(prev =>
            prev.includes(colExpr) ? prev.filter(c => c !== colExpr) : [...prev, colExpr]
        );
    };

    const updateFilter = (key, value) => {
        setFilters(prev => {
            const next = { ...prev };
            if (value === '' || value === null) delete next[key];
            else next[key] = value;
            return next;
        });
    };

    const generatePreview = async () => {
        if (selectedColumns.length === 0) {
            toast.error('Select at least one column');
            return;
        }
        setGenerating(true);
        try {
            const res = await apiClient.post('/admin/reports/preview', {
                columns: selectedColumns,
                filters,
                limit: 50,
            });
            setPreview(res.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to generate preview');
        } finally {
            setGenerating(false);
        }
    };

    const exportCSV = async () => {
        if (selectedColumns.length === 0) {
            toast.error('Select at least one column');
            return;
        }
        setExporting(true);
        try {
            const res = await apiClient.post('/admin/reports/export', {
                columns: selectedColumns,
                filters,
            }, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'hms_report.csv';
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success('Report exported successfully');
        } catch (err) {
            toast.error('Failed to export report');
        } finally {
            setExporting(false);
        }
    };

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Loading Report Builder...</div>;
    if (!catalogue) return <div className="text-muted p-8">Failed to load catalogue.</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-350">
            <div>
                <h1 className="text-2xl font-extrabold text-heading tracking-tight">Report Builder</h1>
                <p className="text-muted mt-2 font-medium">Construct custom data extracts with filters and column selection.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Filters */}
                <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-black/5">
                        <h3 className="text-base font-bold text-heading flex items-center gap-2">
                            <FileBarChart className="w-4 h-4 text-muted" />
                            Filters
                        </h3>
                    </div>
                    <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
                        {Object.entries(catalogue.filters).map(([catKey, cat]) => (
                            <div key={catKey} className="border border-black/5 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleCategory(`fil_${catKey}`)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 bg-surface/50 hover:bg-surface transition-colors"
                                >
                                    <span className="text-xs font-bold text-heading uppercase tracking-widest">{cat.label}</span>
                                    {expandedCategories[`fil_${catKey}`] ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-muted" />
                                    ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-muted" />
                                    )}
                                </button>
                                {expandedCategories[`fil_${catKey}`] && (
                                    <div className="p-3 space-y-2.5">
                                        {Object.entries(cat.filters).map(([fKey, fDef]) => (
                                            <div key={fKey}>
                                                <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1">{fDef.label}</label>
                                                {fDef.type === 'select' && fDef.options ? (
                                                    <select
                                                        value={filters[fKey] || ''}
                                                        onChange={e => updateFilter(fKey, e.target.value)}
                                                        className="w-full glass-input text-heading rounded-lg p-2 text-xs font-medium"
                                                    >
                                                        <option value="">All</option>
                                                        {fDef.options.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                ) : fDef.type === 'date' ? (
                                                    <input
                                                        type="date"
                                                        value={filters[fKey] || ''}
                                                        onChange={e => updateFilter(fKey, e.target.value)}
                                                        className="w-full glass-input text-heading rounded-lg p-2 text-xs font-medium"
                                                    />
                                                ) : fDef.type === 'number' ? (
                                                    <input
                                                        type="number"
                                                        value={filters[fKey] || ''}
                                                        onChange={e => updateFilter(fKey, e.target.value)}
                                                        placeholder="0"
                                                        className="w-full glass-input text-heading rounded-lg p-2 text-xs font-medium"
                                                    />
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={filters[fKey] || ''}
                                                        onChange={e => updateFilter(fKey, e.target.value)}
                                                        placeholder={`Search ${fDef.label.toLowerCase()}`}
                                                        className="w-full glass-input text-heading rounded-lg p-2 text-xs font-medium"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Middle: Column Selection */}
                <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-black/5">
                        <h3 className="text-base font-bold text-heading">
                            Columns
                            <span className="ml-2 text-xs font-bold text-lime bg-lime/10 px-2 py-0.5 rounded-full">
                                {selectedColumns.length} selected
                            </span>
                        </h3>
                    </div>
                    <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
                        {Object.entries(catalogue.columns).map(([catKey, cat]) => (
                            <div key={catKey} className="border border-black/5 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => toggleCategory(`col_${catKey}`)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 bg-surface/50 hover:bg-surface transition-colors"
                                >
                                    <span className="text-xs font-bold text-heading uppercase tracking-widest">{cat.label}</span>
                                    {expandedCategories[`col_${catKey}`] ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-muted" />
                                    ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-muted" />
                                    )}
                                </button>
                                {expandedCategories[`col_${catKey}`] && (
                                    <div className="p-2 space-y-0.5">
                                        {Object.entries(cat.columns).map(([colExpr, colLabel]) => (
                                            <label
                                                key={colExpr}
                                                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${selectedColumns.includes(colExpr) ? 'bg-lime/10' : 'hover:bg-surface/70'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedColumns.includes(colExpr)}
                                                    onChange={() => toggleColumn(colExpr)}
                                                    className="w-3.5 h-3.5 accent-lime rounded"
                                                />
                                                <span className="text-xs font-medium text-heading">{colLabel}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="p-4 border-t border-black/5 space-y-2">
                        <button
                            onClick={generatePreview}
                            disabled={generating || selectedColumns.length === 0}
                            className={`w-full flex items-center justify-center gap-2 bg-lime text-forest px-5 py-3 rounded-full font-bold shadow-lg shadow-lime/25 transition-all ${generating || selectedColumns.length === 0 ? 'opacity-60' : 'hover:bg-lime-hover hover:scale-[1.02]'}`}
                        >
                            <Eye className="w-4 h-4" />
                            {generating ? 'Generating...' : 'Generate Preview'}
                        </button>
                        <button
                            onClick={exportCSV}
                            disabled={exporting || selectedColumns.length === 0}
                            className={`w-full flex items-center justify-center gap-2 bg-forest text-white px-5 py-3 rounded-full font-bold shadow-lg transition-all ${exporting || selectedColumns.length === 0 ? 'opacity-60' : 'hover:bg-forest/90 hover:scale-[1.02]'}`}
                        >
                            <Download className="w-4 h-4" />
                            {exporting ? 'Exporting...' : 'Export CSV'}
                        </button>
                    </div>
                </div>

                {/* Right: Preview */}
                <div className="lg:col-span-1 glass rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-black/5">
                        <h3 className="text-base font-bold text-heading">
                            Live Preview
                            {preview && (
                                <span className="ml-2 text-xs font-bold text-muted">
                                    Showing {preview.showing} of {preview.total} rows
                                </span>
                            )}
                        </h3>
                    </div>
                    {!preview ? (
                        <div className="p-8 text-center text-muted font-medium">
                            <FileBarChart className="w-12 h-12 mx-auto mb-3 text-black/10" />
                            <p>Select columns and click "Generate Preview"</p>
                        </div>
                    ) : preview.error ? (
                        <div className="p-6 text-center text-red-600 font-medium">{preview.error}</div>
                    ) : (
                        <div className="overflow-auto max-h-[55vh]">
                            <table className="w-full text-xs">
                                <thead className="bg-surface sticky top-0">
                                    <tr>
                                        {preview.columns.map((col, i) => (
                                            <th key={i} className="px-3 py-2.5 text-left font-bold text-muted uppercase tracking-widest whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-black/5">
                                    {preview.rows.map((row, i) => (
                                        <tr key={i} className="hover:bg-surface/30 transition-colors">
                                            {row.map((cell, j) => (
                                                <td key={j} className="px-3 py-2 text-heading font-medium whitespace-nowrap">
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Aggregates Footer */}
                            {preview.aggregates && Object.keys(preview.aggregates).length > 0 && (
                                <div className="border-t-2 border-forest/20 px-4 py-3 bg-forest/5">
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2">Aggregates</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(preview.aggregates).map(([key, value]) => (
                                            <div key={key} className="flex items-center justify-between text-xs">
                                                <span className="font-medium text-muted">{key}</span>
                                                <span className="font-bold text-heading">{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
