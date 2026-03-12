import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { ArrowRight, Search, BedDouble, Users, DoorOpen, BarChart3, ShieldCheck, RefreshCw, ChevronRight } from 'lucide-react';

export default function LandingPage() {
    const [matric, setMatric] = useState('');
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState(null);
    const [checkError, setCheckError] = useState('');

    const handleCheck = async (e) => {
        e.preventDefault();
        if (!matric.trim()) return;
        setChecking(true);
        setCheckError('');
        setResult(null);
        try {
            const res = await apiClient.get('/allocation/check', { params: { matric: matric.trim() } });
            setResult(res.data);
        } catch {
            setCheckError('Unable to check allocation. Please try again.');
        } finally {
            setChecking(false);
        }
    };

    const resetChecker = () => {
        setResult(null);
        setCheckError('');
        setMatric('');
    };

    return (
        <div className="bg-cream min-h-screen overflow-x-hidden">

            {/* ─── NAVBAR ─── */}
            <nav className="sticky top-0 z-50 bg-cream/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link to="/" className="text-xl font-black text-heading tracking-tight">
                        HMS
                    </Link>
                    <div className="flex items-center gap-6">
                        <a href="#features" className="hidden sm:block text-sm font-semibold text-muted hover:text-heading transition-colors">
                            Features
                        </a>
                        <a href="#metrics" className="hidden sm:block text-sm font-semibold text-muted hover:text-heading transition-colors">
                            About
                        </a>
                        <Link to="/login" className="text-sm font-bold text-heading hover:text-forest transition-colors">
                            Sign In
                        </Link>
                        <Link
                            to="/register"
                            className="bg-lime text-forest text-sm font-bold px-5 py-2.5 rounded-full shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ─── HERO ─── */}
            <section className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-24 lg:pt-24 lg:pb-32">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                    {/* Left — Copy */}
                    <div className="space-y-8">
                        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-heading tracking-tight leading-[0.95]">
                            Seamless<br />
                            Hostel Living<br />
                            Starts Here<span className="text-lime">.</span>
                        </h1>
                        <p className="text-lg text-body font-medium max-w-lg leading-relaxed">
                            AI-powered hostel allocation with receipt verification, real-time tracking,
                            and instant bed assignment. No queues. No stress.
                        </p>
                        <div className="flex items-center gap-4">
                            <Link
                                to="/register"
                                className="inline-flex items-center gap-2 bg-lime text-forest font-bold px-7 py-4 rounded-full shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all text-base"
                            >
                                Create Account
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 text-heading font-bold px-5 py-4 rounded-full hover:bg-black/5 transition-colors text-base"
                            >
                                Sign In
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Right — Allocation Checker Card */}
                    <div className="bg-forest rounded-3xl p-8 shadow-2xl shadow-forest/20 relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-lime/5 rounded-full blur-3xl" />

                        {!result && !checkError ? (
                            <>
                                <div className="mb-6 relative z-10">
                                    <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Quick Lookup</p>
                                    <h3 className="text-xl font-bold text-white mt-1">Check Your Allocation</h3>
                                </div>
                                <form onSubmit={handleCheck} className="space-y-4 relative z-10">
                                    <div>
                                        <label className="block text-xs font-bold text-white/30 uppercase tracking-widest mb-2">Matric Number</label>
                                        <input
                                            type="text"
                                            required
                                            value={matric}
                                            onChange={e => setMatric(e.target.value)}
                                            placeholder="e.g. F/ND/22/3501234"
                                            className="w-full bg-white/8 border border-white/10 text-white rounded-xl p-3.5 font-medium transition-all placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-lime/50 focus:border-lime/50"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={checking}
                                        className={`w-full flex items-center justify-center gap-2 bg-lime text-forest font-bold py-3.5 rounded-full shadow-lg shadow-lime/25 transition-all ${
                                            checking ? 'opacity-70 scale-95' : 'hover:bg-lime-hover hover:scale-[1.02]'
                                        }`}
                                    >
                                        {checking ? (
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
                                                Checking...
                                            </span>
                                        ) : (
                                            <>
                                                <Search className="w-4 h-4" />
                                                Check Status
                                            </>
                                        )}
                                    </button>
                                </form>
                                <p className="text-[11px] text-white/20 font-medium text-center mt-4 relative z-10">
                                    Enter your matric number to view your hostel allocation
                                </p>
                            </>
                        ) : result?.found ? (
                            /* ── Allocated Result ── */
                            <div className="space-y-5 relative z-10">
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-lime/15 text-lime uppercase tracking-widest">
                                        <span className="w-2 h-2 rounded-full bg-lime" />
                                        Allocated
                                    </span>
                                    <button onClick={resetChecker} className="text-white/30 text-xs font-bold hover:text-white/60 transition-colors uppercase tracking-widest">
                                        New Search
                                    </button>
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Student</p>
                                    <p className="text-white font-bold text-lg mt-0.5">{result.student_name}</p>
                                </div>

                                {(result.department || result.level) && (
                                    <div className="grid grid-cols-2 gap-4">
                                        {result.department && (
                                            <div className="bg-white/5 rounded-2xl p-3">
                                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Department</p>
                                                <p className="text-white font-semibold text-sm mt-1">{result.department}</p>
                                            </div>
                                        )}
                                        {result.level && (
                                            <div className="bg-white/5 rounded-2xl p-3">
                                                <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Level</p>
                                                <p className="text-white font-semibold text-sm mt-1">{result.level}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Hostel</p>
                                    <p className="text-white font-bold text-lg mt-0.5">{result.hostel_name}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 rounded-2xl p-4">
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Room</p>
                                        <p className="text-3xl font-black text-lime mt-1">{result.room_number}</p>
                                    </div>
                                    <div className="bg-white/5 rounded-2xl p-4">
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Bed</p>
                                        <p className="text-3xl font-black text-white mt-1">{result.bed_number}</p>
                                    </div>
                                </div>

                                {/* Capacity Dots */}
                                <div>
                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2">Room Capacity</p>
                                    <div className="flex items-center gap-2">
                                        {Array.from({ length: result.capacity }).map((_, i) => (
                                            <span
                                                key={i}
                                                className={`w-3 h-3 rounded-full transition-colors ${
                                                    i < result.occupants ? 'bg-lime' : 'bg-white/10'
                                                }`}
                                            />
                                        ))}
                                        <span className="text-white/40 text-sm font-bold ml-2">{result.occupants}/{result.capacity} People</span>
                                    </div>
                                </div>

                                {/* Roommates */}
                                {result.roommates?.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2">Roommates</p>
                                        <div className="space-y-2">
                                            {result.roommates.map((mate, i) => (
                                                <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                                                    <div className="w-8 h-8 rounded-full bg-forest-light border-2 border-forest text-lime text-xs font-bold flex items-center justify-center shrink-0">
                                                        {mate.full_name.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-white truncate">{mate.full_name}</p>
                                                        <p className="text-[10px] font-medium text-white/30 font-mono">{mate.identifier}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* ── Not Found / Error ── */
                            <div className="space-y-5 relative z-10">
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white/60 uppercase tracking-widest">
                                        Not Found
                                    </span>
                                    <button onClick={resetChecker} className="text-white/30 text-xs font-bold hover:text-white/60 transition-colors uppercase tracking-widest">
                                        New Search
                                    </button>
                                </div>
                                <p className="text-white/50 font-medium leading-relaxed">
                                    {checkError || 'No active allocation found for this matric number. You may not have applied yet, or the session may have changed.'}
                                </p>
                                <Link
                                    to="/register"
                                    className="inline-flex items-center gap-2 bg-lime text-forest font-bold px-5 py-3 rounded-full text-sm shadow-lg shadow-lime/25 hover:bg-lime-hover transition-all"
                                >
                                    Apply Now
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ─── FEATURES ─── */}
            <section id="features" className="bg-forest">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-24 lg:py-32">
                    <div className="text-center mb-20">
                        <p className="text-[11px] font-bold text-lime uppercase tracking-[0.25em]">Platform Capabilities</p>
                        <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight mt-4">
                            Built for Modern<br />Campus Operations
                        </h2>
                    </div>

                    {/* Feature 1: Text Left, Card Right */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-lime/10 text-lime text-xs font-bold uppercase tracking-widest mb-5">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                AI Verification
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight">
                                Receipt Validation<br />in Seconds
                            </h3>
                            <p className="text-white/50 font-medium mt-4 leading-relaxed max-w-md">
                               Advanced OCR analyzes uploaded payment receipts in real-time — verifying authenticity,
                                extracting RRR codes, and checking payment status. No manual verification needed.
                            </p>
                        </div>
                        <div className="bg-forest-light rounded-3xl p-6 border border-white/5">
                            <div className="space-y-3">
                                {['Authenticity Check', 'RRR Extraction', 'Payment Verification', 'Duplicate Detection'].map((step, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white/5 rounded-2xl p-4">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            i < 3 ? 'bg-lime/15' : 'bg-white/5'
                                        }`}>
                                            {i < 3 ? (
                                                <svg className="w-4 h-4 text-lime" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <span className="w-4 h-4 border-2 border-white/20 border-t-lime rounded-full animate-spin" />
                                            )}
                                        </div>
                                        <span className={`text-sm font-bold ${i < 3 ? 'text-white' : 'text-white/40'}`}>{step}</span>
                                        {i < 3 && <span className="ml-auto text-[10px] font-bold text-lime/60 uppercase tracking-widest">Done</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Feature 2: Card Left, Text Right */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24">
                        <div className="order-2 lg:order-1 bg-forest-light rounded-3xl p-6 border border-white/5">
                            <div className="flex items-center justify-between mb-5">
                                <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Live Dashboard</p>
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-lime uppercase tracking-widest">
                                    <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
                                    Live
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Total Beds', value: '800', accent: false },
                                    { label: 'Occupied', value: '642', accent: true },
                                    { label: 'Available', value: '158', accent: false },
                                    { label: 'Occupancy', value: '80%', accent: true },
                                ].map((stat, i) => (
                                    <div key={i} className="bg-white/5 rounded-2xl p-4">
                                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em]">{stat.label}</p>
                                        <p className={`text-2xl font-black mt-1 ${stat.accent ? 'text-lime' : 'text-white'}`}>{stat.value}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-bold text-white/40">Occupancy Rate</span>
                                    <span className="text-xs font-bold text-lime">80%</span>
                                </div>
                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-lime rounded-full" style={{ width: '80%' }} />
                                </div>
                            </div>
                        </div>
                        <div className="order-1 lg:order-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-lime/10 text-lime text-xs font-bold uppercase tracking-widest mb-5">
                                <BarChart3 className="w-3.5 h-3.5" />
                                Real-time Analytics
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight">
                                Full Visibility<br />Across All Hostels
                            </h3>
                            <p className="text-white/50 font-medium mt-4 leading-relaxed max-w-md">
                                Track occupancy rates, monitor allocation progress, and manage academic sessions
                                from a centralized admin dashboard with live data updates.
                            </p>
                        </div>
                    </div>

                    {/* Feature 3: Text Left, Card Right */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-lime/10 text-lime text-xs font-bold uppercase tracking-widest mb-5">
                                <BedDouble className="w-3.5 h-3.5" />
                                Smart Allocation
                            </div>
                            <h3 className="text-3xl font-black text-white tracking-tight">
                                First-Come, First-Served<br />Done Right
                            </h3>
                            <p className="text-white/50 font-medium mt-4 leading-relaxed max-w-md">
                                Atomic database transactions guarantee no double-bookings. Students pick 3 hostel
                                preferences. The system assigns the first available bed — fairly and instantly.
                            </p>
                        </div>
                        <div className="bg-forest-light rounded-3xl p-6 border border-white/5">
                            <div className="space-y-3">
                                {['Akata Hostel', 'Hollywood Hostel', 'New Hall'].map((hostel, i) => {
                                    const pcts = [87, 64, 32];
                                    return (
                                        <div key={i} className="bg-white/5 rounded-2xl p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-bold text-white">{hostel}</span>
                                                <span className={`text-xs font-bold ${pcts[i] > 80 ? 'text-amber-400' : 'text-lime'}`}>{pcts[i]}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${pcts[i] > 80 ? 'bg-amber-400' : 'bg-lime'}`}
                                                    style={{ width: `${pcts[i]}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="flex items-center gap-3 mt-2 p-3 bg-lime/10 rounded-xl border border-lime/20">
                                    <span className="w-6 h-6 rounded-full bg-lime flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </span>
                                    <span className="text-sm font-bold text-lime">Auto-assigned to Akata Hostel, Room 14</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── METRICS ─── */}
            <section id="metrics" className="bg-cream">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-24 lg:py-32">
                    <div className="text-center mb-16">
                        <p className="text-[11px] font-bold text-lime uppercase tracking-[0.25em]">By the Numbers</p>
                        <h2 className="text-4xl sm:text-5xl font-black text-heading tracking-tight mt-4">
                            Trusted Performance
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
                        {[
                            { number: '98%', label: 'Allocation Accuracy', desc: 'AI-verified receipt processing with near-zero error rate' },
                            { number: '3x', label: 'Faster Processing', desc: 'From upload to bed assignment in under 30 seconds' },
                            { number: '500+', label: 'Students Managed', desc: 'Scalable platform handling peak allocation periods' },
                        ].map((stat, i) => (
                            <div key={i} className="text-center lg:text-left">
                                <div className="flex items-start justify-center lg:justify-start gap-2">
                                    <span className="text-6xl sm:text-7xl font-black text-heading tracking-tighter leading-none">
                                        {stat.number}
                                    </span>
                                    <span className="w-2.5 h-2.5 rounded-sm bg-lime mt-2 shrink-0" />
                                </div>
                                <p className="text-base font-bold text-heading mt-3 uppercase tracking-widest text-sm">
                                    {stat.label}
                                </p>
                                <p className="text-muted font-medium mt-2 leading-relaxed text-sm max-w-xs mx-auto lg:mx-0">
                                    {stat.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── FINAL CTA ─── */}
            <section className="bg-cream relative overflow-hidden">
                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-lime/10 rounded-full blur-3xl" />
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-lime/5 rounded-full blur-3xl" />

                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-24 lg:py-32 text-center relative z-10">
                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-heading tracking-tight leading-[0.95]">
                        Ready to Elevate<br />Campus Living<span className="text-lime">?</span>
                    </h2>
                    <p className="text-body font-medium mt-6 max-w-lg mx-auto leading-relaxed text-lg">
                        Join the modern approach to hostel management. Fast, fair, and fully automated.
                    </p>
                    <div className="flex items-center justify-center gap-4 mt-10">
                        <Link
                            to="/register"
                            className="inline-flex items-center gap-2 bg-lime text-forest font-bold px-8 py-4 rounded-full shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all text-lg"
                        >
                            Get Started
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 bg-forest text-white font-bold px-8 py-4 rounded-full shadow-lg shadow-forest/25 hover:bg-forest-light transition-all text-lg"
                        >
                            Admin Login
                        </Link>
                    </div>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className="bg-forest">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div>
                            <span className="text-lg font-black text-white tracking-tight">HMS</span>
                            <p className="text-white/30 text-sm font-medium mt-1">Hostel Management System</p>
                        </div>
                        <div className="flex items-center gap-6 text-sm font-medium text-white/40">
                            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
                            <Link to="/register" className="hover:text-white transition-colors">Register</Link>
                            <a href="#features" className="hover:text-white transition-colors">Features</a>
                        </div>
                    </div>
                    <div className="border-t border-white/10 mt-8 pt-8 text-center">
                        <p className="text-white/20 text-xs font-medium">&copy; {new Date().getFullYear()} HMS. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
