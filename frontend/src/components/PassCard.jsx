import { forwardRef } from 'react';
import { Camera, ShieldCheck } from 'lucide-react';
import QRCode from 'react-qr-code';

const PassCard = forwardRef(({ profile, allocation, session, reference, verifyUrl }, ref) => {
    return (
        <div 
            ref={ref}
            className="relative bg-white shrink-0 overflow-hidden shadow-2xl"
            style={{ width: '800px', height: '450px', borderRadius: '16px' }}
        >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-forest/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-lime/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
            
            {/* Header Strip */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-forest" />
            <div className="absolute top-4 left-0 right-0 h-1 bg-lime" />

            <div className="p-8 h-full flex flex-col justify-between pt-10">
                {/* Top: Branding & Title */}
                <div className="flex justify-between items-start z-10">
                    <div className="flex items-center gap-3">
                        <img src="/fuoye-logo.png" alt="FUOYE" className="w-14 h-14 object-contain" crossOrigin="anonymous" />
                        <div>
                            <h2 className="text-2xl font-black text-forest tracking-tight leading-none mb-1">FEDERAL UNIVERSITY OYE-EKITI</h2>
                            <p className="text-sm font-bold text-muted-light tracking-widest uppercase">Student Affairs Unit — Hostel Management Portal</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-forest uppercase tracking-widest bg-lime-soft px-3 py-1 rounded-lg border border-lime-border inline-block">
                            Official Entry Pass
                        </p>
                        <p className="text-xs font-bold text-muted mt-1 tracking-widest uppercase">{session?.name || 'Current'} Session</p>
                    </div>
                </div>

                {/* Middle: Student Details & Passport & QR */}
                <div className="flex gap-8 items-stretch z-10 mt-6">
                    
                    {/* Passport Photo */}
                    <div className="w-32 h-32 shrink-0 rounded-2xl bg-surface-2 border-2 border-dashed border-sidebar-border overflow-hidden flex items-center justify-center relative">
                        {profile?.photo_url ? (
                            <img 
                                src={profile.photo_url} 
                                alt="Passport" 
                                className="w-full h-full object-cover"
                                crossOrigin="anonymous"
                            />
                        ) : (
                            <div className="text-center p-2">
                                <Camera className="w-8 h-8 text-muted mx-auto mb-1 opacity-20" />
                                <p className="text-[9px] font-bold text-muted uppercase tracking-wider text-center">No Photo<br/>Uploaded</p>
                            </div>
                        )}
                    </div>

                    {/* Details Grid */}
                    <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-4 pt-1">
                        <div>
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Student Name</p>
                            <p className="text-lg font-black text-heading leading-tight truncate">{profile?.full_name}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Matric Number</p>
                            <p className="text-lg font-mono font-bold text-forest leading-tight">{profile?.identifier}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Hostel & Block</p>
                            <p className="text-base font-bold text-heading leading-tight truncate">{allocation?.hostel_name} — {allocation?.block_name}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Room & Bed Space</p>
                            <p className="text-base font-bold text-heading leading-tight">Room {allocation?.room_number} <span className="text-muted mx-1">|</span> Bed {allocation?.bed_number}</p>
                        </div>
                    </div>

                    {/* QR Code */}
                    <div className="shrink-0 flex flex-col items-center justify-center bg-white p-2 rounded-xl shadow-sm border border-black/5">
                        {verifyUrl && (
                            <QRCode 
                                value={verifyUrl} 
                                size={110} 
                                level="M" 
                            />
                        )}
                        <p className="text-[8px] font-bold text-muted uppercase tracking-widest mt-1">Scan to Verify</p>
                    </div>
                </div>

                {/* Bottom: Ref & Status */}
                <div className="flex justify-between items-end z-10 border-t border-black/5 pt-4 mt-auto">
                    <div>
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Payment Reference</p>
                        <p className="text-sm font-mono font-bold text-heading">{reference}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Valid & Allocated</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

PassCard.displayName = 'PassCard';

export default PassCard;
