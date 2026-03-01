import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Search, Users } from 'lucide-react';

export default function AdminStudents() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        apiClient.get('/admin/students')
            .then(res => setStudents(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filtered = students.filter(s => {
        const q = searchQuery.toLowerCase();
        return (
            s.full_name.toLowerCase().includes(q) ||
            s.identifier.toLowerCase().includes(q)
        );
    });

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Loading Students...</div>;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight">Students</h1>
                <p className="text-muted mt-2 font-medium">View all registered students.</p>
            </div>

            {/* Search */}
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 p-4">
                <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-muted shrink-0" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by name or matric number..."
                        className="w-full bg-transparent border-0 border-b border-black/10 p-2.5 font-medium text-sm text-heading placeholder:text-muted/50 focus:outline-none focus:ring-0 focus:border-lime transition-colors"
                    />
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                <div className="px-6 py-5 border-b border-black/5">
                    <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                        <Users className="w-5 h-5 text-muted" />
                        All Students ({filtered.length})
                    </h3>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-black/5 bg-cream/50">
                                <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Student</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Matric No.</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Gender</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Level</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Department</th>
                                <th className="text-left px-6 py-3 text-xs font-bold text-muted uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((s) => (
                                <tr key={s.id} className="border-b border-black/5 hover:bg-cream/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-xs shrink-0">
                                                {s.full_name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-sm text-heading">{s.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono font-semibold text-sm text-muted">{s.identifier}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                            s.gender === 'male' ? 'bg-forest/5 text-forest' : 'bg-tag-pink/30 text-forest'
                                        }`}>
                                            {s.gender?.toUpperCase() || '—'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-semibold text-sm text-heading">{s.level || '—'}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-medium text-sm text-muted">{s.department || '—'}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                            s.is_allocated
                                                ? 'bg-lime/10 text-lime border-lime/20'
                                                : 'bg-cream text-muted border-black/10'
                                        }`}>
                                            {s.is_allocated ? 'ALLOCATED' : 'ELIGIBLE'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-black/5">
                    {filtered.map(s => (
                        <div key={s.id} className="p-5 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-sm shrink-0">
                                    {s.full_name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-heading">{s.full_name}</p>
                                    <p className="font-mono text-xs text-muted">{s.identifier}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                                    s.gender === 'male' ? 'bg-forest/5 text-forest' : 'bg-tag-pink/30 text-forest'
                                }`}>
                                    {s.gender?.toUpperCase() || '—'}
                                </span>
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cream text-body">
                                    {s.level || '—'}
                                </span>
                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                    s.is_allocated ? 'bg-lime/10 text-lime' : 'bg-cream text-muted'
                                }`}>
                                    {s.is_allocated ? 'ALLOCATED' : 'ELIGIBLE'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {filtered.length === 0 && (
                    <div className="p-8 text-center text-muted font-medium">
                        {searchQuery ? 'No students match your search.' : 'No students registered yet.'}
                    </div>
                )}
            </div>
        </div>
    );
}
