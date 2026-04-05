import { useState, useCallback, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import { Menu, LogOut, ChevronDown, Building2, Settings as SettingsIcon } from 'lucide-react';
import Sidebar from './components/Sidebar';
import AdminSidebar from './components/AdminSidebar';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import HostelApplication from './pages/HostelApplication';
import Payment from './pages/Payment';
import PaymentCallback from './pages/PaymentCallback';
import Receipt from './pages/Receipt';
import CompatibilityQuiz from './pages/CompatibilityQuiz';
import MyAllocation from './pages/MyAllocation';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminHostels from './pages/admin/AdminHostels';
import AdminBlocks from './pages/admin/AdminBlocks';
import AdminRoomStudents from './pages/admin/AdminRoomStudents';
import AdminBedSpaces from './pages/admin/AdminBedSpaces';
import AdminSessions from './pages/admin/AdminSessions';
import AdminStudents from './pages/admin/AdminStudents';
import AdminAllocations from './pages/admin/AdminAllocations';
import AdminTransactions from './pages/admin/AdminTransactions';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import AdminReports from './pages/admin/AdminReports';
import AdminRegisterImport from './pages/admin/AdminRegisterImport';
import AdminFeeComponents from './pages/admin/AdminFeeComponents';
import Settings from './pages/Settings';

function getUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const ProtectedRoute = ({ children, requiredRole }) => {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/" replace />;
  const user = getUser();
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/'} replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  if (token) return <Navigate to="/" replace />;
  return children;
};

/* ── Profile dropdown ──────────────────────────────────────────────────────── */
const ProfileDropdown = ({ user, initial }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 cursor-pointer hover:bg-surface-2 rounded-xl pl-3 pr-2 py-1.5 transition-colors"
        id="profile-dropdown-trigger"
      >
        <span className="text-sm font-semibold text-body hidden sm:block">{user?.full_name}</span>
        <div className="w-8 h-8 rounded-full bg-forest flex items-center justify-center text-lime font-bold text-sm shadow-sm">
          {initial}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-58 glass-elevated rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 z-50">
          <div className="p-4 border-b border-black/5">
            <p className="text-sm font-bold text-heading truncate">{user?.full_name}</p>
            <p className="text-xs text-muted font-medium mt-0.5">{user?.identifier || user?.role}</p>
          </div>
          <div className="p-2 space-y-0.5">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-body hover:bg-surface-2 transition-colors"
            >
              <SettingsIcon className="w-4 h-4 text-muted" />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
              id="sign-out-button"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Student layout ─────────────────────────────────────────────────────────── */
const StudentLayout = ({ children }) => {
  const user = getUser();
  const initial = user?.full_name?.charAt(0) || 'S';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #E8F5EE 0%, #F2F6F3 50%, #EBF5F0 100%)' }}>
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Header */}
        <header className="glass-header sticky top-0 z-10 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-muted hover:text-heading hover:bg-surface-2 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-forest flex items-center justify-center">
                <Building2 className="w-4 h-4 text-lime" />
              </div>
              <span className="text-sm font-black text-heading">HMS</span>
            </div>
            <span className="hidden lg:block text-xs font-bold text-muted uppercase tracking-widest">Student Portal</span>
          </div>
          <ProfileDropdown user={user} initial={initial} />
        </header>
        {/* Page content */}
        <main className="flex-1 p-5 lg:p-8 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

/* ── Admin layout ───────────────────────────────────────────────────────────── */
const AdminLayout = ({ children }) => {
  const user = getUser();
  const initial = user?.full_name?.charAt(0) || 'A';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true';
  });
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleCollapse = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('admin_sidebar_collapsed', String(next));
      return next;
    });
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #E8F5EE 0%, #F2F6F3 50%, #EBF5F0 100%)' }}>
      <AdminSidebar isOpen={sidebarOpen} onClose={closeSidebar} collapsed={sidebarCollapsed} onToggleCollapse={toggleCollapse} />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Header */}
        <header className="glass-header sticky top-0 z-10 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-muted hover:text-heading hover:bg-surface-2 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-forest flex items-center justify-center">
                <Building2 className="w-4 h-4 text-lime" />
              </div>
              <span className="text-sm font-black text-heading">HMS Admin</span>
            </div>
            <span className="hidden lg:block text-xs font-bold text-muted uppercase tracking-widest">Admin Portal</span>
          </div>
          <ProfileDropdown user={user} initial={initial} />
        </header>
        {/* Page content */}
        <main className="flex-1 p-5 lg:p-8 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

/* ── Smart root ─────────────────────────────────────────────────────────────── */
const SmartRoot = () => {
  const token = localStorage.getItem('access_token');
  if (!token) return <LandingPage />;
  const user = getUser();
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  return <StudentLayout><Dashboard /></StudentLayout>;
};

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const handle401 = () => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
    };
    window.addEventListener('auth-unauthorized', handle401);
    return () => window.removeEventListener('auth-unauthorized', handle401);
  }, [navigate]);

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

      {/* Smart root */}
      <Route path="/" element={<SmartRoot />} />

      {/* Student */}
      <Route path="/apply" element={<ProtectedRoute requiredRole="student"><StudentLayout><HostelApplication /></StudentLayout></ProtectedRoute>} />
      <Route path="/payment" element={<ProtectedRoute requiredRole="student"><StudentLayout><Payment /></StudentLayout></ProtectedRoute>} />
      <Route path="/payment/callback" element={<ProtectedRoute requiredRole="student"><StudentLayout><PaymentCallback /></StudentLayout></ProtectedRoute>} />
      <Route path="/receipt" element={<ProtectedRoute requiredRole="student"><StudentLayout><Receipt /></StudentLayout></ProtectedRoute>} />
      <Route path="/quiz" element={<ProtectedRoute requiredRole="student"><StudentLayout><CompatibilityQuiz /></StudentLayout></ProtectedRoute>} />
      <Route path="/my-allocation" element={<ProtectedRoute requiredRole="student"><StudentLayout><MyAllocation /></StudentLayout></ProtectedRoute>} />

      {/* Settings — available to all authenticated users */}
      <Route path="/settings" element={
        <ProtectedRoute>
          {(() => {
            const u = getUser();
            const Layout = u?.role === 'admin' ? AdminLayout : StudentLayout;
            return <Layout><Settings /></Layout>;
          })()}
        </ProtectedRoute>
      } />

      {/* Legacy redirect */}
      <Route path="/eligibility" element={<Navigate to="/apply" replace />} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/hostels" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminHostels /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/hostels/:hostelId/blocks" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminBlocks /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/rooms/:roomId/students" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminRoomStudents /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/bedspaces" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminBedSpaces /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/sessions" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminSessions /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/fee-components" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminFeeComponents /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminStudents /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/allocations" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminAllocations /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/transactions" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminTransactions /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/audit-logs" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminAuditLogs /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminReports /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/register-import" element={<ProtectedRoute requiredRole="admin"><AdminLayout><AdminRegisterImport /></AdminLayout></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
