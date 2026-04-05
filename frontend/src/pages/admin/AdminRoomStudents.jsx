import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { ArrowLeft, BedDouble, Users, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const PAYMENT_CONFIG = {
    pending:   { label: 'Pending Payment', icon: Clock,         color: 'bg-amber-50 text-amber-700 border border-amber-200' },
    validated: { label: 'Validated',       icon: CheckCircle,   color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    expired:   { label: 'Expired',         icon: AlertCircle,   color: 'bg-red-50 text-red-600 border border-red-200' },
};

export default function AdminRoomStudents() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        apiClient.get(`/admin/rooms/${roomId}/students`)
            .then(res => setData(res.data))
            .catch(err => setError(err.response?.data?.detail || 'Failed to load room data'))
            .finally(() => setLoading(false));
    }, [roomId]);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="text-muted animate-pulse font-medium text-lg">Loading Room Data...</div>
        </div>
    );

    if (error) return (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-6 font-medium">{error}</div>
    );

    const { room_number, room_status, block_name, hostel_name, total_beds, occupied_beds, vacant_beds, students } = data;

    return (
        <div className="space-y-8 animate-in fade-in duration-350">
            {/* Breadcrumb + back */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)}
                    className="p-2 rounded-xl bg-white border border-black/5 hover:bg-surface transition-colors"
                ><ArrowLeft className="w-5 h-5 text-muted" /></button>
                <div>
                    <p className="text-xs font-bold text-muted uppercase tracking-widest">
                        {hostel_name} › {block_name}
                    </p>
                    <h1 className="text-2xl font-extrabold text-heading tracking-tight">Room {room_number}</h1>
                </div>
            </div>

            {/* Room summary cards */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Beds', value: total_beds, icon: BedDouble, color: 'text-forest' },
                    { label: 'Occupied',   value: occupied_beds, icon: Users, color: 'text-amber-600' },
                    { label: 'Vacant',     value: vacant_beds,  icon: BedDouble, color: vacant_beds > 0 ? 'text-lime' : 'text-red-500' },
                ].map(stat => (
                    <div key={stat.label} className="glass rounded-2xl p-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center">
                            <stat.icon className={`w-5 h-5 ${stat.color}`} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted uppercase tracking-widest">{stat.label}</p>
                            <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Occupancy bar */}
            <div className="glass rounded-2xl p-5">
                <div className="flex justify-between text-xs font-bold text-muted uppercase tracking-widest mb-2">
                    <span>Room Occupancy</span>
                    <span>{total_beds > 0 ? Math.round((occupied_beds / total_beds) * 100) : 0}%</span>
                </div>
                <div className="w-full h-3 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-lime rounded-full transition-all duration-700"
                        style={{ width: total_beds > 0 ? `${(occupied_beds / total_beds) * 100}%` : '0%' }} />
                </div>
            </div>

            {/* Student Table */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-heading flex items-center gap-2">
                        <Users className="w-5 h-5 text-muted" />
                        Students in Room {room_number}
                    </h2>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${room_status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        Room: {room_status}
                    </span>
                </div>

                {students.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
                            <BedDouble className="w-8 h-8 text-muted" />
                        </div>
                        <p className="text-muted font-medium">No students currently allocated to this room.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-black/5">
                                    <th className="px-6 py-3 text-left text-xs font-bold text-muted uppercase tracking-widest">Bed</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-muted uppercase tracking-widest">Matric No.</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-muted uppercase tracking-widest">Full Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-muted uppercase tracking-widest">Gender</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-muted uppercase tracking-widest">Department</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-muted uppercase tracking-widest">Level</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-muted uppercase tracking-widest">Payment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                                {students.map(student => {
                                    const pCfg = PAYMENT_CONFIG[student.payment_status] || PAYMENT_CONFIG.pending;
                                    const PIcon = pCfg.icon;
                                    return (
                                        <tr key={student.student_id} className="hover:bg-surface/40 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="w-8 h-8 flex items-center justify-center bg-forest text-lime font-black text-sm rounded-lg">
                                                    {student.bed_number}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-sm font-bold text-heading">{student.identifier}</td>
                                            <td className="px-6 py-4 font-semibold text-heading">{student.full_name}</td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${student.gender === 'male' ? 'bg-forest/5 text-forest' : 'bg-tag-pink/30 text-forest'}`}>
                                                    {student.gender}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-body">{student.department || '—'}</td>
                                            <td className="px-6 py-4 text-sm text-body">{student.level || '—'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`flex items-center gap-1 w-fit text-xs font-semibold px-2.5 py-1 rounded-full ${pCfg.color}`}>
                                                    <PIcon className="w-3 h-3" />
                                                    {pCfg.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
