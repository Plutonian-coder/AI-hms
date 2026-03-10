import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { Building, Plus, Layers, AlertTriangle, CheckCircle, WrenchIcon } from 'lucide-react';
import { useToast } from '../../components/Toast';

const STATUS_CONFIG = {
    active:         { label: 'Active',         icon: CheckCircle,   color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    maintenance:    { label: 'Maintenance',    icon: WrenchIcon,    color: 'bg-amber-50 text-amber-700 border border-amber-200' },
    decommissioned: { label: 'Decommissioned', icon: AlertTriangle, color: 'bg-red-50 text-red-600 border border-red-200' },
};

export default function AdminHostels() {
    const [hostels, setHostels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [gender, setGender] = useState('female');
    const [status, setStatus] = useState('active');
    const [submitting, setSubmitting] = useState(false);
    const [togglingId, setTogglingId] = useState(null);
    const toast = useToast();
    const navigate = useNavigate();

    const fetchHostels = () => {
        apiClient.get('/admin/hostels')
            .then(res => setHostels(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchHostels(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await apiClient.post('/admin/hostels', {
                name: name.trim(),
                gender_restriction: gender,
                status,
            });
            toast.success(res.data.message);
            setName(''); setGender('female'); setStatus('active'); setShowForm(false);
            fetchHostels();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to create hostel');
        } finally {
            setSubmitting(false);
        }
    };

    const cycleStatus = async (hostel) => {
        const next = { active: 'maintenance', maintenance: 'active', decommissioned: 'active' }[hostel.status] || 'active';
        setTogglingId(hostel.id);
        try {
            const res = await apiClient.patch(`/admin/hostels/${hostel.id}/status`, { status: next });
            toast.success(res.data.message);
            fetchHostels();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to update status');
        } finally {
            setTogglingId(null);
        }
    };

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Loading Hostels...</div>;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight">Hostel Management</h1>
                    <p className="text-muted mt-2 font-medium">Manage hostel buildings, statuses, and block hierarchy.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-lime text-forest px-5 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all"
                >
                    <Plus className="w-5 h-5" />
                    Add Hostel
                </button>
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 animate-in slide-in-from-bottom-4 duration-300">
                    <h3 className="text-lg font-bold text-heading mb-4">Create New Hostel</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Hostel Name</label>
                            <input
                                required value={name} onChange={e => setName(e.target.value)}
                                placeholder="e.g. Akata Hall"
                                className="w-full bg-cream border border-black/10 text-heading rounded-xl focus:ring-lime focus:border-lime p-3.5 font-medium transition-colors"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Gender Restriction</label>
                                <select value={gender} onChange={e => setGender(e.target.value)}
                                    className="w-full bg-cream border border-black/10 text-heading rounded-xl focus:ring-lime focus:border-lime p-3.5 font-medium transition-colors"
                                >
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="mixed">Mixed</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Initial Status</label>
                                <select value={status} onChange={e => setStatus(e.target.value)}
                                    className="w-full bg-cream border border-black/10 text-heading rounded-xl focus:ring-lime focus:border-lime p-3.5 font-medium transition-colors"
                                >
                                    <option value="active">Active</option>
                                    <option value="maintenance">Maintenance</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="submit" disabled={submitting}
                                className={`bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 transition-all ${submitting ? 'opacity-70 scale-95' : 'hover:bg-lime-hover hover:scale-[1.02]'}`}
                            >
                                {submitting ? 'Creating...' : 'Create Hostel'}
                            </button>
                            <button type="button" onClick={() => setShowForm(false)}
                                className="bg-cream text-heading px-6 py-3 rounded-full font-bold hover:bg-black/5 transition-colors"
                            >Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Hostel Grid */}
            {hostels.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {hostels.map(hostel => {
                        const pct = hostel.capacity > 0 ? Math.round((hostel.occupied / hostel.capacity) * 100) : 0;
                        const cfg = STATUS_CONFIG[hostel.status] || STATUS_CONFIG.active;
                        const StatusIcon = cfg.icon;
                        return (
                            <div key={hostel.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow ${hostel.status === 'maintenance' ? 'border-amber-200' : hostel.status === 'decommissioned' ? 'border-red-200' : 'border-black/5'}`}>
                                {/* Card Header */}
                                <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${hostel.gender === 'male' ? 'bg-forest/5 text-forest' : 'bg-tag-pink/30 text-forest'}`}>
                                            <Building className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-heading leading-tight">{hostel.name}</h3>
                                            <span className="text-xs text-muted font-medium">{hostel.block_count} block{hostel.block_count !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                    {/* Status badge */}
                                    <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {cfg.label}
                                    </span>
                                </div>

                                {/* Card Body */}
                                <div className="p-5 space-y-4">
                                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${hostel.gender === 'male' ? 'bg-forest/5 text-forest' : hostel.gender === 'female' ? 'bg-tag-pink/30 text-forest' : 'bg-tag-lavender/30 text-forest'}`}>
                                        {hostel.gender.toUpperCase()}
                                    </span>
                                    <p className="text-sm font-semibold text-body">
                                        <span className="font-black text-heading">{hostel.occupied}</span> / {hostel.capacity} occupied
                                    </p>
                                    <div>
                                        <div className="w-full h-2 bg-cream rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-lime'}`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <p className="text-xs font-medium text-muted mt-1">{pct}% occupancy</p>
                                    </div>
                                </div>

                                {/* Card Actions */}
                                <div className="px-5 pb-5 flex gap-2">
                                    <button
                                        onClick={() => navigate(`/admin/hostels/${hostel.id}/blocks`)}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-forest text-lime py-2 rounded-xl font-bold text-sm hover:bg-forest/90 transition-colors"
                                    >
                                        <Layers className="w-3.5 h-3.5" />
                                        Manage Blocks
                                    </button>
                                    <button
                                        onClick={() => cycleStatus(hostel)}
                                        disabled={togglingId === hostel.id}
                                        className="flex items-center justify-center gap-1.5 bg-cream text-heading px-4 py-2 rounded-xl font-bold text-sm hover:bg-black/5 transition-colors disabled:opacity-50"
                                        title={`Toggle status (currently: ${hostel.status})`}
                                    >
                                        <WrenchIcon className="w-3.5 h-3.5" />
                                        {hostel.status === 'active' ? 'Maintenance' : 'Reactivate'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-black/5 p-12 text-center">
                    <div className="bg-cream rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <Building className="w-8 h-8 text-muted" />
                    </div>
                    <p className="text-muted font-medium">No hostels found. The database may need seeding — run v3_blocks_migration.sql first, or click "Add Hostel" to begin.</p>
                </div>
            )}
        </div>
    );
}
