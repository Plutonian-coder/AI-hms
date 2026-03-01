import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AdminSidebar from './components/AdminSidebar';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Apply from './pages/Apply';
import MyAllocation from './pages/MyAllocation';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminHostels from './pages/admin/AdminHostels';
import AdminBedSpaces from './pages/admin/AdminBedSpaces';
import AdminSessions from './pages/admin/AdminSessions';
import AdminStudents from './pages/admin/AdminStudents';

function getUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Auth guard — redirects to /login if no token
const ProtectedRoute = ({ children, requiredRole }) => {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/" replace />;

  const user = getUser();
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/'} replace />;
  }
  return children;
};

// Student layout
const StudentLayout = ({ children }) => {
  const user = getUser();
  const initial = user?.full_name?.charAt(0) || 'S';

  return (
    <div className="flex h-screen w-screen bg-cream overflow-hidden text-heading">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <header className="bg-cream/80 backdrop-blur-sm border-b border-black/5 p-4 sticky top-0 z-10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-heading tracking-tight">
            Student Portal
          </h2>
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

  return (
    <div className="flex h-screen w-screen bg-cream overflow-hidden text-heading">
      <AdminSidebar />
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <header className="bg-cream/80 backdrop-blur-sm border-b border-black/5 p-4 sticky top-0 z-10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-heading tracking-tight">
            Admin Panel
          </h2>
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
  return (
    <Routes>
      {/* Public routes — redirect to dashboard if already logged in */}
      <Route path="/login" element={localStorage.getItem('access_token') ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={localStorage.getItem('access_token') ? <Navigate to="/" replace /> : <Register />} />

      {/* Smart root — landing page if not logged in, dashboard if student */}
      <Route path="/" element={<SmartRoot />} />
      <Route path="/apply" element={
        <ProtectedRoute requiredRole="student">
          <StudentLayout><Apply /></StudentLayout>
        </ProtectedRoute>
      } />
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

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
