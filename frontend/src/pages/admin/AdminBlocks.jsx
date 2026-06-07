import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { ArrowLeft, Layers, Plus, WrenchIcon, CheckCircle, Users, BedDouble, Edit2, Save, X, Accessibility } from 'lucide-react';
import { useToast } from '../../components/Toast';

export default function AdminBlocks() {
    const { hostelId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [data, setData] = useState(null);         // { hostel_name, blocks: [] }
    const [rooms, setRooms] = useState(null);        // { block_name, rooms: [] } — for expanded block
    const [expandedBlock, setExpandedBlock] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showBlockForm, setShowBlockForm] = useState(false);
    const [showGenForm, setShowGenForm] = useState(null);  // block_id being generated for
    const [blockName, setBlockName] = useState('');
    const [numRooms, setNumRooms] = useState(10);
    const [bedsPerRoom, setBedsPerRoom] = useState(4);
    const [submitting, setSubmitting] = useState(false);
    
    // Room edit state
    const [editingRoomId, setEditingRoomId] = useState(null);
    const [editRoomData, setEditRoomData] = useState({ room_number: '', disability_reserved: false });

    const fetchBlocks = () => {
        setLoading(true);
        apiClient.get(`/admin/hostels/${hostelId}/blocks`)
            .then(res => setData(res.data))
            .catch(() => toast.error('Failed to load blocks'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchBlocks(); }, [hostelId]);

    const handleCreateBlock = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await apiClient.post('/admin/blocks', { hostel_id: parseInt(hostelId), name: blockName.trim() });
            toast.success(res.data.message);
            setBlockName(''); setShowBlockForm(false);
            fetchBlocks();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to create block');
        } finally { setSubmitting(false); }
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await apiClient.post(`/admin/blocks/${showGenForm}/rooms`, {
                num_rooms: numRooms, beds_per_room: bedsPerRoom
            });
            toast.success(res.data.message);
            setShowGenForm(null);
            fetchBlocks();
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to generate rooms');
        } finally { setSubmitting(false); }
    };

    const toggleBlockStatus = async (block) => {
        const next = block.status === 'active' ? 'maintenance' : 'active';
        try {
            const res = await apiClient.patch(`/admin/blocks/${block.id}/status`, { status: next });
            toast.success(res.data.message);
            fetchBlocks();
        } catch (err) { toast.error('Failed to update block status'); }
    };

    const loadRooms = async (block) => {
        if (expandedBlock === block.id) { 
            setExpandedBlock(null); 
            setRooms(null); 
            setEditingRoomId(null);
            return; 
        }
        setExpandedBlock(block.id);
        try {
            const res = await apiClient.get(`/admin/blocks/${block.id}/rooms`);
            setRooms(res.data);
            setEditingRoomId(null);
        } catch { toast.error('Failed to load rooms'); }
    };

    const handleEditRoom = (room) => {
        setEditingRoomId(room.id);
        setEditRoomData({ room_number: room.room_number, disability_reserved: room.disability_reserved });
    };

    const handleSaveRoom = async (roomId) => {
        try {
            await apiClient.put(`/admin/rooms/${roomId}`, editRoomData);
            toast.success('Room updated successfully');
            setEditingRoomId(null);
            // Refresh rooms
            const res = await apiClient.get(`/admin/blocks/${expandedBlock}/rooms`);
            setRooms(res.data);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to update room');
        }
    };

    if (loading) return <div className="text-muted animate-pulse font-medium p-8">Loading Blocks...</div>;

    const { hostel_name, blocks } = data || {};

    return (
        <div className="space-y-8 animate-in fade-in duration-350">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/admin/hostels')}
                        className="p-2 rounded-xl bg-white border border-black/5 hover:bg-surface transition-colors shrink-0"
                    ><ArrowLeft className="w-5 h-5 text-muted" /></button>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-muted uppercase tracking-widest">Hostel</p>
                        <h1 className="text-2xl font-extrabold text-heading tracking-tight truncate">{hostel_name}</h1>
                    </div>
                </div>
                <button onClick={() => setShowBlockForm(!showBlockForm)}
                    className="flex items-center gap-2 bg-lime text-forest px-5 py-3 rounded-full font-bold shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all self-start sm:self-auto shrink-0"
                >
                    <Plus className="w-5 h-5" /> Add Block
                </button>
            </div>

            {/* Add Block Form */}
            {showBlockForm && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 animate-in slide-in-from-bottom-4 duration-300">
                    <h3 className="text-lg font-bold text-heading mb-4">Create New Block</h3>
                    <form onSubmit={handleCreateBlock} className="flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Block Name</label>
                            <input required value={blockName} onChange={e => setBlockName(e.target.value)}
                                placeholder="e.g. Block A, Wing 1"
                                className="w-full glass-input text-heading rounded-xl focus:ring-lime focus:border-lime p-3.5 font-medium transition-colors"
                            />
                        </div>
                        <button type="submit" disabled={submitting}
                            className={`bg-lime text-forest px-6 py-3.5 rounded-full font-bold shadow-lg shadow-lime/25 transition-all whitespace-nowrap ${submitting ? 'opacity-70' : 'hover:bg-lime-hover hover:scale-[1.02]'}`}
                        >{submitting ? 'Creating...' : 'Create Block'}</button>
                        <button type="button" onClick={() => setShowBlockForm(false)}
                            className="bg-surface text-heading px-6 py-3.5 rounded-full font-bold hover:bg-black/5 transition-colors"
                        >Cancel</button>
                    </form>
                </div>
            )}

            {/* Generate Rooms Form */}
            {showGenForm && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-lime/30 animate-in slide-in-from-bottom-4 duration-300">
                    <h3 className="text-lg font-bold text-heading mb-1">Generate Rooms & Beds</h3>
                    <p className="text-sm text-muted mb-4">
                        Block: <strong>{blocks?.find(b => b.id === showGenForm)?.name}</strong>
                        <span className="ml-3 text-xs text-muted">(Min 4 rooms · Max 50 rooms · Max 8 beds/room)</span>
                    </p>
                    <form onSubmit={handleGenerate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Number of Rooms</label>
                                <input type="number" min="4" max="50" required value={numRooms}
                                    onChange={e => setNumRooms(Math.max(4, Math.min(50, parseInt(e.target.value) || 4)))}
                                    className="w-full glass-input text-heading rounded-xl focus:ring-lime focus:border-lime p-3.5 font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2">Beds per Room</label>
                                <input type="number" min="1" max="8" required value={bedsPerRoom}
                                    onChange={e => setBedsPerRoom(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
                                    className="w-full glass-input text-heading rounded-xl focus:ring-lime focus:border-lime p-3.5 font-medium"
                                />
                            </div>
                        </div>
                        <div className="bg-forest rounded-2xl p-4">
                            <p className="text-sm font-bold text-white">
                                This will generate <span className="text-lime">{numRooms}</span> rooms ×&nbsp;
                                <span className="text-lime">{bedsPerRoom}</span> beds = <span className="text-lime text-lg">{numRooms * bedsPerRoom}</span> new bed spaces
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button type="submit" disabled={submitting}
                                className={`bg-lime text-forest px-6 py-3 rounded-full font-bold shadow-lg shadow-lime/25 transition-all ${submitting ? 'opacity-70' : 'hover:bg-lime-hover hover:scale-[1.02]'}`}
                            >{submitting ? 'Generating...' : 'Generate Bed Spaces'}</button>
                            <button type="button" onClick={() => setShowGenForm(null)}
                                className="bg-surface text-heading px-6 py-3 rounded-full font-bold hover:bg-black/5 transition-colors"
                            >Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Blocks list */}
            {blocks?.length > 0 ? (
                <div className="space-y-4">
                    {blocks.map(block => (
                        <div key={block.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden transition-all ${block.status === 'maintenance' ? 'border-amber-200' : 'border-black/5'}`}>
                            {/* Block header row */}
                            <div className="px-6 py-5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-forest/5 flex items-center justify-center">
                                        <Layers className="w-5 h-5 text-forest" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-heading">{block.name}</h3>
                                        <p className="text-sm text-muted">{block.room_count} rooms · {block.occupied_beds}/{block.total_beds} beds occupied</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Status badge */}
                                    <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${block.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                        {block.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <WrenchIcon className="w-3 h-3" />}
                                        {block.status === 'active' ? 'Active' : 'Maintenance'}
                                    </span>
                                    <button onClick={() => toggleBlockStatus(block)}
                                        className="text-xs font-bold text-muted px-3 py-1.5 rounded-xl bg-surface hover:bg-black/5 transition-colors"
                                    >{block.status === 'active' ? 'Set Maintenance' : 'Reactivate'}</button>
                                    <button onClick={() => setShowGenForm(block.id)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-forest bg-lime/20 hover:bg-lime/40 px-3 py-1.5 rounded-xl transition-colors"
                                    ><BedDouble className="w-3.5 h-3.5" /> Generate Rooms</button>
                                    <button onClick={() => loadRooms(block)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-forest bg-forest/10 hover:bg-forest/20 px-3 py-1.5 rounded-xl transition-colors"
                                    ><Users className="w-3.5 h-3.5" /> {expandedBlock === block.id ? 'Hide Rooms' : 'View Rooms'}</button>
                                </div>
                            </div>

                            {/* Capacity bar */}
                            <div className="px-6 pb-4">
                                <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${block.total_beds > 0 && (block.occupied_beds / block.total_beds) > 0.8 ? 'bg-red-400' : 'bg-lime'}`}
                                        style={{ width: block.total_beds > 0 ? `${Math.round((block.occupied_beds / block.total_beds) * 100)}%` : '0%' }}
                                    />
                                </div>
                            </div>

                            {/* Expanded rooms list */}
                            {expandedBlock === block.id && rooms && (
                                <div className="border-t border-black/5 bg-surface/40 divide-y divide-black/5">
                                    {rooms.rooms?.length === 0 && (
                                        <p className="text-center text-muted text-sm font-medium py-6">No rooms yet. Click "Generate Rooms" to create some.</p>
                                    )}
                                    {rooms.rooms?.map(room => (
                                        <div key={room.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-3 hover:bg-white/60 transition-colors gap-3">
                                            {editingRoomId === room.id ? (
                                                <div className="flex-1 flex flex-wrap items-center gap-3">
                                                    <input 
                                                        value={editRoomData.room_number} 
                                                        onChange={e => setEditRoomData({...editRoomData, room_number: e.target.value})}
                                                        className="glass-input text-heading rounded-lg px-3 py-1.5 font-bold focus:ring-lime focus:border-lime max-w-[120px]"
                                                        placeholder="Room No."
                                                    />
                                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-muted">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={editRoomData.disability_reserved}
                                                            onChange={e => setEditRoomData({...editRoomData, disability_reserved: e.target.checked})}
                                                            className="w-4 h-4 text-lime focus:ring-lime rounded border-black/10"
                                                        />
                                                        Disability Reserved
                                                    </label>
                                                    <div className="flex items-center gap-2 ml-auto">
                                                        <button onClick={() => handleSaveRoom(room.id)} className="p-1.5 bg-lime text-forest rounded hover:bg-lime-hover"><Save className="w-4 h-4" /></button>
                                                        <button onClick={() => setEditingRoomId(null)} className="p-1.5 bg-surface text-muted rounded hover:bg-black/5"><X className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <span className="font-bold text-heading">{room.room_number}</span>
                                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${room.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{room.status}</span>
                                                        {room.disability_reserved && (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                                                                <Accessibility className="w-3 h-3" /> Disability
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-sm text-muted whitespace-nowrap">{room.occupied_beds}/{room.total_beds} beds</span>
                                                        <button
                                                            onClick={() => handleEditRoom(room)}
                                                            className="flex items-center gap-1.5 text-xs font-bold text-muted bg-surface hover:bg-black/5 px-2 py-1.5 rounded-lg transition-colors"
                                                            title="Edit Room"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => navigate(`/admin/rooms/${room.id}/students`)}
                                                            className="flex items-center gap-1.5 text-xs font-bold text-forest bg-forest/10 hover:bg-forest/20 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                                                        >
                                                            <Users className="w-3 h-3" /> Students
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass rounded-2xl p-12 text-center">
                    <div className="bg-surface rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <Layers className="w-8 h-8 text-muted" />
                    </div>
                    <p className="text-muted font-medium">No blocks yet. Click "+ Add Block" to create the first block for {hostel_name}.</p>
                    <p className="text-xs text-muted mt-1">Supervisor rule: each block must have a minimum of 4 rooms.</p>
                </div>
            )}
        </div>
    );
}
