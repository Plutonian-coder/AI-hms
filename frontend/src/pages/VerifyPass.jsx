import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { CheckCircle2, XCircle, Loader2, Home, User, ShieldCheck } from 'lucide-react';

export default function VerifyPass() {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    useEffect(() => {
        const verifyToken = async () => {
            try {
                // The token is the Payment Reference (FUOYE Reference)
                const res = await apiClient.get(`/allocation/verify/${encodeURIComponent(token)}`);
                setData(res.data);
            } catch (err) {
                setData({ valid: false });
            } finally {
                setLoading(false);
            }
        };
        verifyToken();
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-surface-1">
                <Loader2 className="w-12 h-12 text-forest animate-spin mb-4" />
                <p className="text-muted font-bold tracking-widest uppercase text-sm">Verifying Pass...</p>
            </div>
        );
    }

    const { valid } = data;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-surface-1 p-4 sm:p-8">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <img src="/fuoye-logo.png" alt="FUOYE" className="w-20 h-20 object-contain mx-auto mb-4" />
                    <h1 className="text-2xl font-black text-heading tracking-tight">Hostel Verification System</h1>
                </div>

                {/* Card */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-black/5 relative overflow-hidden">
                    {valid ? (
                        <>
                            <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500" />
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-200">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <h2 className="text-2xl font-black text-emerald-600 tracking-tight">Valid Entry Pass</h2>
                                <p className="text-muted text-sm font-medium mt-1">This pass is officially issued and valid.</p>
                            </div>

                            <div className="space-y-6">
                                {/* Photo */}
                                <div className="flex justify-center">
                                    <div className="w-32 h-32 rounded-2xl bg-surface-2 border-2 border-dashed border-sidebar-border overflow-hidden flex items-center justify-center relative shadow-inner">
                                        {data.photo_url ? (
                                            <img 
                                                src={data.photo_url} 
                                                alt="Passport" 
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <User className="w-8 h-8 text-muted opacity-30" />
                                        )}
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="space-y-4 pt-4 border-t border-black/5">
                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Student Details</p>
                                        <p className="text-lg font-black text-heading leading-tight mt-1">{data.student_name}</p>
                                        <p className="text-sm font-mono font-bold text-forest mt-0.5">{data.identifier}</p>
                                        <p className="text-sm font-medium text-muted mt-0.5">{data.department} — Level {data.level}</p>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Hostel Allocation</p>
                                        <p className="text-base font-bold text-heading mt-1">{data.hostel_name}</p>
                                        <p className="text-sm font-medium text-muted mt-0.5">Block {data.block_name}</p>
                                        <div className="flex items-center gap-3 mt-2 bg-lime-soft p-3 rounded-xl border border-lime-border">
                                            <Home className="w-5 h-5 text-forest" />
                                            <div>
                                                <p className="text-xs font-bold text-forest">Room {data.room_number}</p>
                                                <p className="text-[10px] font-bold text-forest/70 uppercase tracking-widest">Bed {data.bed_number}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-8 text-center pt-6 border-t border-black/5">
                                <div className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                    <ShieldCheck className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Verified by FUOYE System</span>
                                </div>
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-3">Session: {data.session_name}</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="absolute top-0 left-0 right-0 h-2 bg-red-500" />
                            <div className="text-center py-8">
                                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                                    <XCircle className="w-10 h-10" />
                                </div>
                                <h2 className="text-2xl font-black text-red-600 tracking-tight">Invalid Pass</h2>
                                <p className="text-muted text-sm font-medium mt-2 max-w-xs mx-auto">
                                    This QR code or token is not recognized as a valid allocation pass. It may be forged, cancelled, or expired.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center mt-8">
                    <Link to="/" className="text-sm font-bold text-forest hover:text-lime transition-colors">
                        Return to Portal
                    </Link>
                </div>
            </div>
        </div>
    );
}
