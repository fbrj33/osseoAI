import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/src/hooks/useAuth';
import ProtectedRoute from '@/src/components/ProtectedRoute';
import Navbar from '@/src/components/Navbar';
import Home from '@/src/pages/Home';
import Auth from '@/src/pages/Auth';
import Dashboard from '@/src/pages/Dashboard';
import Patients from '@/src/pages/Patients';
import Admin from '@/src/pages/Admin';
import Pending from '@/src/pages/Pending';
import Reports from '@/src/pages/Reports';
import Settings from '@/src/pages/Settings';
import Documentation from '@/src/pages/Documentation';
import Roadmap from '@/src/pages/Roadmap';
import { Toaster } from 'sonner';

function AppContent() {
  const { user } = useAuth();
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const isPendingPage = location.pathname === '/pending';

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-[#f0f0f2]">
      {user && !isHomePage && !isPendingPage && <Navbar />}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/pending" element={
            <ProtectedRoute requireApproved={false}>
              <Pending />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/patients" element={
            <ProtectedRoute>
              <Patients />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin={true}>
              <Admin />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/documentation" element={<Documentation />} />
          <Route path="/roadmap" element={<Roadmap />} />
        </Routes>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
