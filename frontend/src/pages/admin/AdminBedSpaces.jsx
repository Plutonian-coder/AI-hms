import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { BedDouble, Plus } from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function AdminBedSpaces() {
    const [hostels, setHostels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedHostel, setSelectedHostel] = useState('');
    const [numRooms, setNumRooms] = useState(50);
    const [bedsPerRoom, setBedsPerRoom] = useState(4);
    const [submitting, setSubmitting] = useState(false);
    const toast = useToast();

    const fetchHostels = () => {
        apiClient.get('/admin/hostels')
            .then(res => setHostels(res.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchHostels(); }, []);

    const handleGenerate = async (e) => {
        e.preventDefault();

        if (!selectedHostel) {
            toast.warning('Please select a hostel.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await apiClient.post(
                `/admin/hostels/${selectedHostel}/rooms?num_rooms=${numRooms}&beds_per_room=${bedsPerRoom}`
            );
            toast.success(res.data.message);
            setShowForm(false);
            fetchHostels();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to generate rooms and beds');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-muted animate-pulse font-medium">Loading Bed Space Data...</div>;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-heading tracking-tight">Bed Space Management</h1>
                    <p className="text-muted mt-2 font-medium">Bulk generate rooms and beds for hostels.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-lime text-forest px-5 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all"
                >
                    <Plus className="w-5 h-5" />
                    Generate Beds
                </button>
            </div>


            {/* Generate Form */}
            {showForm && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 animate-in slide-in-from-bottom-4 duration-300">
                    <h3 className="text-lg font-bold text-heading mb-4">Bulk Generate Rooms & Beds</h3>
                    <form onSubmit={handleGenerate} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Select Hostel</label>
                            <select
                                required
                                value={selectedHostel}
                                onChange={e => setSelectedHostel(e.target.value)}
                                className="w-full bg-cream border border-black/10 text-heading rounded-xl focus:ring-lime focus:border-lime p-3.5 font-medium transition-colors"
                            >
                                <option value="" disabled>Choose a hostel...</option>
                                {hostels.map(h => (
                                    <option key={h.id} value={h.id}>{h.name} ({h.gender.toUpperCase()})</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Number of Rooms</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="200"
                                    required
                                    value={numRooms}
                                    onChange={e => setNumRooms(parseInt(e.target.value) || 1)}
                                    className="w-full bg-cream border border-black/10 text-heading rounded-xl focus:ring-lime focus:border-lime p-3.5 font-medium transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Beds per Room</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="12"
                                    required
                                    value={bedsPerRoom}
                                    onChange={e => setBedsPerRoom(parseInt(e.target.value) || 1)}
                                    className="w-full bg-cream border border-black/10 text-heading rounded-xl focus:ring-lime focus:border-lime p-3.5 font-medium transition-colors"
                                />
                            </div>
                        </div>

                        <div className="bg-forest rounded-2xl p-4">
                            <p className="text-sm font-bold text-white">
                                This will generate <span className="text-lime">{numRooms}</span> rooms with <span className="text-lime">{bedsPerRoom}</span> beds each = <span className="text-lime text-lg">{numRooms * bedsPerRoom}</span> total new bed spaces
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={submitting}
                                className={`bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 transition-all ${submitting ? 'opacity-70 scale-95' : 'hover:bg-lime-hover hover:scale-[1.02]'}`}
                            >
                                {submitting ? 'Generating...' : 'Generate Bed Spaces'}
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

            {/* Hostels Overview */}
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                <div className="px-6 py-5 border-b border-black/5">
                    <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                        <BedDouble className="w-5 h-5 text-muted" />
                        Bed Space Overview
                    </h3>
                </div>
                <div className="divide-y divide-black/5">
                    {hostels.map((hostel) => (
                        <div key={hostel.id} className="p-6 hover:bg-cream/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-heading text-lg">{hostel.name}</p>
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full mt-1 inline-block ${hostel.gender === 'male' ? 'bg-forest/5 text-forest' :
                                            hostel.gender === 'female' ? 'bg-tag-pink/30 text-forest' :
                                                'bg-tag-lavender/30 text-forest'
                                        }`}>
                                        {hostel.gender.toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex gap-6 text-center">
                                    <div>
                                        <p className="text-xs font-bold text-muted uppercase tracking-widest">Total</p>
                                        <p className="text-2xl font-black text-heading">{hostel.capacity}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-muted uppercase tracking-widest">Occupied</p>
                                        <p className="text-2xl font-black text-amber-600">{hostel.occupied}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-muted uppercase tracking-widest">Vacant</p>
                                        <p className={`text-2xl font-black ${hostel.available > 0 ? 'text-lime' : 'text-red-500'}`}>
                                            {hostel.available}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {/* Capacity Bar */}
                            <div className="mt-4 w-full bg-cream rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-full bg-lime rounded-full transition-all duration-500"
                                    style={{ width: hostel.capacity > 0 ? `${(hostel.occupied / hostel.capacity) * 100}%` : '0%' }}
                                ></div>
                            </div>
                            <p className="text-xs text-muted font-medium mt-1">
                                {hostel.capacity > 0 ? `${Math.round((hostel.occupied / hostel.capacity) * 100)}%` : '0%'} occupied
                            </p>
                        </div>
                    ))}
                    {hostels.length === 0 && (
                        <div className="p-8 text-center text-muted font-medium">No hostels to show. Create hostels first.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
