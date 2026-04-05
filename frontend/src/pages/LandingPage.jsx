import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { ArrowRight, Search, BedDouble, Users, ShieldCheck, BarChart3, ClipboardList, RefreshCw, ChevronRight, Zap } from 'lucide-react';

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
            <nav className="sticky top-0 z-50 bg-cream/80 backdrop-blur-md border-b border-black/5">
                <div className="max-w-6xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link to="/" className="text-xl font-black text-heading tracking-tight">
                        HMS
                    </Link>
                    <div className="flex items-center gap-6">
                        <a href="#features" className="hidden sm:block text-sm font-semibold text-muted hover:text-heading transition-colors">
                            Features
                        </a>
                        <a href="#how-it-works" className="hidden sm:block text-sm font-semibold text-muted hover:text-heading transition-colors">
                            How It Works
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
            <section className="max-w-6xl mx-auto px-6 lg:px-8 pt-16 pb-24 lg:pt-24 lg:pb-32">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                    {/* Left — Copy */}
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-lime/20 text-forest text-xs font-bold uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 rounded-full bg-forest" />
                            AI-Driven Hostel Management
                        </div>
                        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-heading tracking-tight leading-[0.95]">
                            Seamless<br />
                            Hostel Living<br />
                            Starts Here<span className="text-lime">.</span>
                        </h1>
                        <p className="text-lg text-body font-medium max-w-lg leading-relaxed">
                            Compatibility-matched bed allocation, transparent multi-component fees,
                            and Paystack-verified payments. No queues. No manual verification.
                        </p>
                        <div className="flex items-center gap-4">
                            <Link
                                to="/register"
                                className="inline-flex items-center gap-2 bg-lime text-forest font-bold px-7 py-4 rounded-full shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all text-base"
                            >
                                Apply for Hostel
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
                                            placeholder="e.g. CSC/2022/001"
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

            {/* ─── HOW IT WORKS ─── */}
            <section id="how-it-works" className="bg-white border-y border-black/5">
                <div className="max-w-6xl mx-auto px-6 lg:px-8 py-20 lg:py-28">
                    <div className="text-center mb-16">
                        <p className="text-[11px] font-bold text-lime uppercase tracking-[0.25em]">Student Journey</p>
                        <h2 className="text-4xl sm:text-5xl font-black text-heading tracking-tight mt-3">
                            Six Steps to Your Bed
                        </h2>
                        <p className="text-body font-medium mt-4 max-w-xl mx-auto">
                            From registration to allocated bed — fully online, no office visits required.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { step: '01', title: 'Register', desc: 'Your matric number is verified against the official session register. Details are auto-populated from the institutional record.' },
                            { step: '02', title: 'Apply', desc: 'Select three ranked hostel preferences and review the itemised fee breakdown for your study type before proceeding.' },
                            { step: '03', title: 'Pay via Paystack', desc: 'Complete payment securely through Paystack. A session-scoped HMS receipt reference is generated upon confirmation.' },
                            { step: '04', title: 'Lifestyle Quiz', desc: 'Answer eight lifestyle questions covering sleep time, study habits, cleanliness, and social preferences.' },
                            { step: '05', title: 'AI Matching', desc: 'A weighted cosine similarity algorithm matches you with the most compatible roommates across your preferred hostels.' },
                            { step: '06', title: 'Get Allocated', desc: 'Your bed is atomically assigned with zero chance of double-booking. View your room, bed, and roommate profiles instantly.' },
                        ].map((s) => (
                            <div key={s.step} className="group p-6 rounded-2xl border border-black/5 hover:border-lime/40 hover:bg-lime/5 transition-all">
                                <span className="text-4xl font-black text-lime/30 group-hover:text-lime/60 transition-colors leading-none">{s.step}</span>
                                <h3 className="text-base font-bold text-heading mt-3">{s.title}</h3>
                                <p className="text-sm text-body font-medium mt-2 leading-relaxed">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── FEATURES ─── */}
            <section id="features" className="bg-forest">
                <div className="max-w-6xl mx-auto px-6 lg:px-8 py-20 lg:py-28">
                    <div className="text-center mb-16">
                        <p className="text-[11px] font-bold text-lime uppercase tracking-[0.25em]">Platform Capabilities</p>
                        <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight mt-3">
                            Built for Modern Campus Operations
                        </h2>
                        <p className="text-white/40 font-medium mt-4 max-w-xl mx-auto">
                            Every feature addresses a documented failure mode in manual Nigerian university hostel management.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            {
                                icon: ShieldCheck,
                                tag: 'Identity Verification',
                                title: 'Session Register Validation',
                                desc: 'Every registration is checked against the officially uploaded student register CSV. No enrollment, no access — eliminating unauthorised platform entry entirely.',
                                detail: 'Admins upload the current session register. Matric numbers are validated in real-time at point of registration.',
                            },
                            {
                                icon: BedDouble,
                                tag: 'AI Compatibility',
                                title: 'Weighted Cosine Similarity Matching',
                                desc: 'Eight lifestyle dimensions — sleep time, study noise, cleanliness, visitor frequency, and more — are encoded as normalised vectors and matched using weighted cosine similarity.',
                                detail: 'Dimension weights are derived from roommate conflict research specific to Nigerian university hostels.',
                            },
                            {
                                icon: Zap,
                                tag: 'Secure Payments',
                                title: 'Paystack Multi-Component Fees',
                                desc: 'Hostel fees are split into named components (accommodation, electricity levy, caution deposit, etc.) per study type, with Paystack as the verified payment gateway.',
                                detail: 'Each payment generates a session-scoped HMS receipt reference replacing unverifiable paper receipts.',
                            },
                            {
                                icon: ClipboardList,
                                tag: 'Accountability',
                                title: 'Immutable Audit Trail',
                                desc: 'Twenty-two categories of administrative events are recorded in an append-only table. INSERT-only database permissions guarantee tamper resistance at the infrastructure level.',
                                detail: 'Allocation decisions, portal toggles, fee changes, and register imports are all logged with actor, timestamp, and metadata.',
                            },
                            {
                                icon: BarChart3,
                                tag: 'Reporting',
                                title: 'Admin Report Builder',
                                desc: 'Construct custom data extracts by selecting filters and columns from a predefined catalogue spanning all system domains — students, payments, allocations, and sessions.',
                                detail: 'Live preview with CSV export. Natural language queries powered by Google Gemini API.',
                            },
                            {
                                icon: Users,
                                tag: 'Concurrency Safety',
                                title: 'Atomic Bed Assignment',
                                desc: 'Bed allocation runs inside a PostgreSQL stored function using SELECT FOR UPDATE SKIP LOCKED — preventing double-bookings even under simultaneous student submissions.',
                                detail: 'The entire compatibility computation, locking, and allocation insertion is a single atomic transaction.',
                            },
                        ].map((f, i) => {
                            const Icon = f.icon;
                            return (
                                <div key={i} className="bg-forest-light rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-lime/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <Icon className="w-5 h-5 text-lime" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-lime/60 uppercase tracking-widest mb-1">{f.tag}</p>
                                            <h3 className="text-base font-bold text-white">{f.title}</h3>
                                            <p className="text-sm text-white/50 font-medium mt-2 leading-relaxed">{f.desc}</p>
                                            <p className="text-xs text-white/30 font-medium mt-3 leading-relaxed border-t border-white/5 pt-3">{f.detail}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ─── METRICS ─── */}
            <section id="metrics" className="bg-cream">
                <div className="max-w-6xl mx-auto px-6 lg:px-8 py-20 lg:py-28">
                    <div className="text-center mb-16">
                        <p className="text-[11px] font-bold text-lime uppercase tracking-[0.25em]">System Scope</p>
                        <h2 className="text-4xl sm:text-5xl font-black text-heading tracking-tight mt-3">
                            Designed for Scale
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 lg:gap-8">
                        {[
                            { number: '19', label: 'Application Screens', desc: '3 public, 8 student portal, 8 admin portal pages' },
                            { number: '22', label: 'Audit Event Types', desc: 'Every significant system action recorded immutably' },
                            { number: '8', label: 'Lifestyle Dimensions', desc: 'Vector dimensions used in compatibility matching' },
                            { number: '15', label: 'Database Tables', desc: 'Third Normal Form schema with full referential integrity' },
                        ].map((stat, i) => (
                            <div key={i} className="text-center p-6 rounded-2xl border border-black/5 hover:border-lime/30 transition-all">
                                <span className="text-5xl sm:text-6xl font-black text-heading tracking-tighter leading-none">
                                    {stat.number}
                                </span>
                                <p className="text-sm font-bold text-heading mt-3 uppercase tracking-wider">
                                    {stat.label}
                                </p>
                                <p className="text-muted font-medium mt-2 leading-relaxed text-xs">
                                    {stat.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── FINAL CTA ─── */}
            <section className="bg-forest">
                <div className="max-w-6xl mx-auto px-6 lg:px-8 py-20 lg:py-28 text-center">
                    <p className="text-[11px] font-bold text-lime uppercase tracking-[0.25em]">Get Started</p>
                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[0.95] mt-4">
                        Ready for a Smarter<br />Hostel Experience<span className="text-lime">?</span>
                    </h2>
                    <p className="text-white/50 font-medium mt-6 max-w-lg mx-auto leading-relaxed text-lg">
                        Create your account today. Your matric number is all you need to begin.
                    </p>
                    <div className="flex items-center justify-center gap-4 mt-10">
                        <Link
                            to="/register"
                            className="inline-flex items-center gap-2 bg-lime text-forest font-bold px-8 py-4 rounded-full shadow-lg shadow-lime/25 hover:bg-lime-hover hover:scale-[1.02] transition-all text-lg"
                        >
                            Create Account
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 text-white/60 font-bold px-8 py-4 rounded-full hover:text-white hover:bg-white/5 transition-all text-lg"
                        >
                            Sign In
                            <ChevronRight className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className="bg-forest border-t border-white/10">
                <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div>
                            <span className="text-lg font-black text-white tracking-tight">HMS</span>
                            <p className="text-white/30 text-sm font-medium mt-1">AI-Driven Hostel Management System</p>
                        </div>
                        <div className="flex items-center gap-6 text-sm font-medium text-white/40">
                            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
                            <Link to="/register" className="hover:text-white transition-colors">Register</Link>
                            <a href="#features" className="hover:text-white transition-colors">Features</a>
                            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
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
