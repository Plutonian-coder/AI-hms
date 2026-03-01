import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building, BedDouble, CalendarDays, Users, LogOut } from 'lucide-react';

export default function AdminSidebar() {
    const navigate = useNavigate();

    const handleSignOut = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const navItemClass = (isActive) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${isActive
            ? 'bg-lime/15 text-lime border-l-2 border-lime'
            : 'text-white/60 hover:text-white hover:bg-white/5'
        }`;

    return (
        <div className="w-64 flex-shrink-0 bg-forest h-full flex flex-col">
            <div className="p-6 border-b border-white/10 flex items-center justify-center">
                <h1 className="text-xl font-bold text-white tracking-tight">
                    HMS Admin
                </h1>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2">
                <NavLink to="/admin" end className={({ isActive }) => navItemClass(isActive)}>
                    <LayoutDashboard className="w-5 h-5" />
                    Dashboard
                </NavLink>

                <NavLink to="/admin/hostels" className={({ isActive }) => navItemClass(isActive)}>
                    <Building className="w-5 h-5" />
                    Hostels
                </NavLink>

                <NavLink to="/admin/bedspaces" className={({ isActive }) => navItemClass(isActive)}>
                    <BedDouble className="w-5 h-5" />
                    Bed Spaces
                </NavLink>

                <NavLink to="/admin/sessions" className={({ isActive }) => navItemClass(isActive)}>
                    <CalendarDays className="w-5 h-5" />
                    Sessions
                </NavLink>

                <NavLink to="/admin/students" className={({ isActive }) => navItemClass(isActive)}>
                    <Users className="w-5 h-5" />
                    Students
                </NavLink>
            </nav>

            <div className="p-4 border-t border-white/10">
                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
