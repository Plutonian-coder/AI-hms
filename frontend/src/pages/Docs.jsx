import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    BookOpen, ChevronRight, ArrowRight, Menu, X,
    UserCheck, FileText, CreditCard, ClipboardCheck, BedDouble,
    LayoutDashboard, Building2, ShieldCheck, BarChart3,
    Users, Settings, LogOut, Search, Printer, AlertCircle,
    Lock, Moon, Type, Download, Upload, RefreshCw, Eye,
    CheckCircle, Info, Hash, ChevronDown
} from 'lucide-react';

/* ─── Section anchor IDs ────────────────────────────────────────────── */
const TOC = [
    {
        id: 'overview', label: 'Overview', icon: BookOpen,
        children: [
            { id: 'what-is-hms', label: 'What is HMS?' },
            { id: 'who-is-it-for', label: 'Who Is It For?' },
            { id: 'key-capabilities', label: 'Key Capabilities' },
        ],
    },
    {
        id: 'getting-started', label: 'Getting Started', icon: ArrowRight,
        children: [
            { id: 'prerequisites', label: 'Prerequisites' },
            { id: 'registration', label: 'Creating an Account' },
            { id: 'login', label: 'Signing In' },
            { id: 'forgot-password', label: 'Forgot Password' },
        ],
    },
    {
        id: 'student-guide', label: 'Student Guide', icon: UserCheck,
        children: [
            { id: 'student-dashboard', label: 'Dashboard Overview' },
            { id: 'hostel-application', label: 'Hostel Application' },
            { id: 'payment', label: 'Fee Payment' },
            { id: 'payment-callback', label: 'Payment Confirmation' },
            { id: 'compatibility-quiz', label: 'Compatibility Quiz' },
            { id: 'allocation', label: 'AI Bed Allocation' },
            { id: 'my-allocation', label: 'My Allocation Page' },
            { id: 'receipt', label: 'HMS Receipt' },
        ],
    },
    {
        id: 'admin-guide', label: 'Admin Guide', icon: ShieldCheck,
        children: [
            { id: 'admin-dashboard', label: 'Admin Dashboard' },
            { id: 'sessions', label: 'Academic Sessions' },
            { id: 'register-import', label: 'Register Import' },
            { id: 'fee-components', label: 'Fee Components Builder' },
            { id: 'hostels', label: 'Hostels Management' },
            { id: 'blocks-rooms-beds', label: 'Blocks, Rooms & Beds' },
            { id: 'admin-students', label: 'Student Management' },
            { id: 'admin-allocations', label: 'Allocations Management' },
            { id: 'admin-transactions', label: 'Transactions' },
            { id: 'audit-logs', label: 'Audit Logs' },
            { id: 'report-builder', label: 'Report Builder' },
            { id: 'ai-query', label: 'AI Natural Language Query' },
        ],
    },
    {
        id: 'account-settings', label: 'Account & Settings', icon: Settings,
        children: [
            { id: 'appearance', label: 'Appearance' },
            { id: 'change-password', label: 'Changing Your Password' },
        ],
    },
    {
        id: 'public-features', label: 'Public Features', icon: Search,
        children: [
            { id: 'allocation-checker', label: 'Allocation Status Checker' },
        ],
    },
    {
        id: 'reference', label: 'Reference', icon: Hash,
        children: [
            { id: 'portal-lifecycle', label: 'Portal Lifecycle' },
            { id: 'hms-receipt-format', label: 'HMS Receipt Format' },
            { id: 'lifestyle-dimensions', label: '8 Lifestyle Dimensions' },
            { id: 'audit-event-types', label: 'Audit Event Types' },
            { id: 'study-types', label: 'Study Types & Levels' },
            { id: 'csv-format', label: 'Register CSV Format' },
        ],
    },
];

/* ─── Small reusable components ──────────────────────────────────────── */
function Callout({ type = 'info', children }) {
    const styles = {
        info:    { bg: 'bg-blue-50 border-blue-200',   icon: Info,         iconColor: 'text-blue-500' },
        warning: { bg: 'bg-amber-50 border-amber-200', icon: AlertCircle,  iconColor: 'text-amber-500' },
        tip:     { bg: 'bg-lime/10 border-lime/40',    icon: CheckCircle,  iconColor: 'text-forest' },
    };
    const s = styles[type] || styles.info;
    const Icon = s.icon;
    return (
        <div className={`flex gap-3 p-4 rounded-xl border ${s.bg} my-4`}>
            <Icon className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${s.iconColor}`} />
            <div className="text-sm text-body leading-relaxed">{children}</div>
        </div>
    );
}

function StepList({ steps }) {
    return (
        <ol className="space-y-3 my-4">
            {steps.map((s, i) => (
                <li key={i} className="flex gap-4 items-start">
                    <span className="w-6 h-6 rounded-full bg-forest text-lime font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                    </span>
                    <span className="text-sm text-body leading-relaxed">{s}</span>
                </li>
            ))}
        </ol>
    );
}

function Table({ headers, rows }) {
    return (
        <div className="overflow-x-auto my-4 rounded-xl border border-black/8">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-surface-2 border-b border-black/8">
                        {headers.map((h, i) => (
                            <th key={i} className="px-4 py-3 text-left text-xs font-bold text-muted uppercase tracking-widest whitespace-nowrap">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                    {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-surface transition-colors">
                            {row.map((cell, j) => (
                                <td key={j} className="px-4 py-3 text-body align-top">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Badge({ children, color = 'lime' }) {
    const colors = {
        lime:   'bg-lime/15 text-forest border-lime/30',
        forest: 'bg-forest/10 text-forest border-forest/20',
        amber:  'bg-amber-50 text-amber-700 border-amber-200',
        red:    'bg-red-50 text-red-700 border-red-200',
        blue:   'bg-blue-50 text-blue-700 border-blue-200',
        gray:   'bg-surface-2 text-muted border-black/10',
    };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${colors[color]}`}>
            {children}
        </span>
    );
}

function SectionAnchor({ id }) {
    return <span id={id} className="block -mt-20 pt-20 invisible" aria-hidden="true" />;
}

/* ─── TOC Sidebar ─────────────────────────────────────────────────────── */
function TocSidebar({ activeId }) {
    const [expanded, setExpanded] = useState(() => TOC.map(s => s.id));

    const toggle = (id) => setExpanded(p =>
        p.includes(id) ? p.filter(x => x !== id) : [...p, id]
    );

    return (
        <nav className="space-y-1">
            {TOC.map(section => {
                const Icon = section.icon;
                const isExpanded = expanded.includes(section.id);
                return (
                    <div key={section.id}>
                        <button
                            onClick={() => toggle(section.id)}
                            className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-bold text-heading hover:bg-surface-2 transition-colors"
                        >
                            <span className="flex items-center gap-2.5">
                                <Icon className="w-3.5 h-3.5 text-muted-light shrink-0" />
                                {section.label}
                            </span>
                            <ChevronDown className={`w-3 h-3 text-muted-light transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isExpanded && (
                            <div className="ml-5 mt-0.5 space-y-0.5 border-l border-black/8 pl-3">
                                {section.children.map(child => (
                                    <a
                                        key={child.id}
                                        href={`#${child.id}`}
                                        className={`block py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
                                            activeId === child.id
                                                ? 'text-forest font-bold bg-lime/10'
                                                : 'text-muted hover:text-heading hover:bg-surface-2'
                                        }`}
                                    >
                                        {child.label}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}

/* ─── Content Sections ────────────────────────────────────────────────── */
function ContentSections() {
    return (
        <div className="prose-custom space-y-16">

            {/* ── OVERVIEW ──────────────────────────────────────── */}
            <section>
                <SectionAnchor id="overview" />
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-forest flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-lime" />
                    </div>
                    <h2 className="text-2xl font-black text-heading tracking-tight">Overview</h2>
                </div>

                <SectionAnchor id="what-is-hms" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">What is HMS?</h3>
                <p className="text-body leading-relaxed mb-3">
                    The <strong>HMS (Hostel Management System)</strong> is an AI-driven web platform designed
                    to fully automate the hostel accommodation process for Nigerian tertiary institutions.
                    It replaces the manual, paper-based queue system used in most universities with a
                    transparent, paperless, and intelligent digital workflow.
                </p>
                <p className="text-body leading-relaxed mb-3">
                    The system handles the complete hostel lifecycle — from verifying that a student
                    is enrolled in the current academic session, through online payment of itemised
                    hostel fees, to AI-powered roommate matching and instant atomic bed allocation —
                    all accessible from any web browser with no office visits required.
                </p>
                <p className="text-body leading-relaxed">
                    The platform is deployed at{' '}
                    <a
                        href="https://ai-hms-nine.vercel.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-forest font-semibold hover:underline"
                    >
                        ai-hms-nine.vercel.app
                    </a>{' '}
                    and is configured for University (BSc) mode, supporting levels 100L through 500L
                    across three study types: Full-time, Part-time, and Sandwich.
                </p>

                <SectionAnchor id="who-is-it-for" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Who Is It For?</h3>
                <Table
                    headers={['User Role', 'Description', 'How They Access It']}
                    rows={[
                        [<Badge color="forest">Student</Badge>, 'Enrolled students applying for hostel accommodation in the active academic session.', 'Register at /register then use the Student Portal.'],
                        [<Badge color="amber">Admin</Badge>, 'Hostel officers and Student Affairs staff managing the full hostel lifecycle.', 'Login at /login with an admin account provisioned by the system.'],
                        ['Public', 'Anyone can check an allocation status using a matric number on the landing page — no login required.', 'Visit the homepage and use the Allocation Checker widget.'],
                    ]}
                />

                <SectionAnchor id="key-capabilities" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Key Capabilities</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {[
                        { icon: ShieldCheck, title: 'Session Register Verification', desc: 'Every registration is validated against the officially uploaded CSV register for the active session. Only enrolled students can create an account.' },
                        { icon: CreditCard, title: 'Multi-Component Fee Payment', desc: 'Hostel fees are itemised by component (Accommodation, Utilities, Levies) with amounts per study type. Payments are processed via Paystack.' },
                        { icon: BedDouble, title: 'AI Roommate Matching', desc: 'An 8-dimensional weighted cosine similarity algorithm pairs students based on lifestyle compatibility, replacing random bed assignment entirely.' },
                        { icon: ShieldCheck, title: 'Immutable Audit Trail', desc: '22 categories of admin actions are permanently recorded with actor, timestamp, and metadata. Records cannot be modified or deleted.' },
                        { icon: BarChart3, title: 'Report Builder', desc: 'Admins build cross-domain reports from student, payment, and allocation data with live preview and CSV export.' },
                        { icon: Search, title: 'AI Natural Language Query', desc: 'Admins query the live database in plain English. Groq AI generates read-only SQL that is validated before execution.' },
                    ].map((c, i) => {
                        const Icon = c.icon;
                        return (
                            <div key={i} className="flex gap-3 p-4 rounded-xl border border-black/8 bg-surface">
                                <div className="w-8 h-8 rounded-lg bg-lime/15 flex items-center justify-center shrink-0 mt-0.5">
                                    <Icon className="w-4 h-4 text-forest" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-heading">{c.title}</p>
                                    <p className="text-xs text-muted mt-1 leading-relaxed">{c.desc}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── GETTING STARTED ──────────────────────────────── */}
            <section>
                <SectionAnchor id="getting-started" />
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-forest flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-lime" />
                    </div>
                    <h2 className="text-2xl font-black text-heading tracking-tight">Getting Started</h2>
                </div>

                <SectionAnchor id="prerequisites" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Prerequisites</h3>
                <p className="text-body leading-relaxed mb-3">
                    Before registering, you must meet the following conditions:
                </p>
                <ul className="space-y-2 list-none">
                    {[
                        'Your matriculation number must be on the session register uploaded by the administrator for the active academic session.',
                        'The application portal must be open — your administrator controls when registration and applications are accepted.',
                        'A valid email address and Nigerian phone number are required for your account.',
                        'Access to the Paystack-supported payment channels (card, bank transfer, USSD, or mobile money) to complete your hostel fee payment.',
                    ].map((item, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                            <CheckCircle className="w-4 h-4 text-forest shrink-0 mt-0.5" />
                            <span className="text-sm text-body">{item}</span>
                        </li>
                    ))}
                </ul>
                <Callout type="warning">
                    If your matric number is rejected during registration, it means you are not on the
                    session register for the current academic session. Contact your Student Affairs Unit
                    or ICT department to confirm your enrolment status.
                </Callout>

                <SectionAnchor id="registration" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Creating an Account</h3>
                <p className="text-body leading-relaxed mb-2">
                    Navigate to <span className="font-mono text-xs bg-surface-2 px-2 py-0.5 rounded-md">/register</span> or
                    click <strong>Get Started</strong> on the homepage.
                </p>
                <StepList steps={[
                    'Enter your matriculation number. The system validates it against the session register in real time.',
                    'Your surname, first name, gender, department, level, and study type are auto-populated from the institutional record — these fields are read-only.',
                    'Enter your email address, phone number (Nigerian format), and create a password (minimum 8 characters).',
                    'Enter your next-of-kin name and phone number.',
                    'Click Create Account. You are redirected to the Student Dashboard.',
                ]} />
                <Callout type="tip">
                    Your personal details (name, department, level, study type) come directly from the
                    session register uploaded by the administrator — you cannot change them during
                    registration. If they are incorrect, contact Student Affairs.
                </Callout>

                <SectionAnchor id="login" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Signing In</h3>
                <p className="text-body leading-relaxed mb-2">
                    Navigate to <span className="font-mono text-xs bg-surface-2 px-2 py-0.5 rounded-md">/login</span>.
                </p>
                <StepList steps={[
                    'Enter your matriculation number (for students) or admin ID (for administrators).',
                    'Enter your password.',
                    'Click Sign In. The system redirects you to the appropriate portal based on your role.',
                ]} />
                <Callout type="info">
                    Authenticated sessions persist in your browser. If you close the tab and return,
                    you will remain signed in until the token expires (24 hours) or you sign out manually.
                </Callout>

                <SectionAnchor id="forgot-password" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Forgot Password</h3>
                <p className="text-body leading-relaxed">
                    On the login page, click <strong>Forgot password?</strong> and enter your registered
                    email address. A password reset link will be sent to that email. Click the link in
                    the email to set a new password. Reset links expire after a limited period — request
                    a new one if yours has expired.
                </p>
            </section>

            {/* ── STUDENT GUIDE ─────────────────────────────────── */}
            <section>
                <SectionAnchor id="student-guide" />
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-forest flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-lime" />
                    </div>
                    <h2 className="text-2xl font-black text-heading tracking-tight">Student Guide</h2>
                </div>
                <p className="text-body leading-relaxed mb-6">
                    The student journey follows a strict six-step sequential gate. You must complete each
                    step before the next one becomes available. The system enforces this at the backend —
                    attempting to skip steps returns an access error.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                    {[
                        { n: '01', label: 'Register' },
                        { n: '02', label: 'Apply' },
                        { n: '03', label: 'Pay' },
                        { n: '04', label: 'Quiz' },
                        { n: '05', label: 'Allocate' },
                        { n: '06', label: 'View Room' },
                    ].map(s => (
                        <div key={s.n} className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-black/8">
                            <span className="text-2xl font-black text-lime/60 leading-none shrink-0">{s.n}</span>
                            <span className="text-sm font-bold text-heading">{s.label}</span>
                        </div>
                    ))}
                </div>

                <SectionAnchor id="student-dashboard" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Dashboard Overview</h3>
                <p className="text-body leading-relaxed mb-3">
                    After signing in, you land on the <strong>Student Dashboard</strong> at
                    <span className="font-mono text-xs bg-surface-2 px-2 py-0.5 rounded-md ml-1">/</span>.
                    The dashboard shows:
                </p>
                <ul className="space-y-2 list-none mb-4">
                    {[
                        'Your progress through the six steps, with a completion percentage bar.',
                        'The active academic session name and dates.',
                        'A "Next Step" call-to-action button that links directly to the step you need to complete.',
                        'Your profile details (name, matric number, level, department, study type).',
                        'Editable profile fields: email, phone, next-of-kin name, and next-of-kin phone.',
                    ].map((item, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                            <ChevronRight className="w-3.5 h-3.5 text-forest shrink-0 mt-1" />
                            <span className="text-sm text-body">{item}</span>
                        </li>
                    ))}
                </ul>
                <Callout type="tip">
                    Click the pencil icon on the dashboard to edit your email, phone, or next-of-kin
                    details at any time. Matric number, name, department, level, and study type are
                    sourced from the official register and cannot be changed by students.
                </Callout>

                <SectionAnchor id="hostel-application" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Hostel Application</h3>
                <p className="text-body leading-relaxed mb-2">
                    Navigate to <strong>Apply</strong> in the sidebar, or follow the dashboard link. The
                    application portal must be open for this step to be accessible.
                </p>
                <StepList steps={[
                    'Review the Fee Summary panel on the right — it shows every fee component applicable to your study type, with individual amounts and the total in Naira.',
                    'Select your 1st, 2nd, and 3rd hostel preferences from the dropdowns. Only hostels matching your gender are shown.',
                    'Optionally add disability notes or welfare requests in the provided text field.',
                    'Click Submit Application. The application is saved and the Payment step becomes available.',
                ]} />
                <Callout type="info">
                    All three hostel preference selections are required. The allocation algorithm will
                    attempt your first choice first, then fall back to your second, then third. If no
                    compatible bed is available in any of your preferred hostels, you will receive a
                    system notification.
                </Callout>

                <SectionAnchor id="payment" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Fee Payment</h3>
                <p className="text-body leading-relaxed mb-2">
                    Navigate to <strong>Payment</strong> in the sidebar. The payment portal must be open.
                </p>
                <StepList steps={[
                    'Review your payment summary showing all fee components, amounts, and the total due.',
                    'Confirm your email address — it will be used by Paystack for the payment receipt.',
                    'Click Pay Now. You are redirected to the Paystack-hosted checkout page.',
                    'Complete the payment using your preferred channel: card, bank transfer, USSD, or mobile money.',
                    'After successful payment, Paystack redirects you to the Payment Callback page.',
                ]} />
                <Callout type="warning">
                    Do not close the browser tab after being redirected to Paystack. If the redirect
                    back to HMS fails, your payment is still verified by Paystack's server-to-server
                    webhook — contact the administrator with your Paystack transaction reference if
                    your payment status is not updated within a few minutes.
                </Callout>

                <SectionAnchor id="payment-callback" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Payment Confirmation</h3>
                <p className="text-body leading-relaxed mb-3">
                    After Paystack redirects you back, the <strong>Payment Callback</strong> page at
                    <span className="font-mono text-xs bg-surface-2 px-2 py-0.5 rounded-md ml-1">/payment/callback</span>{' '}
                    verifies your transaction in real time using a live status stream. You will see each
                    verification step complete in sequence:
                </p>
                <ol className="space-y-2 list-none mb-4">
                    {[
                        'Receiving payment reference from Paystack',
                        'Verifying transaction with Paystack API',
                        'Confirming payment amount matches your study type fee',
                        'Generating your HMS receipt reference',
                        'Unlocking the Compatibility Quiz step',
                    ].map((step, i) => (
                        <li key={i} className="flex gap-3 items-center">
                            <span className="w-5 h-5 rounded-full bg-lime/20 text-forest font-black text-[10px] flex items-center justify-center shrink-0">
                                {i + 1}
                            </span>
                            <span className="text-sm text-body">{step}</span>
                        </li>
                    ))}
                </ol>
                <p className="text-body text-sm leading-relaxed">
                    On success, your unique <strong>HMS Receipt Reference</strong> (format:{' '}
                    <span className="font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded">HMS/2025/00001</span>)
                    is displayed and the Compatibility Quiz becomes available.
                </p>

                <SectionAnchor id="compatibility-quiz" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Compatibility Quiz</h3>
                <p className="text-body leading-relaxed mb-3">
                    Navigate to <strong>Compatibility Quiz</strong> in the sidebar. This step must be
                    completed before bed allocation can occur. The allocation portal must be open.
                </p>
                <p className="text-body leading-relaxed mb-3">
                    The quiz presents <strong>8 questions</strong>, each corresponding to a lifestyle
                    dimension used by the matching algorithm. Each question offers multiple choice
                    options that map to a normalised value between 0.0 and 1.0.
                </p>
                <Table
                    headers={['#', 'Dimension', 'What It Measures']}
                    rows={[
                        ['1', 'Sleep Time', 'When you typically go to sleep (early vs. late night)'],
                        ['2', 'Wake Time', 'When you typically wake up (early morning vs. late morning)'],
                        ['3', 'Study Noise', 'Preferred noise level when studying (silence vs. background music vs. TV)'],
                        ['4', 'Cleanliness', 'Your standard for room cleanliness (spotless vs. relaxed)'],
                        ['5', 'Visitor Frequency', 'How often you have guests over (never vs. frequently)'],
                        ['6', 'Night Device Use', 'Use of phone/laptop with screen light or sound at night'],
                        ['7', 'Social Preference', 'Preferred level of social interaction with roommates'],
                        ['8', 'Noise Tolerance', 'How tolerant you are of noise from others'],
                    ]}
                />
                <StepList steps={[
                    'Answer each of the 8 questions using the card-style selectors. You can navigate back to any previous question.',
                    'All 8 questions must be answered before submission.',
                    'Click Submit Answers. The system converts your answers to a lifestyle vector and runs the allocation algorithm immediately.',
                    'A live SSE stream shows each step of the matching and allocation process in real time.',
                    'On success, you are redirected to the My Allocation page.',
                ]} />
                <Callout type="warning">
                    Once submitted, the compatibility quiz cannot be retaken. Your answers are encoded
                    into your lifestyle vector and used for the bed allocation. If you need to dispute
                    your allocation, contact your administrator.
                </Callout>

                <SectionAnchor id="allocation" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">AI Bed Allocation</h3>
                <p className="text-body leading-relaxed mb-3">
                    The allocation happens automatically when you submit the compatibility quiz. The
                    algorithm works as follows:
                </p>
                <ol className="space-y-3 mb-4">
                    {[
                        'Your lifestyle vector (8 normalised values from the quiz) is compared against the average vectors of all rooms in your first-choice hostel.',
                        'For each room, the system computes a weighted cosine similarity score reflecting how compatible you are with the room\'s existing occupants.',
                        'The room with the highest compatibility score and at least one vacant bed is selected.',
                        'If no suitable bed is found in your first-choice hostel, the algorithm falls back to your second choice, then third.',
                        'The selected bed is locked using PostgreSQL\'s SELECT FOR UPDATE SKIP LOCKED mechanism — preventing double-booking even if multiple students submit simultaneously.',
                        'Your allocation record is created and the compatibility score is recorded.',
                        'Groq AI generates a human-readable explanation of your matching result.',
                    ].map((step, i) => (
                        <li key={i} className="flex gap-4 items-start">
                            <span className="w-6 h-6 rounded-full bg-forest text-lime font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                                {i + 1}
                            </span>
                            <span className="text-sm text-body leading-relaxed">{step}</span>
                        </li>
                    ))}
                </ol>
                <Callout type="info">
                    The algorithm tries all three of your hostel preferences before reporting a failure.
                    If no bed is available across all three, an administrator can manually manage
                    allocations from the Admin Portal.
                </Callout>

                <SectionAnchor id="my-allocation" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">My Allocation Page</h3>
                <p className="text-body leading-relaxed mb-3">
                    Navigate to <strong>My Allocation</strong> in the sidebar to see your confirmed
                    accommodation details. This page shows:
                </p>
                <ul className="space-y-2 list-none mb-4">
                    {[
                        'Hostel name and block assignment.',
                        'Your specific bed number and room number.',
                        'Current room occupancy (e.g., 2/4 people).',
                        'Your average compatibility score with roommates.',
                        'Your HMS receipt reference and allocation date.',
                        'Which of your three preference choices you were matched from.',
                        'Your roommates\' names and matric numbers with individual compatibility scores.',
                        'A Lifestyle Profile radar chart comparing your 8-dimension vector against the room average.',
                    ].map((item, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                            <ChevronRight className="w-3.5 h-3.5 text-forest shrink-0 mt-1" />
                            <span className="text-sm text-body">{item}</span>
                        </li>
                    ))}
                </ul>

                <SectionAnchor id="receipt" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">HMS Receipt</h3>
                <p className="text-body leading-relaxed mb-3">
                    Click <strong>View Receipt</strong> on the My Allocation page, or navigate to
                    <span className="font-mono text-xs bg-surface-2 px-2 py-0.5 rounded-md ml-1">/receipt</span>.
                    The receipt displays:
                </p>
                <ul className="space-y-2 list-none mb-4">
                    {[
                        'Your full name, matric number, department, level, and study type.',
                        'The academic session and payment confirmation date.',
                        'An itemised breakdown of every fee component paid, with individual amounts.',
                        'The total amount paid in Naira.',
                        'Your unique HMS receipt reference (e.g., HMS/2025/00001).',
                        'Your allocated hostel, room, and bed details.',
                    ].map((item, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                            <CheckCircle className="w-3.5 h-3.5 text-forest shrink-0 mt-1" />
                            <span className="text-sm text-body">{item}</span>
                        </li>
                    ))}
                </ul>
                <Callout type="tip">
                    Use your browser's print function (Ctrl+P / Cmd+P) to print or save the receipt
                    as a PDF. The receipt is permanently accessible as long as your account is active —
                    you do not need to save a copy immediately.
                </Callout>
            </section>

            {/* ── ADMIN GUIDE ──────────────────────────────────── */}
            <section>
                <SectionAnchor id="admin-guide" />
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-forest flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-lime" />
                    </div>
                    <h2 className="text-2xl font-black text-heading tracking-tight">Admin Guide</h2>
                </div>
                <p className="text-body leading-relaxed mb-6">
                    Admin accounts are provisioned directly in the database. Admins access the system
                    at <span className="font-mono text-xs bg-surface-2 px-2 py-0.5 rounded-md">/login</span> with
                    their admin ID and password, and are redirected to the <strong>Admin Portal</strong> at{' '}
                    <span className="font-mono text-xs bg-surface-2 px-2 py-0.5 rounded-md">/admin</span>.
                </p>

                <SectionAnchor id="admin-dashboard" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Admin Dashboard</h3>
                <p className="text-body leading-relaxed mb-3">
                    The admin dashboard provides a real-time operational overview of the system:
                </p>
                <ul className="space-y-2 list-none mb-4">
                    {[
                        'Total students registered in the active session.',
                        'Total confirmed payments and total revenue collected.',
                        'Total allocated beds and overall occupancy rate.',
                        'Portal status panel showing which lifecycle phases are currently open or closed.',
                        'Payment trend chart (bar chart over time).',
                        'Hostel occupancy chart (bar chart per hostel).',
                        'Study type distribution (doughnut chart).',
                        'Recent allocations and recent audit events.',
                        'AI Natural Language Query box for plain-English database questions.',
                    ].map((item, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                            <ChevronRight className="w-3.5 h-3.5 text-forest shrink-0 mt-1" />
                            <span className="text-sm text-body">{item}</span>
                        </li>
                    ))}
                </ul>

                <SectionAnchor id="sessions" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Academic Sessions</h3>
                <p className="text-body leading-relaxed mb-3">
                    Navigate to <strong>Sessions</strong> in the admin sidebar. This is the central
                    control panel for the hostel year. Only one session can be active at a time.
                </p>
                <h4 className="text-sm font-bold text-heading mt-4 mb-2">Creating a Session</h4>
                <StepList steps={[
                    'Click New Session.',
                    'Enter the session name (e.g., 2025/2026), start date, end date, and select eligible levels (e.g., 100L, 200L, 300L, 400L, 500L).',
                    'Save the session. It is created as inactive.',
                    'Click Activate to set it as the current active session. Only one session can be active at a time.',
                ]} />
                <h4 className="text-sm font-bold text-heading mt-5 mb-2">Portal Lifecycle Controls</h4>
                <p className="text-body text-sm leading-relaxed mb-3">
                    Each session has four independent portal toggles. Toggle each on or off to control
                    which phases students can access:
                </p>
                <Table
                    headers={['Toggle', 'What It Controls']}
                    rows={[
                        [<Badge color="blue">Register Import</Badge>, 'Whether the session register CSV can be imported. Open this first before students register.'],
                        [<Badge color="forest">Application Portal</Badge>, 'Whether students can register accounts and submit hostel applications.'],
                        [<Badge color="amber">Payment Portal</Badge>, 'Whether students can proceed to pay their hostel fees.'],
                        [<Badge color="lime">Allocation Portal</Badge>, 'Whether students can take the compatibility quiz and receive bed allocations.'],
                    ]}
                />
                <Callout type="warning">
                    Closing the Application Portal after students have registered does not revoke
                    existing accounts. It only prevents new registrations and application submissions.
                    Once a session is ended, all portals are permanently closed.
                </Callout>

                <SectionAnchor id="register-import" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Register Import</h3>
                <p className="text-body leading-relaxed mb-3">
                    Navigate to <strong>Register Import</strong> in the admin sidebar. This module
                    allows you to upload the official session register CSV file that validates all
                    student registrations.
                </p>
                <Callout type="warning">
                    The Register Import portal toggle must be enabled on the active session before
                    you can upload a register CSV. Disable it after import to prevent accidental
                    re-imports.
                </Callout>
                <StepList steps={[
                    'Ensure the Register Import toggle is ON for the active session (Sessions page).',
                    'Prepare your CSV file in the required format (see Register CSV Format in the Reference section).',
                    'Click Choose File on the Register Import page and select your CSV.',
                    'Click Import Register. The system validates every row and reports errors for invalid entries.',
                    'Review the import summary — it shows how many records were accepted and any rows that failed validation.',
                    'Imported records are visible in the register table below the import form.',
                ]} />
                <Callout type="info">
                    Importing a register for a session that already has records will add to the existing
                    records without deleting prior imports. To replace the register entirely, contact
                    a system administrator to clear existing records first.
                </Callout>

                <SectionAnchor id="fee-components" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Fee Components Builder</h3>
                <p className="text-body leading-relaxed mb-3">
                    Navigate to <strong>Fee Components</strong> in the admin sidebar. This module
                    allows you to define the individual components that make up the total hostel fee
                    for the active session.
                </p>
                <StepList steps={[
                    'Click Add Component.',
                    'Enter the component name (e.g., "Accommodation", "Electricity Levy", "Caution Deposit").',
                    'Enter the amount in Naira for Full-time students, Part-time students, and Sandwich students separately.',
                    'Set the Applies To value: All Students, Full-time Only, Part-time Only, or Freshers Only.',
                    'Toggle Is Mandatory if this component is required for all applicable students.',
                    'Set the Sort Order to control the display sequence on the fee summary and receipt.',
                    'Save the component. It immediately applies to all future payment initialisations.',
                ]} />
                <Callout type="tip">
                    Define all fee components before opening the Payment Portal. Changing component
                    amounts after students have paid does not affect confirmed payments — only new
                    payment initialisations will reflect the updated amounts.
                </Callout>
                <Table
                    headers={['Example Component', 'Applies To', 'Mandatory?']}
                    rows={[
                        ['Accommodation', 'All Students', 'Yes'],
                        ['Room Upkeep', 'All Students', 'Yes'],
                        ['Electricity Levy', 'All Students', 'Yes'],
                        ['Water Levy', 'All Students', 'Yes'],
                        ['Security Levy', 'All Students', 'Yes'],
                        ['Caution Deposit', 'All Students', 'Yes'],
                        ['Bedding Levy', 'Full-time Only', 'Yes'],
                        ['Development Levy', 'All Students', 'No'],
                    ]}
                />

                <SectionAnchor id="hostels" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Hostels Management</h3>
                <p className="text-body leading-relaxed mb-3">
                    Navigate to <strong>Hostels</strong> in the admin sidebar to manage the top-level
                    hostel entities. The system uses a four-level hierarchy:
                    <strong> Hostel → Block → Room → Bed</strong>.
                </p>
                <Table
                    headers={['Field', 'Description']}
                    rows={[
                        ['Name', 'Hostel name (e.g., Augustus Hall, Mary Hall). Must be unique.'],
                        ['Gender Restriction', 'Male, Female, or Mixed. Students only see hostels matching their gender.'],
                        ['Status', 'Active (available for allocation), Maintenance (temporarily unavailable), or Decommissioned (permanently removed from allocation).'],
                        ['Capacity', 'Auto-calculated from the total number of beds in all rooms across all blocks.'],
                    ]}
                />
                <Callout type="info">
                    Deleting a hostel that has active allocations or applications is blocked by the
                    system. Change its status to Decommissioned instead to remove it from future
                    allocation cycles while preserving historical records.
                </Callout>

                <SectionAnchor id="blocks-rooms-beds" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Blocks, Rooms & Beds</h3>
                <p className="text-body leading-relaxed mb-3">
                    Use <strong>Blocks</strong>, <strong>Rooms</strong>, and <strong>Bed Spaces</strong>{' '}
                    in the admin sidebar to manage the sub-structure of each hostel.
                </p>
                <h4 className="text-sm font-bold text-heading mt-4 mb-2">Blocks</h4>
                <p className="text-body text-sm leading-relaxed mb-2">
                    Each hostel contains one or more blocks (e.g., Block A, Block B). Create blocks
                    under a specific hostel. Blocks have an Active or Maintenance status.
                </p>
                <h4 className="text-sm font-bold text-heading mt-4 mb-2">Rooms</h4>
                <p className="text-body text-sm leading-relaxed mb-2">
                    Each block contains one or more rooms. Create rooms under a specific block with
                    a room number. Rooms have an Active or Maintenance status. View room occupants
                    by clicking the room in the Room Students view.
                </p>
                <h4 className="text-sm font-bold text-heading mt-4 mb-2">Bed Spaces</h4>
                <p className="text-body text-sm leading-relaxed mb-2">
                    Each room contains individual bed spaces. Create beds under a specific room with a
                    bed number. Bed status is automatically updated by the system:
                </p>
                <Table
                    headers={['Status', 'Meaning']}
                    rows={[
                        [<Badge color="lime">Vacant</Badge>, 'Available for allocation.'],
                        [<Badge color="amber">Occupied</Badge>, 'Assigned to a student in the current session.'],
                        [<Badge color="red">Maintenance</Badge>, 'Excluded from allocation — temporarily unavailable.'],
                    ]}
                />

                <SectionAnchor id="admin-students" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Student Management</h3>
                <p className="text-body leading-relaxed mb-3">
                    Navigate to <strong>Students</strong> in the admin sidebar to view all registered
                    students for the active session. Capabilities include:
                </p>
                <ul className="space-y-2 list-none mb-4">
                    {[
                        'Search students by name, matric number, or department.',
                        'Filter by level, study type, payment status, and allocation status.',
                        'View full student profile including contact details and next-of-kin.',
                        'Revoke a student\'s allocation — this frees their bed and resets them to the pre-allocation state.',
                        'Deactivate a student account to prevent portal access.',
                    ].map((item, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                            <ChevronRight className="w-3.5 h-3.5 text-forest shrink-0 mt-1" />
                            <span className="text-sm text-body">{item}</span>
                        </li>
                    ))}
                </ul>
                <Callout type="warning">
                    Revoking an allocation permanently removes the student's bed assignment and
                    compatibility score. This action is recorded in the Audit Log. The student will
                    need to retake the compatibility quiz to receive a new allocation.
                </Callout>

                <SectionAnchor id="admin-allocations" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Allocations Management</h3>
                <p className="text-body leading-relaxed mb-3">
                    Navigate to <strong>Allocations</strong> in the admin sidebar to view all bed
                    allocations for the active session. This view shows:
                </p>
                <ul className="space-y-2 list-none mb-4">
                    {[
                        'Student name and matric number.',
                        'Assigned hostel, block, room, and bed.',
                        'Compatibility score with room average.',
                        'Which preference choice (1st, 2nd, or 3rd) the allocation was made from.',
                        'Allocation timestamp.',
                        'Option to revoke individual allocations.',
                    ].map((item, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                            <ChevronRight className="w-3.5 h-3.5 text-forest shrink-0 mt-1" />
                            <span className="text-sm text-body">{item}</span>
                        </li>
                    ))}
                </ul>

                <SectionAnchor id="admin-transactions" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Transactions</h3>
                <p className="text-body leading-relaxed mb-3">
                    Navigate to <strong>Transactions</strong> in the admin sidebar to view all payment
                    records. Each transaction record shows:
                </p>
                <Table
                    headers={['Field', 'Description']}
                    rows={[
                        ['HMS Reference', 'The system-generated HMS/YYYY/XXXXX receipt reference.'],
                        ['Student', 'Name and matric number of the paying student.'],
                        ['Amount', 'Total amount paid in Naira.'],
                        ['Channel', 'Payment method: card, bank_transfer, ussd, or mobile_money.'],
                        ['Paystack ID', 'The Paystack transaction reference for external reconciliation.'],
                        ['Status', 'Confirmed, Pending, or Failed.'],
                        ['Date', 'Payment confirmation timestamp.'],
                    ]}
                />
                <Callout type="tip">
                    Use the Paystack ID to reconcile transactions on your Paystack dashboard. The
                    Paystack dashboard is accessible at{' '}
                    <a
                        href="https://dashboard.paystack.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-forest font-semibold hover:underline"
                    >
                        dashboard.paystack.com
                    </a>.
                </Callout>

                <SectionAnchor id="audit-logs" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Audit Logs</h3>
                <p className="text-body leading-relaxed mb-3">
                    Navigate to <strong>Audit Logs</strong> in the admin sidebar. The audit trail
                    provides an immutable record of every significant system event. Key properties:
                </p>
                <ul className="space-y-2 list-none mb-4">
                    {[
                        'Records are append-only — no record can be modified or deleted, even by administrators.',
                        'Every record includes: actor (who performed the action), action type, target entity, timestamp, and JSONB metadata.',
                        'Filter by action type, actor, date range, or search by target entity.',
                        'Export the full filtered audit log as a CSV file for offline analysis.',
                        '22 event categories are tracked (see Audit Event Types in the Reference section).',
                    ].map((item, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                            <ShieldCheck className="w-3.5 h-3.5 text-forest shrink-0 mt-1" />
                            <span className="text-sm text-body">{item}</span>
                        </li>
                    ))}
                </ul>

                <SectionAnchor id="report-builder" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Report Builder</h3>
                <p className="text-body leading-relaxed mb-3">
                    Navigate to <strong>Reports</strong> in the admin sidebar. The Report Builder
                    allows you to construct custom data extracts without writing any SQL.
                </p>
                <StepList steps={[
                    'Select a Report Type from the dropdown (e.g., Student Report, Payment Report, Allocation Report).',
                    'Apply Filters using the filter builder — choose a field, operator (equals, contains, greater than, etc.), and value.',
                    'Select the Columns you want in the output by toggling them on/off from the column catalogue.',
                    'Click Preview to see the first 50 rows of the report in the table below.',
                    'Click Export CSV to download the full report as a CSV file.',
                ]} />
                <Callout type="tip">
                    The report builder supports cross-domain queries — for example, you can build a
                    report showing all students who paid but have not yet been allocated, by combining
                    filters from the payment and allocation domains in a single report.
                </Callout>

                <SectionAnchor id="ai-query" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">AI Natural Language Query</h3>
                <p className="text-body leading-relaxed mb-3">
                    The AI Query panel is available on the <strong>Admin Dashboard</strong>. Type any
                    plain-English question about your hostel data and receive a structured answer.
                </p>
                <h4 className="text-sm font-bold text-heading mt-4 mb-2">Example Queries</h4>
                <div className="space-y-2 mb-4">
                    {[
                        'How many students are registered for the 2025/2026 session?',
                        'Show me all students in Block A of Augustus Hall.',
                        'What is the total revenue collected this session?',
                        'How many beds are still vacant across all female hostels?',
                        'List all students who paid but have not been allocated.',
                    ].map((q, i) => (
                        <div key={i} className="flex gap-2 items-center p-3 rounded-lg bg-surface border border-black/8 text-sm font-mono text-muted">
                            <Search className="w-3.5 h-3.5 text-muted-light shrink-0" />
                            {q}
                        </div>
                    ))}
                </div>
                <Callout type="info">
                    The AI Query module uses Groq AI to generate SQL from your question. The
                    generated query is strictly validated as a SELECT-only statement before execution —
                    it cannot modify, insert, or delete any data. Query results are read-only.
                </Callout>
            </section>

            {/* ── ACCOUNT & SETTINGS ───────────────────────────── */}
            <section>
                <SectionAnchor id="account-settings" />
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-forest flex items-center justify-center">
                        <Settings className="w-4 h-4 text-lime" />
                    </div>
                    <h2 className="text-2xl font-black text-heading tracking-tight">Account & Settings</h2>
                </div>
                <p className="text-body leading-relaxed mb-4">
                    Access Settings by clicking your profile avatar in the top-right header and selecting
                    <strong> Settings</strong>, or navigating to{' '}
                    <span className="font-mono text-xs bg-surface-2 px-2 py-0.5 rounded-md">/settings</span>.
                    Settings are available to both students and admins.
                </p>

                <SectionAnchor id="appearance" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Appearance</h3>
                <ul className="space-y-3 list-none mb-4">
                    {[
                        { label: 'Dark Mode', desc: 'Toggle between light and dark themes. Your preference is saved locally in the browser.' },
                        { label: 'Font', desc: 'Choose from four typefaces: Inter (default clean sans-serif), System UI (native OS font), Georgia (classic serif), or Monospace (JetBrains Mono). A live preview is shown before you apply.' },
                    ].map((item, i) => (
                        <li key={i} className="p-4 rounded-xl bg-surface border border-black/8">
                            <p className="text-sm font-bold text-heading mb-1">{item.label}</p>
                            <p className="text-xs text-body">{item.desc}</p>
                        </li>
                    ))}
                </ul>

                <SectionAnchor id="change-password" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Changing Your Password</h3>
                <StepList steps={[
                    'Enter your current password.',
                    'Enter your new password (minimum 8 characters). A strength indicator shows the quality of your password.',
                    'Confirm the new password.',
                    'Click Update Password.',
                ]} />
                <p className="text-body text-sm leading-relaxed">
                    Password strength is graded on five criteria: length ≥ 8, length ≥ 12, uppercase
                    letter, number, and special character. A "Strong" rating requires all five.
                </p>
            </section>

            {/* ── PUBLIC FEATURES ──────────────────────────────── */}
            <section>
                <SectionAnchor id="public-features" />
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-forest flex items-center justify-center">
                        <Search className="w-4 h-4 text-lime" />
                    </div>
                    <h2 className="text-2xl font-black text-heading tracking-tight">Public Features</h2>
                </div>

                <SectionAnchor id="allocation-checker" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Allocation Status Checker</h3>
                <p className="text-body leading-relaxed mb-3">
                    The homepage (<span className="font-mono text-xs bg-surface-2 px-2 py-0.5 rounded-md">/</span>)
                    includes a public allocation checker widget. No login is required.
                </p>
                <StepList steps={[
                    'Enter a student\'s matriculation number in the checker widget.',
                    'Click Check Status.',
                    'If the student has an active allocation, the card displays their name, department, level, hostel name, room number, bed number, room capacity, and current roommates.',
                    'If the student has no active allocation, the result indicates this clearly.',
                ]} />
                <Callout type="info">
                    The allocation checker is intended for students who want to quickly verify their
                    bed assignment, or for parents checking on a student's accommodation status.
                    Full allocation details with receipt are only visible after signing in.
                </Callout>
            </section>

            {/* ── REFERENCE ─────────────────────────────────────── */}
            <section>
                <SectionAnchor id="reference" />
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-xl bg-forest flex items-center justify-center">
                        <Hash className="w-4 h-4 text-lime" />
                    </div>
                    <h2 className="text-2xl font-black text-heading tracking-tight">Reference</h2>
                </div>

                <SectionAnchor id="portal-lifecycle" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Portal Lifecycle</h3>
                <p className="text-body leading-relaxed mb-3">
                    Each academic session passes through a defined lifecycle controlled by the admin.
                    The recommended order of operations is:
                </p>
                <div className="space-y-2 mb-4">
                    {[
                        { step: 1, action: 'Create session', detail: 'Set name, dates, and eligible levels.' },
                        { step: 2, action: 'Activate session', detail: 'Makes this the current active session.' },
                        { step: 3, action: 'Enable Register Import', detail: 'Open the CSV import window.' },
                        { step: 4, action: 'Import session register', detail: 'Upload the enrolled students CSV.' },
                        { step: 5, action: 'Disable Register Import', detail: 'Close the import window to prevent further changes.' },
                        { step: 6, action: 'Configure fee components', detail: 'Add all hostel fee components with amounts per study type.' },
                        { step: 7, action: 'Enable Application Portal', detail: 'Students can now register and apply.' },
                        { step: 8, action: 'Enable Payment Portal', detail: 'Students can now pay hostel fees.' },
                        { step: 9, action: 'Enable Allocation Portal', detail: 'Students can take the quiz and be allocated.' },
                        { step: 10, action: 'End session', detail: 'Permanently archives the session. All portals close.' },
                    ].map(s => (
                        <div key={s.step} className="flex gap-3 items-start p-3 rounded-lg bg-surface border border-black/8">
                            <span className="w-6 h-6 rounded-full bg-lime/15 text-forest font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                                {s.step}
                            </span>
                            <div>
                                <p className="text-sm font-bold text-heading">{s.action}</p>
                                <p className="text-xs text-muted">{s.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <SectionAnchor id="hms-receipt-format" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">HMS Receipt Format</h3>
                <p className="text-body leading-relaxed mb-3">
                    Every confirmed payment generates a unique HMS receipt reference in the format:
                </p>
                <div className="p-4 rounded-xl bg-surface-2 border border-black/8 font-mono text-center text-xl font-black text-forest my-4">
                    HMS / YYYY / XXXXX
                </div>
                <Table
                    headers={['Component', 'Description']}
                    rows={[
                        ['HMS', 'Fixed prefix identifying this as an HMS system reference.'],
                        ['YYYY', 'The start year of the active academic session (e.g., 2025 for 2025/2026).'],
                        ['XXXXX', 'A zero-padded sequential number, incrementing per confirmed payment (e.g., 00001, 00002).'],
                    ]}
                />
                <p className="text-body text-sm leading-relaxed">
                    Example: <span className="font-mono text-xs bg-surface-2 px-2 py-1 rounded">HMS/2025/00001</span> is
                    the first confirmed payment in the 2025/2026 session.
                </p>

                <SectionAnchor id="lifestyle-dimensions" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">8 Lifestyle Dimensions</h3>
                <p className="text-body leading-relaxed mb-3">
                    The compatibility matching algorithm operates on an 8-dimensional lifestyle vector.
                    Each dimension is normalised to a value between 0.0 (one extreme) and 1.0 (the other).
                    Dimensions are weighted based on academic literature on roommate conflict sources:
                </p>
                <Table
                    headers={['#', 'Dimension', 'Low Value (0.0)', 'High Value (1.0)', 'Research Weight']}
                    rows={[
                        ['1', 'Sleep Time', 'Sleeps early (before 10 PM)', 'Sleeps very late (after 2 AM)', 'High'],
                        ['2', 'Wake Time', 'Wakes very early (before 6 AM)', 'Wakes late (after 10 AM)', 'High'],
                        ['3', 'Study Noise', 'Complete silence required', 'Loud music or TV while studying', 'High'],
                        ['4', 'Cleanliness', 'Extremely clean and tidy', 'Relaxed about cleanliness', 'High'],
                        ['5', 'Visitor Frequency', 'No guests ever', 'Guests frequently', 'Medium'],
                        ['6', 'Night Device Use', 'Never uses devices after lights-out', 'Always uses screen/sound at night', 'Medium'],
                        ['7', 'Social Preference', 'Very private, minimal interaction', 'Very social with roommates', 'Low'],
                        ['8', 'Noise Tolerance', 'Cannot tolerate any noise', 'Very tolerant of all noise', 'Medium'],
                    ]}
                />

                <SectionAnchor id="audit-event-types" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Audit Event Types</h3>
                <p className="text-body leading-relaxed mb-3">
                    The audit trail records 22 categories of system events:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    {[
                        'student_registered', 'student_login', 'application_submitted',
                        'payment_confirmed', 'payment_failed', 'quiz_submitted',
                        'bed_allocated', 'allocation_revoked', 'session_created',
                        'session_activated', 'session_ended', 'portal_toggled',
                        'register_imported', 'fee_component_created', 'fee_component_updated',
                        'fee_component_deleted', 'hostel_created', 'hostel_updated',
                        'hostel_deleted', 'block_created', 'room_created', 'bed_created',
                    ].map((ev, i) => (
                        <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-surface border border-black/8">
                            <span className="w-1.5 h-1.5 rounded-full bg-forest shrink-0" />
                            <span className="font-mono text-xs text-muted">{ev}</span>
                        </div>
                    ))}
                </div>

                <SectionAnchor id="study-types" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Study Types & Levels</h3>
                <p className="text-body leading-relaxed mb-3">
                    The system is configured for University (BSc) mode. The three supported study types
                    and eligible student levels are:
                </p>
                <Table
                    headers={['Study Type', 'Eligible Levels', 'Fee Tier']}
                    rows={[
                        [<Badge color="forest">Full-time</Badge>, '100L, 200L, 300L, 400L, 500L', 'amount_fulltime'],
                        [<Badge color="amber">Part-time</Badge>, '200L, 300L, 400L, 500L (configurable)', 'amount_parttime'],
                        [<Badge color="blue">Sandwich</Badge>, '100L, 200L (configurable)', 'amount_sandwich'],
                    ]}
                />
                <Callout type="info">
                    The eligible levels for each session are configured by the administrator when
                    creating or editing a session. Not all levels need to be eligible — for example,
                    a hostel block reserved for 100-Level students can be managed through the gender
                    restriction and block configuration settings.
                </Callout>

                <SectionAnchor id="csv-format" />
                <h3 className="text-lg font-bold text-heading mt-8 mb-3">Register CSV Format</h3>
                <p className="text-body leading-relaxed mb-3">
                    The session register CSV must contain the following columns in this exact order:
                </p>
                <div className="overflow-x-auto rounded-xl border border-black/8 mb-4">
                    <pre className="p-4 text-xs font-mono text-body bg-surface leading-relaxed overflow-x-auto">
{`matric_number,surname,first_name,gender,department,level,study_type,faculty
CSC/2025/001,ADEYEMI,FUNMI,female,Computer Science,100L,Full-time,Science
CSC/2025/002,BELLO,AHMED,male,Computer Science,200L,Full-time,Science
ENG/2025/003,OKAFOR,NGOZI,female,Electrical Engineering,100L,Part-time,Engineering`}
                    </pre>
                </div>
                <Table
                    headers={['Column', 'Required?', 'Format / Valid Values']}
                    rows={[
                        ['matric_number', <Badge color="red">Required</Badge>, 'Any string, unique per session (e.g., CSC/2025/001)'],
                        ['surname', <Badge color="red">Required</Badge>, 'String, student surname'],
                        ['first_name', <Badge color="red">Required</Badge>, 'String, student first name'],
                        ['gender', <Badge color="red">Required</Badge>, '"male" or "female" (lowercase)'],
                        ['department', <Badge color="red">Required</Badge>, 'String, department name'],
                        ['level', <Badge color="red">Required</Badge>, '"100L", "200L", "300L", "400L", or "500L"'],
                        ['study_type', <Badge color="red">Required</Badge>, '"Full-time", "Part-time", or "Sandwich"'],
                        ['faculty', <Badge color="gray">Optional</Badge>, 'String, faculty name (can be empty)'],
                    ]}
                />
                <Callout type="warning">
                    The first row must be the header row exactly as shown. Any row with a missing
                    required field, an invalid gender value, or an invalid study type will be rejected
                    during import and reported in the import summary.
                </Callout>
            </section>

        </div>
    );
}

/* ─── Main Docs Page ──────────────────────────────────────────────────── */
export default function Docs() {
    const [activeId, setActiveId] = useState('overview');
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const contentRef = useRef(null);

    useEffect(() => {
        const allIds = TOC.flatMap(s => [s.id, ...s.children.map(c => c.id)]);
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter(e => e.isIntersecting);
                if (visible.length > 0) {
                    const topmost = visible.sort((a, b) =>
                        a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top
                    )[0];
                    setActiveId(topmost.target.id);
                }
            },
            { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
        );

        allIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, []);

    return (
        <div className="bg-cream min-h-screen">
            {/* ─── NAVBAR ─── */}
            <nav className="sticky top-0 z-50 bg-cream/90 backdrop-blur-md border-b border-black/8">
                <div className="max-w-7xl mx-auto px-5 lg:px-8 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="text-base font-black text-heading tracking-tight">
                            HMS
                        </Link>
                        <span className="text-black/20 select-none">/</span>
                        <div className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-forest" />
                            <span className="text-sm font-bold text-heading">Documentation</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            to="/login"
                            className="hidden sm:block text-sm font-bold text-muted hover:text-heading transition-colors"
                        >
                            Sign In
                        </Link>
                        <Link
                            to="/register"
                            className="bg-forest text-lime text-sm font-bold px-4 py-2 rounded-full hover:bg-forest-light transition-colors"
                        >
                            Get Started
                        </Link>
                        <button
                            className="lg:hidden p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                            onClick={() => setMobileNavOpen(o => !o)}
                        >
                            {mobileNavOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
                        </button>
                    </div>
                </div>
            </nav>

            {/* ─── MOBILE NAV DRAWER ─── */}
            {mobileNavOpen && (
                <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileNavOpen(false)}>
                    <div
                        className="absolute left-0 top-14 bottom-0 w-72 bg-cream border-r border-black/8 overflow-y-auto p-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <TocSidebar activeId={activeId} />
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-5 lg:px-8 flex gap-8 py-8">
                {/* ─── LEFT TOC SIDEBAR ─── */}
                <aside className="hidden lg:block w-60 shrink-0">
                    <div className="sticky top-22 overflow-y-auto max-h-[calc(100vh-6rem)]">
                        <TocSidebar activeId={activeId} />
                    </div>
                </aside>

                {/* ─── MAIN CONTENT ─── */}
                <main className="flex-1 min-w-0 max-w-3xl" ref={contentRef}>
                    {/* Hero */}
                    <div className="mb-12 pb-8 border-b border-black/8">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-lime/20 text-forest text-xs font-bold uppercase tracking-widest mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-forest" />
                            HMS Documentation
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black text-heading tracking-tight leading-[0.95] mb-4">
                            Complete User Guide
                        </h1>
                        <p className="text-lg text-body font-medium leading-relaxed max-w-2xl">
                            Everything you need to use the AI-Driven Hostel Management System —
                            from student registration to admin reporting, with detailed step-by-step
                            instructions for every feature.
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-6">
                            <Badge color="forest">Students</Badge>
                            <Badge color="amber">Administrators</Badge>
                            <Badge color="blue">Public</Badge>
                            <span className="text-xs text-muted font-medium">·</span>
                            <span className="text-xs text-muted font-medium">Version 1.0 · 2025/2026</span>
                        </div>
                    </div>

                    <ContentSections />

                    {/* Footer CTA */}
                    <div className="mt-16 pt-8 border-t border-black/8 text-center">
                        <p className="text-sm text-muted font-medium mb-4">
                            Still have questions? Start the application process or sign in.
                        </p>
                        <div className="flex items-center justify-center gap-4">
                            <Link
                                to="/register"
                                className="inline-flex items-center gap-2 bg-forest text-lime font-bold px-6 py-3 rounded-full text-sm hover:bg-forest-light transition-colors"
                            >
                                Apply for Hostel
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link
                                to="/"
                                className="inline-flex items-center gap-2 text-muted font-bold px-5 py-3 rounded-full text-sm hover:text-heading hover:bg-black/5 transition-colors"
                            >
                                Back to Homepage
                            </Link>
                        </div>
                        <p className="text-xs text-muted/60 font-medium mt-8">
                            &copy; {new Date().getFullYear()} HMS · AI-Driven Hostel Management System
                        </p>
                    </div>
                </main>
            </div>
        </div>
    );
}
