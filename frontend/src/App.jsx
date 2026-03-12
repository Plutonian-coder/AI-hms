import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import AdminSidebar from './components/AdminSidebar';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Eligibility from './pages/Eligibility';
import Payment from './pages/Payment';
import PaymentCallback from './pages/PaymentCallback';
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

function getUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Auth guard — redirects to / if no token
const ProtectedRoute = ({ children, requiredRole }) => {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/" replace />;

  const user = getUser();
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/'} replace />;
  }
  return children;
};

// Public guard — redirects to dashboard if already logged in
const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  if (token) return <Navigate to="/" replace />;
  return children;
};

// Student layout
const StudentLayout = ({ children }) => {
  const user = getUser();
  const initial = user?.full_name?.charAt(0) || 'S';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-screen w-screen bg-cream overflow-hidden text-heading">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <header className="bg-cream/80 backdrop-blur-sm border-b border-black/5 p-4 sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1 rounded-md text-heading hover:bg-black/5 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-heading tracking-tight">
              Student Portal
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-muted hidden sm:block">{user?.full_name}</span>
            <div className="w-8 h-8 rounded-full bg-forest flex items-center justify-center text-lime font-bold">
              {initial}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-10 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

// Admin layout
const AdminLayout = ({ children }) => {
  const user = getUser();
  const initial = user?.full_name?.charAt(0) || 'A';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-screen w-screen bg-cream overflow-hidden text-heading">
      <AdminSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <header className="bg-cream/80 backdrop-blur-sm border-b border-black/5 p-4 sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1 rounded-md text-heading hover:bg-black/5 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-heading tracking-tight">
              Admin Panel
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-muted hidden sm:block">{user?.full_name}</span>
            <div className="w-8 h-8 rounded-full bg-forest flex items-center justify-center text-lime font-bold">
              {initial}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-10 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

// Smart root — shows landing page if not logged in, dashboard if student, redirects admin
const SmartRoot = () => {
  const token = localStorage.getItem('access_token');
  if (!token) return <LandingPage />;
  const user = getUser();
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  return <StudentLayout><Dashboard /></StudentLayout>;
};

export default function App() {
  const navigate = useNavigate();

  // Global 401 handler — when the API rejects an expired/invalid token,
  // client.js fires this event. Clear session and send to login.
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
      {/* Public routes — redirect to dashboard if already logged in */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

      {/* Smart root — landing page if not logged in, dashboard if student */}
      <Route path="/" element={<SmartRoot />} />
      <Route path="/eligibility" element={
        <ProtectedRoute requiredRole="student">
          <StudentLayout><Eligibility /></StudentLayout>
        </ProtectedRoute>
      } />
      <Route path="/payment" element={
        <ProtectedRoute requiredRole="student">
          <StudentLayout><Payment /></StudentLayout>
        </ProtectedRoute>
      } />
      <Route path="/payment/callback" element={
        <ProtectedRoute requiredRole="student">
          <StudentLayout><PaymentCallback /></StudentLayout>
        </ProtectedRoute>
      } />
      <Route path="/apply" element={<Navigate to="/eligibility" replace />} />
      <Route path="/my-allocation" element={
        <ProtectedRoute requiredRole="student">
          <StudentLayout><MyAllocation /></StudentLayout>
        </ProtectedRoute>
      } />

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout><AdminDashboard /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/hostels" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout><AdminHostels /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/hostels/:hostelId/blocks" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout><AdminBlocks /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/rooms/:roomId/students" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout><AdminRoomStudents /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/bedspaces" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout><AdminBedSpaces /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/sessions" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout><AdminSessions /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/students" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout><AdminStudents /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/allocations" element={
        <ProtectedRoute requiredRole="admin">
          <AdminLayout><AdminAllocations /></AdminLayout>
        </ProtectedRoute>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
