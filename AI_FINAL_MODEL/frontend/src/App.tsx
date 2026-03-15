import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Setup from './pages/Setup';
import AcceptInvite from './pages/AcceptInvite';
import Join from './pages/Join';
import ErrorBoundary from './components/ErrorBoundary';

// EngineeringOS Phase 1.5 pages
import Dashboard from './pages/Dashboard';
import Team from './pages/Team';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import Onboarding from './pages/onboarding/Onboarding';

// PHASE2_DISABLED — import PRDetail from './pages/PRDetail';
// PHASE2_DISABLED — import Search from './pages/Search';
// PHASE2_DISABLED — import UserSettings from './pages/UserSettings';
// PHASE2_DISABLED — import AdminRepos / AdminHealth / AdminBilling / AdminSettings / etc.

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#060910]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.org_id) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to={user.org_id ? '/dashboard' : '/setup'} replace /> : <Login />
      } />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/join/:token"   element={<Join />} />
      <Route path="/auth/callback" element={
        <div className="flex items-center justify-center h-screen bg-[#060910] text-slate-400">Completing login…</div>
      } />
      <Route path="/setup" element={
        user ? (user.org_id ? <Navigate to="/dashboard" replace /> : <Setup />) : <Navigate to="/login" replace />
      } />

      {/* Onboarding wizard — shown before onboarding completed */}
      <Route path="/onboarding/*" element={
        user ? <Onboarding /> : <Navigate to="/login" replace />
      } />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
        <Route path="team"      element={<ErrorBoundary><Team /></ErrorBoundary>} />
        <Route path="settings"  element={<ErrorBoundary><Settings /></ErrorBoundary>} />
        <Route path="reports"   element={<ErrorBoundary><Reports /></ErrorBoundary>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
