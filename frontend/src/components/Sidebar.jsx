import { useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, CreditCard, ClipboardCheck, BedDouble, LogOut, X, Building2 } from 'lucide-react';

const NAV_ITEMS = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/apply', label: 'Apply', icon: FileText },
    { to: '/payment', label: 'Payment', icon: CreditCard },
    { to: '/quiz', label: 'Compatibility Quiz', icon: ClipboardCheck },
    { to: '/my-allocation', label: 'My Allocation', icon: BedDouble },
];

export default function Sidebar({ isOpen, onClose }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    useEffect(() => { onClose(); }, [pathname, onClose]);

    const handleSignOut = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const NavItem = ({ item }) => (
        <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    isActive
                        ? 'bg-lime-soft text-forest border border-lime-border'
                        : 'text-muted hover:text-heading hover:bg-surface-2'
                }`
            }
        >
            {({ isActive }) => (
                <>
                    <item.icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-forest' : 'text-muted-light'}`} />
                    {item.label}
                </>
            )}
        </NavLink>
    );

    const SidebarContent = ({ showClose }) => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-forest flex items-center justify-center shadow-sm">
                        <Building2 className="w-5 h-5 text-lime" />
                    </div>
                    <div>
                        <p className="text-sm font-black text-heading tracking-tight leading-none">HMS</p>
                        <p className="text-[10px] text-muted font-medium mt-0.5">Student Portal</p>
                    </div>
                </div>
                {showClose && (
                    <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-heading hover:bg-surface-2 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
                <p className="text-[10px] font-bold text-muted-light uppercase tracking-[0.15em] px-3 mb-2">Main</p>
                {NAV_ITEMS.map(item => <NavItem key={item.to} item={item} />)}
            </nav>

            {/* Sign out */}
            <div className="px-3 py-4 border-t border-sidebar-border shrink-0">
                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-semibold text-muted hover:text-danger hover:bg-danger-bg transition-all duration-150"
                >
                    <LogOut className="w-4.5 h-4.5 shrink-0" />
                    Sign Out
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop — always visible */}
            <div className="hidden lg:flex w-64 flex-shrink-0 glass-sidebar h-full flex-col">
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
