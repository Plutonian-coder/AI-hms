import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Search, ClipboardList, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function AdminAllocations() {
    const [allocations, setAllocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [revoking, setRevoking] = useState(null);
    const [confirmRevoke, setConfirmRevoke] = useState(null);
    const toast = useToast();

    const fetchAllocations = () => {
        apiClient.get('/admin/allocations')
            .then(res => setAllocations(res.data))
            .catch(() => { toast.error('Failed to load allocations.'); })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchAllocations(); }, []);

    const handleRevoke = async (id) => {
        setRevoking(id);
        try {
            const res = await apiClient.delete(`/admin/allocations/${id}`);
            toast.success(res.data.message);
            setConfirmRevoke(null);
            fetchAllocations();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to revoke allocation');
        } finally {
            setRevoking(null);
        }
    };

    const filtered = allocations.filter(a => {
        const q = searchQuery.toLowerCase();
        return (
            a.full_name.toLowerCase().includes(q) ||
            a.identifier.toLowerCase().includes(q) ||
            a.hostel_name.toLowerCase().includes(q) ||
            a.room_number.toLowerCase().includes(q)
        );
    });

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Loading Allocations...</div>;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight">Allocation Management</h1>
                <p className="text-muted mt-2 font-medium">View and manage active bed allocations.</p>
            </div>

            {/* Search */}
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 p-4">
                <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-muted shrink-0" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by name, matric number, hostel, or room..."
                        className="w-full bg-transparent border-0 border-b border-black/10 p-2.5 font-medium text-sm text-heading placeholder:text-muted/50 focus:outline-none focus:ring-0 focus:border-lime transition-colors"
                    />
                </div>
            </div>

            {/* Confirm Revoke Modal */}
            {confirmRevoke && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-heading">Revoke Allocation</h3>
                                <p className="text-sm text-muted">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-sm text-body font-medium mb-2">
                            Are you sure you want to revoke <span className="font-bold text-heading">{confirmRevoke.full_name}</span>'s allocation?
                        </p>
                        <p className="text-xs text-muted font-medium mb-6">
                            {confirmRevoke.hostel_name} — Room {confirmRevoke.room_number}, Bed {confirmRevoke.bed_number}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleRevoke(confirmRevoke.id)}
                                disabled={revoking === confirmRevoke.id}
                                className={`flex-1 bg-red-600 text-white px-5 py-3 rounded-full font-bold shadow-lg transition-all ${revoking ? 'opacity-70 scale-95' : 'hover:bg-red-700 hover:scale-[1.02]'}`}
                            >
                                {revoking === confirmRevoke.id ? 'Revoking...' : 'Yes, Revoke'}
                            </button>
                            <button
                                onClick={() => setConfirmRevoke(null)}
                                className="flex-1 bg-cream text-heading px-5 py-3 rounded-full font-bold hover:bg-black/5 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Data Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                <div className="px-6 py-5 border-b border-black/5">
                    <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-muted" />
                        Active Allocations ({filtered.length})
                    </h3>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-black/5 bg-cream/50">
                                <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Student</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Matric No.</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Hostel</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Room</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Bed</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Date</th>
                                <th className="text-right px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(a => (
                                <tr key={a.id} className="border-b border-black/5 hover:bg-cream/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-xs shrink-0">
                                                {a.full_name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-sm text-heading">{a.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono font-semibold text-sm text-muted">{a.identifier}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-semibold text-heading">{a.hostel_name}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono font-semibold text-sm text-muted">{a.room_number}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-semibold text-sm text-heading">Bed {a.bed_number}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-medium text-muted">
                                            {a.allocated_at ? new Date(a.allocated_at).toLocaleDateString() : '—'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setConfirmRevoke(a)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Revoke
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-black/5">
                    {filtered.map(a => (
                        <div key={a.id} className="p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-sm shrink-0">
                                        {a.full_name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-heading">{a.full_name}</p>
                                        <p className="font-mono text-xs text-muted">{a.identifier}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setConfirmRevoke(a)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-forest/5 text-forest">
                                    {a.hostel_name}
                                </span>
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cream text-body">
                                    Room {a.room_number}
                                </span>
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-lime/10 text-lime">
                                    Bed {a.bed_number}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {filtered.length === 0 && (
                    <div className="p-8 text-center text-muted font-medium">
                        {searchQuery ? 'No allocations match your search.' : 'No active allocations for this session.'}
                    </div>
                )}
            </div>
        </div>
    );
}
