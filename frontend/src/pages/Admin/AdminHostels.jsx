import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Building, Plus, Pencil, Trash2 } from 'lucide-react';

export default function AdminHostels() {
    const [hostels, setHostels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [gender, setGender] = useState('male');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchHostels = () => {
        apiClient.get('/admin/hostels')
            .then(res => setHostels(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchHostels(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setSubmitting(true);

        try {
            const res = await apiClient.post('/admin/hostels', {
                name: name.trim(),
                gender_restriction: gender
            });
            setSuccess(res.data.message);
            setName('');
            setGender('male');
            setShowForm(false);
            fetchHostels();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create hostel');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Loading Hostels...</div>;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight">Hostel Management</h1>
                    <p className="text-muted mt-2 font-medium">Manage hostel buildings.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-lime text-forest px-5 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all"
                >
                    <Plus className="w-5 h-5" />
                    Add Hostel
                </button>
            </div>

            {success && (
                <div className="p-4 rounded-2xl bg-lime/10 border border-lime/20 text-forest font-bold text-sm">{success}</div>
            )}
            {error && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 font-bold text-sm">{error}</div>
            )}

            {/* Create Form */}
            {showForm && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 animate-in slide-in-from-bottom-4 duration-300">
                    <h3 className="text-lg font-bold text-heading mb-4">Create New Hostel</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Hostel Name</label>
                            <input
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Moshood Abiola Hall"
                                className="w-full bg-cream border border-black/10 text-heading rounded-xl focus:ring-lime focus:border-lime p-3.5 font-medium transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Gender Restriction</label>
                            <select
                                value={gender}
                                onChange={e => setGender(e.target.value)}
                                className="w-full bg-cream border border-black/10 text-heading rounded-xl focus:ring-lime focus:border-lime p-3.5 font-medium transition-colors"
                            >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="mixed">Mixed</option>
                            </select>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={submitting}
                                className={`bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 transition-all ${submitting ? 'opacity-70 scale-95' : 'hover:bg-lime-hover hover:scale-[1.02]'}`}
                            >
                                {submitting ? 'Creating...' : 'Create Hostel'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="bg-cream text-heading px-6 py-3 rounded-full font-bold hover:bg-black/5 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Hostel Grid */}
            {hostels.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {hostels.map(hostel => {
                        const pct = hostel.capacity > 0 ? Math.round((hostel.occupied / hostel.capacity) * 100) : 0;
                        return (
                            <div key={hostel.id} className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden hover:shadow-md transition-shadow">
                                {/* Card Header */}
                                <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                            hostel.gender === 'male' ? 'bg-forest/5 text-forest' :
                                            hostel.gender === 'female' ? 'bg-tag-pink/30 text-forest' :
                                            'bg-tag-lavender/30 text-forest'
                                        }`}>
                                            <Building className="w-4 h-4" />
                                        </div>
                                        <h3 className="font-bold text-heading">{hostel.name}</h3>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button className="p-1.5 text-muted hover:text-forest transition-colors rounded-lg hover:bg-cream">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button className="p-1.5 text-muted hover:text-red-600 transition-colors rounded-lg hover:bg-cream">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="p-5 space-y-4">
                                    {/* Gender Badge */}
                                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                                        hostel.gender === 'male' ? 'bg-forest/5 text-forest' :
                                        hostel.gender === 'female' ? 'bg-tag-pink/30 text-forest' :
                                        'bg-tag-lavender/30 text-forest'
                                    }`}>
                                        {hostel.gender.toUpperCase()}
                                    </span>

                                    {/* Occupancy */}
                                    <p className="text-sm font-semibold text-body">
                                        <span className="font-black text-heading">{hostel.occupied}</span> / {hostel.capacity} occupied
                                    </p>

                                    {/* Progress Bar */}
                                    <div>
                                        <div className="w-full h-2 bg-cream rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-lime'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <p className="text-xs font-medium text-muted mt-1">{pct}% occupancy</p>
                                    </div>
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
                    <p className="text-muted font-medium">No hostels created yet. Click "Add Hostel" to begin.</p>
                </div>
            )}
        </div>
    );
}
