import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useToast } from '../components/Toast';
import { Loader2, ArrowLeft, Download, ShieldCheck, Camera } from 'lucide-react';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function HostelPass() {
    const navigate = useNavigate();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const passRef = useRef(null);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await apiClient.get('/allocation/dashboard');
                const d = res.data;

                // Validate they have a pass
                if (!d.progress.allocated || !d.progress.hostel_fee_paid || !d.progress.hms_reference) {
                    toast.error('You must complete payment and allocation to view your Hostel Pass.');
                    navigate('/');
                    return;
                }

                setData({
                    profile: d.profile,
                    allocation: d.allocation,
                    session: d.session,
                    reference: d.progress.hms_reference
                });
            } catch (err) {
                toast.error('Failed to load pass details.');
                navigate('/');
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, [navigate, toast]);

    const handleDownload = async () => {
        if (!passRef.current || downloading) return;
        setDownloading(true);

        try {
            // Generate canvas with higher scale for better quality
            const canvas = await html2canvas(passRef.current, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: 1280 // Ensure standard 16:9 width rendering
            });

            // 16:9 aspect ratio standard dimensions (landscape)
            // A4 is 297x210. Let's make a custom landscape page 160x90 mm
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [160, 90]
            });

            const imgData = canvas.toDataURL('image/png', 1.0);
            pdf.addImage(imgData, 'PNG', 0, 0, 160, 90);
            
            const filename = `FUOYE_Hostel_Pass_${data.profile.identifier.replace(/\//g, '-')}.pdf`;
            pdf.save(filename);
            toast.success('Pass downloaded successfully!');
        } catch (err) {
            console.error('Download error:', err);
            toast.error('Failed to download the pass. Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 animate-pulse">
                        <div className="w-10 h-10 bg-surface-2 rounded-full" />
                        <div>
                            <div className="h-8 w-48 bg-surface-2 rounded-lg mb-2" />
                            <div className="h-4 w-64 bg-surface-2 rounded-full" />
                        </div>
                    </div>
                    <div className="h-10 w-40 bg-surface-2 rounded-xl animate-pulse" />
                </div>
                <div className="w-full flex justify-center bg-surface-2 rounded-3xl p-4 sm:p-8 border border-black/5 animate-pulse">
                    <div className="w-[800px] h-[450px] bg-white/50 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { profile, allocation, session, reference } = data;
    // Verification URL pointing to the frontend verify route
    const verifyUrl = `${window.location.origin}/verify/${encodeURIComponent(reference)}`;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-muted hover:text-heading hover:bg-surface-2 transition-colors border border-black/5"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-heading tracking-tight">Hostel Entry Pass</h1>
                        <p className="text-sm text-muted font-medium">Download or present this pass at the hostel gate</p>
                    </div>
                </div>

                <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className={`flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-lg transition-all ${downloading ? 'opacity-70 scale-95' : 'hover:scale-[1.02]'}`}
                >
                    {downloading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                    ) : (
                        <><Download className="w-4 h-4" /> Download PDF</>
                    )}
                </button>
            </div>

            {/* Pass Container - Fixed 16:9 aspect ratio */}
            <div className="w-full flex justify-center bg-surface-2 rounded-3xl p-4 sm:p-8 border border-black/5 overflow-x-auto">
                <PassCard
                    ref={passRef}
                    profile={profile}
                    allocation={allocation}
                    session={session}
                    reference={reference}
                    verifyUrl={verifyUrl}
                />
            </div>
        </div>
    );
}
