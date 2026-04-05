import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Building2, BedDouble, CalendarDays, Users, ClipboardList,
    Receipt, Shield, FileBarChart, Upload, LogOut, X, PanelLeftClose,
    PanelLeftOpen, DollarSign, Building
} from 'lucide-react';

const NAV_SECTIONS = [
    {
        label: 'Main',
        items: [
            { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
        ],
    },
    {
        label: 'Infrastructure',
        items: [
            { to: '/admin/hostels', label: 'Hostels', icon: Building },
            { to: '/admin/bedspaces', label: 'Bed Spaces', icon: BedDouble },
        ],
    },
    {
        label: 'Session',
        items: [
            { to: '/admin/sessions', label: 'Sessions', icon: CalendarDays },
            { to: '/admin/fee-components', label: 'Fee Setup', icon: DollarSign },
            { to: '/admin/register-import', label: 'Register Import', icon: Upload },
        ],
    },
    {
        label: 'Students',
        items: [
            { to: '/admin/students', label: 'Students', icon: Users },
            { to: '/admin/allocations', label: 'Allocations', icon: ClipboardList },
            { to: '/admin/transactions', label: 'Transactions', icon: Receipt },
        ],
    },
    {
        label: 'Records',
        items: [
            { to: '/admin/audit-logs', label: 'Audit Trail', icon: Shield },
            { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
        ],
    },
];

export default function AdminSidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
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
                    {/* Tooltip for collapsed mode */}
                    {collapsed && (
                        <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-heading text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                            {item.label}
                        </span>
                    )}
                </>
            )}
        </NavLink>
    );

    const SidebarContent = ({ showClose }) => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={`px-4 py-4 border-b border-sidebar-border flex items-center shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
                {!collapsed && (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-forest flex items-center justify-center shadow-sm">
                            <Building2 className="w-5 h-5 text-lime" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-heading tracking-tight leading-none">HMS Admin</p>
                            <p className="text-[10px] text-muted font-medium mt-0.5">Management Portal</p>
                        </div>
                    </div>
                )}
                {collapsed && (
                    <div className="w-9 h-9 rounded-xl bg-forest flex items-center justify-center shadow-sm">
                        <Building2 className="w-5 h-5 text-lime" />
                    </div>
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

            {/* Scrollable nav */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin space-y-5">
                {NAV_SECTIONS.map(section => (
                    <div key={section.label}>
                        {!collapsed && (
                            <p className="text-[10px] font-bold text-muted-light uppercase tracking-[0.15em] px-3 mb-2">
                                {section.label}
                            </p>
                        )}
                        {collapsed && <div className="border-t border-sidebar-border mb-2 mx-1" />}
                        <div className="space-y-0.5">
                            {section.items.map(item => <NavItem key={item.to} item={item} />)}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Sign out */}
            <div className="px-3 py-4 border-t border-sidebar-border shrink-0">
                <button
                    onClick={handleSignOut}
                    className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-semibold text-muted hover:text-red-600 hover:bg-red-50 transition-all duration-150 group relative ${collapsed ? 'justify-center px-2' : ''}`}
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
            {/* Desktop */}
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
