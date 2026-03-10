import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { BedDouble, Building } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { useNavigate } from 'react-router-dom';

export default function AdminBedSpaces() {
    const [hostels, setHostels] = useState([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const navigate = useNavigate();

    const fetchHostels = () => {
        apiClient.get('/admin/hostels')
            .then(res => setHostels(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchHostels(); }, []);

    if (loading) return <div className="text-muted animate-pulse font-medium">Loading Bed Space Data...</div>;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div>
                <h1 className="text-3xl font-extrabold text-heading tracking-tight">Bed Space Overview</h1>
                <p className="text-muted mt-2 font-medium">
                    Room and bed generation is now managed per-block. Click a hostel to manage its blocks and generate rooms.
                </p>
            </div>

            {/* Info Banner */}
            <div className="bg-forest text-white rounded-2xl p-5">
                <p className="font-bold text-base flex items-center gap-2">
                    <BedDouble className="w-5 h-5 text-lime" />
                    How to generate bed spaces
                </p>
                <ol className="list-decimal list-inside mt-2 space-y-1 text-sm text-white/80">
                    <li>Go to <strong className="text-white">Hostel Management</strong> and click "Manage Blocks" on a hostel.</li>
                    <li>Create a block (e.g. "Block A").</li>
                    <li>Click "Generate Rooms" on the block — min <strong className="text-lime">4</strong>, max <strong className="text-lime">50</strong> rooms · max <strong className="text-lime">8</strong> beds per room.</li>
                </ol>
            </div>

            {/* Hostels Overview */}
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                <div className="px-6 py-5 border-b border-black/5">
                    <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                        <BedDouble className="w-5 h-5 text-muted" />
                        Capacity by Hostel
                    </h3>
                </div>
                <div className="divide-y divide-black/5">
                    {hostels.map((hostel) => {
                        const pct = hostel.capacity > 0 ? Math.round((hostel.occupied / hostel.capacity) * 100) : 0;
                        return (
                            <div key={hostel.id} className="p-6 hover:bg-cream/50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-heading text-lg">{hostel.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${hostel.gender === 'male' ? 'bg-forest/5 text-forest' : 'bg-tag-pink/30 text-forest'}`}>
                                                {hostel.gender.toUpperCase()}
                                            </span>
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${hostel.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                {hostel.status}
                                            </span>
                                            <span className="text-xs text-muted">{hostel.block_count} block{hostel.block_count !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex gap-6 text-center">
                                            {[
                                                { label: 'Total',    value: hostel.capacity, color: 'text-heading' },
                                                { label: 'Occupied', value: hostel.occupied,  color: 'text-amber-600' },
                                                { label: 'Vacant',   value: hostel.available, color: hostel.available > 0 ? 'text-lime' : 'text-red-500' },
                                            ].map(s => (
                                                <div key={s.label}>
                                                    <p className="text-xs font-bold text-muted uppercase tracking-widest">{s.label}</p>
                                                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => navigate(`/admin/hostels/${hostel.id}/blocks`)}
                                            className="flex items-center gap-2 bg-forest text-lime px-4 py-2 rounded-xl font-bold text-sm hover:bg-forest/90 transition-colors"
                                        >
                                            <Building className="w-4 h-4" />
                                            Manage Blocks
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-4 w-full bg-cream rounded-full h-3 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-lime'}`}
                                        style={{ width: `${pct}%` }} />
                                </div>
                                <p className="text-xs text-muted font-medium mt-1">{pct}% occupied</p>
                            </div>
                        );
                    })}
                    {hostels.length === 0 && (
                        <div className="p-8 text-center text-muted font-medium">
                            No hostels found. Run the v3 migration to seed the database.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
