import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import { Loader2, Printer, Download, ArrowLeft, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Receipt() {
    const navigate = useNavigate();
    const [receipt, setReceipt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [downloading, setDownloading] = useState(false);
    const printRef = useRef();

    useEffect(() => {
        apiClient.get('/payment/receipt')
            .then(res => setReceipt(res.data))
            .catch(err => setError(err.response?.data?.detail || 'Failed to load receipt'))
            .finally(() => setLoading(false));
    }, []);

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPdf = async () => {
        setDownloading(true);
        try {
            const res = await apiClient.get('/payment/receipt/pdf', {
                responseType: 'blob',
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `HMS_Receipt_${receipt?.hms_reference?.replace(/\//g, '-') || 'receipt'}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Failed to download PDF. Please try again.');
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-forest animate-spin" />
            </div>
        );
    }

    if (error || !receipt) {
        return (
            <div className="max-w-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                    <p className="text-red-700 font-bold">{error || 'No receipt found'}</p>
                    <button onClick={() => navigate('/')} className="mt-3 text-sm font-bold text-forest underline">
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
            {/* Action bar — hidden on print */}
            <div className="flex items-center justify-between mb-6 print:hidden">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted hover:text-heading font-medium transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownloadPdf}
                        disabled={downloading}
                        className="flex items-center gap-2 bg-forest text-white px-5 py-2.5 rounded-full font-bold hover:bg-forest-light transition-colors disabled:opacity-60"
                    >
                        {downloading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        {downloading ? 'Generating…' : 'Download PDF'}
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-surface-2 text-heading px-5 py-2.5 rounded-full font-bold hover:bg-lime-soft transition-colors border border-sidebar-border"
                    >
                        <Printer className="w-4 h-4" /> Print
                    </button>
                </div>
            </div>

            {/* Receipt Card */}
            <div ref={printRef} className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden print:shadow-none print:border-0 print:rounded-none">
                {/* Header */}
                <div className="bg-forest p-8 text-center">
                    <h1 className="text-3xl font-serif font-black text-white tracking-tighter italic">HMS</h1>
                    <p className="text-white/50 text-sm font-medium mt-1">Hostel Management System</p>
                    <p className="text-lime font-bold text-lg mt-3">Payment Receipt</p>
                </div>

                {/* Receipt Body */}
                <div className="p-8 space-y-6">
                    {/* HMS Reference */}
                    <div className="text-center py-4 bg-lime-soft border border-lime-border rounded-2xl">
                        <p className="text-xs font-bold text-muted uppercase tracking-widest">HMS Reference</p>
                        <p className="text-2xl font-black text-forest mt-1 font-mono">{receipt.hms_reference}</p>
                    </div>

                    {/* Student Info */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold text-muted uppercase tracking-widest">Student Information</p>
                        <div className="grid grid-cols-2 gap-3">
                            <InfoRow label="Name" value={receipt.student_name} />
                            <InfoRow label="Matric No." value={receipt.identifier} />
                            <InfoRow label="Department" value={receipt.department} />
                            <InfoRow label="Level" value={receipt.level} />
                            <InfoRow label="Study Type" value={receipt.study_type} />
                            <InfoRow label="Session" value={receipt.session_name} />
                        </div>
                    </div>

                    {/* Payment Details */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold text-muted uppercase tracking-widest">Payment Details</p>
                        <div className="space-y-2">
                            <InfoRow label="Paystack Reference" value={receipt.paystack_reference} />
                            <InfoRow label="Payment Date" value={receipt.paid_at ? new Date(receipt.paid_at).toLocaleString() : 'N/A'} />
                        </div>
                    </div>

                    {/* Fee Breakdown */}
                    {receipt.components && receipt.components.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-muted uppercase tracking-widest">Fee Breakdown</p>
                            <div className="border border-black/5 rounded-xl overflow-hidden">
                                {receipt.components.map((comp, i) => (
                                    <div key={i} className={`flex justify-between px-4 py-3 ${i % 2 === 0 ? 'bg-cream' : 'bg-white'}`}>
                                        <span className="text-sm font-medium text-body">{comp.name}</span>
                                        <span className="text-sm font-bold text-heading">{'\u20A6'}{comp.amount?.toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between px-4 py-3 bg-forest text-white">
                                    <span className="font-bold">Total Paid</span>
                                    <span className="font-black text-lime">{'\u20A6'}{receipt.amount?.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hostel Choices */}
                    {receipt.hostel_choices && (
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-muted uppercase tracking-widest">Hostel Preferences</p>
                            <div className="space-y-2">
                                {receipt.hostel_choices.map((c, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-forest text-lime font-bold flex items-center justify-center text-xs">{i + 1}</span>
                                        <span className="text-sm font-medium text-heading">{c}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="text-center pt-4 border-t border-black/5">
                        <p className="text-xs text-muted font-medium">This is a computer-generated receipt and does not require a signature.</p>
                        <p className="text-xs text-muted font-medium mt-1">Generated by HMS - Hostel Management System</p>
                    </div>
                </div>
            </div>

            {/* PDF download hint — hidden on print */}
            <div className="mt-4 text-center print:hidden">
                <p className="text-xs text-muted font-medium flex items-center justify-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Download as PDF for a professional, printer-ready receipt
                </p>
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex flex-col">
            <span className="text-[11px] font-bold text-muted uppercase tracking-widest">{label}</span>
            <span className="text-sm font-semibold text-heading mt-0.5">{value || '—'}</span>
        </div>
    );
}
