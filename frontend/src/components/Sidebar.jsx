import { useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, CreditCard, ClipboardCheck, BedDouble, LogOut, X, PanelLeftClose, PanelLeftOpen, CheckCircle, Lock, Loader2 } from 'lucide-react';

// Allocation completes as part of quiz submission, before the hostel fee is
// paid — "My Allocation" must stay ordered ahead of "Hostel Fee" to match
// when it actually completes (see Dashboard.jsx's timeline for the same rule).
const FLOW_STEPS = [
    { to: '/payment?type=application', label: 'Application Fee', icon: CreditCard, progressKey: 'app_fee_paid' },
    { to: '/apply', label: 'Apply', icon: FileText, progressKey: 'applied' },
    { to: '/quiz', label: 'Compatibility Quiz', icon: ClipboardCheck, progressKey: 'quiz_completed' },
    { to: '/my-allocation', label: 'My Allocation', icon: BedDouble, progressKey: 'allocated' },
    { to: '/payment?type=hostel', label: 'Hostel Fee', icon: CreditCard, progressKey: 'hostel_fee_paid' },
];

export default function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse, progress = null }) {
    const navigate = useNavigate();
    const { pathname, search } = useLocation();

    useEffect(() => { onClose(); }, [pathname, onClose]);

    const handleSignOut = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    // Determine which steps are done, current, or locked — positional, so a
    // later step can never render as "done" while an earlier one is pending
    // (e.g. allocation completes as a side effect of the quiz, before the
    // hostel fee is paid — it must still wait its turn in the UI).
    const getStepState = (idx) => {
        if (!progress) return 'locked';
        const firstNotDone = FLOW_STEPS.findIndex(s => !progress[s.progressKey]);
        if (firstNotDone === -1) return 'done';
        if (idx < firstNotDone) return 'done';
        if (idx === firstNotDone) return 'current';
        return 'locked';
    };

    const NavItem = ({ item }) => (
        <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 group relative ${
                    collapsed ? 'justify-center px-2' : ''
                } ${
                    isActive
                        ? 'bg-lime-soft text-forest border border-lime-border'
                        : 'text-muted hover:text-heading hover:bg-surface-2'
                }`
            }
        >
            {({ isActive }) => (
                <>
                    <item.icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-forest' : 'text-muted-light'}`} />
                    {!collapsed && <span>{item.label}</span>}
                    {collapsed && (
                        <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-heading text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                            {item.label}
                        </span>
                    )}
                </>
            )}
        </NavLink>
    );

    const FlowItem = ({ item, state }) => {
        const isDone = state === 'done';
        const isLocked = state === 'locked';
        const isCurrent = state === 'current';
        const fullPath = pathname + search;
        const isActive = fullPath === item.to || (item.to === '/apply' && pathname === '/apply');

        if (isLocked) {
            return (
                <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold opacity-40 cursor-not-allowed group relative ${
                        collapsed ? 'justify-center px-2' : ''
                    }`}
                >
                    <Lock className="w-4 h-4 shrink-0 text-muted-light" />
                    {!collapsed && <span className="text-muted">{item.label}</span>}
                    {collapsed && (
                        <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-heading text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                            {item.label}
                        </span>
                    )}
                </div>
            );
        }

        return (
            <NavLink
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 group relative ${
                    collapsed ? 'justify-center px-2' : ''
                } ${
                    isActive
                        ? 'bg-lime-soft text-forest border border-lime-border'
                        : isDone
                            ? 'text-muted/70 hover:text-heading hover:bg-surface-2'
                            : isCurrent
                                ? 'text-forest hover:bg-lime-soft/50'
                                : 'text-muted hover:text-heading hover:bg-surface-2'
                }`}
            >
                {isDone ? (
                    <CheckCircle className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-forest' : 'text-emerald-500/60'}`} />
                ) : (
                    <item.icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-forest' : isCurrent ? 'text-forest' : 'text-muted-light'}`} />
                )}
                {!collapsed && (
                    <span className={isDone && !isActive ? 'line-through decoration-1' : ''}>{item.label}</span>
                )}
                {collapsed && (
                    <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-heading text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                        {item.label}
                    </span>
                )}
            </NavLink>
        );
    };

    const SidebarContent = ({ showClose }) => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={`px-4 py-4 border-b border-sidebar-border flex items-center shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <img src="/fuoye-logo.png" alt="FUOYE" className="w-8 h-8 object-contain" />
                        <span className="text-lg font-serif font-black text-forest tracking-tighter">FUOYE</span>
                        <div className="border-l border-sidebar-border pl-2">
                            <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Student</p>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-wider -mt-1">Portal</p>
                        </div>
                    </div>
                )}
                {collapsed && (
                    <img src="/fuoye-logo.png" alt="FUOYE" className="w-7 h-7 object-contain" />
                )}

                {showClose ? (
                    <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-heading hover:bg-surface-2 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                ) : (
                    !collapsed && (
                        <button
                            onClick={onToggleCollapse}
                            className="p-1.5 rounded-lg text-muted hover:text-heading hover:bg-surface-2 transition-colors"
                            title="Collapse sidebar"
                        >
                            <PanelLeftClose className="w-4 h-4" />
                        </button>
                    )
                )}
            </div>

            {/* Collapsed expand button */}
            {collapsed && !showClose && (
                <div className="px-2 pt-3 pb-1 flex justify-center">
                    <button
                        onClick={onToggleCollapse}
                        className="p-1.5 rounded-lg text-muted hover:text-heading hover:bg-surface-2 transition-colors"
                        title="Expand sidebar"
                    >
                        <PanelLeftOpen className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
                {!collapsed && (
                    <p className="text-[10px] font-bold text-muted-light uppercase tracking-[0.15em] px-3 mb-2">Main</p>
                )}
                {collapsed && <div className="border-t border-sidebar-border mb-2 mx-1" />}
                <NavItem item={{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }} />

                {/* Flow steps */}
                {!collapsed && (
                    <p className="text-[10px] font-bold text-muted-light uppercase tracking-[0.15em] px-3 mt-4 mb-2">Progress</p>
                )}
                {collapsed && <div className="border-t border-sidebar-border my-2 mx-1" />}
                {!progress ? (
                    <div className="px-2 py-2 space-y-2 animate-pulse">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className={`h-11 w-full bg-surface-2 rounded-xl ${collapsed ? 'w-10 mx-auto' : ''}`} />
                        ))}
                    </div>
                ) : (
                    FLOW_STEPS.map((step, idx) => (
                        <FlowItem key={step.to} item={step} state={getStepState(idx)} />
                    ))
                )}
            </nav>

            {/* Sign out */}
            <div className="px-3 py-4 border-t border-sidebar-border shrink-0">
                <button
                    onClick={handleSignOut}
                    className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-semibold text-muted hover:text-danger hover:bg-danger-bg transition-all duration-150 group relative ${collapsed ? 'justify-center px-2' : ''}`}
                >
                    <LogOut className="w-4.5 h-4.5 shrink-0" />
                    {!collapsed && <span>Sign Out</span>}
                    {collapsed && (
                        <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-heading text-red-400 text-xs font-semibold rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                            Sign Out
                        </span>
                    )}
                </button>
            </div>
        </div>
    );

    const desktopWidth = collapsed ? 'w-16' : 'w-64';

    return (
        <>
            {/* Desktop — always visible */}
            <div className={`hidden lg:flex ${desktopWidth} flex-shrink-0 glass-sidebar h-full flex-col transition-all duration-300 ease-out`}>
                <SidebarContent showClose={false} />
            </div>

            {/* Mobile backdrop */}
            <div
                className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
            />

            {/* Mobile drawer */}
            <div
                className={`fixed inset-y-0 left-0 z-50 w-64 glass-sidebar flex flex-col transition-transform duration-300 ease-out lg:hidden ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <SidebarContent showClose={true} />
            </div>
        </>
    );
}
