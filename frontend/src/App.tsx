import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { ToastContainer } from './components/ui/Toast';
import { useNotification } from './hooks/useNotification';
import { useAuth } from './hooks/useAuth';

// Pages (lazy loaded)
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import NotFound from './pages/NotFound';
import ForgotPassword from './pages/ForgotPassword';
import Landing from './pages/Landing';
import Pricing from './pages/Pricing';
import SecurityPage from './pages/SecurityPage';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Support from './pages/Support';
import Refund from './pages/Refund';
import CookiePolicy from './pages/CookiePolicy';
import Dpa from './pages/Dpa';
import GoogleCallback from './pages/GoogleCallback';
import StripeCallback from './pages/StripeCallback';
import Unsubscribe from './pages/Unsubscribe';
import BillingSuccess from './pages/BillingSuccess';
import EmailQueue from './pages/EmailQueue';
import Onboard from './pages/Onboard';
import { Integrations } from './pages/Integrations';
import { AuditReport } from './pages/AuditReport';

// Placeholder pages (create empty files for now, fill in later phases)
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Invoices = React.lazy(() => import('./pages/Invoices'));
const InvoiceDetail = React.lazy(() => import('./pages/InvoiceDetail'));
const Customers = React.lazy(() => import('./pages/Customers'));
const CustomerDetail = React.lazy(() => import('./pages/CustomerDetail'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Activity = React.lazy(() => import('./pages/Activity'));
const Billing = React.lazy(() => import('./pages/Billing'));
const Admin = React.lazy(() => import('./pages/Admin'));

/**
 * Root redirect handler
 * - If loading: show loading screen
 * - Otherwise: always go to landing (landing page shows dashboard shortcut if authenticated)
 *
 * This ensures everyone sees the landing page first, which is the main entry point.
 * The landing page itself can show different content for authenticated vs. non-authenticated users.
 */
const RootRedirect: React.FC = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center mb-3">
          <span className="text-white font-bold">R</span>
        </div>
        <div className="text-gray-500 dark:text-gray-400">Loading RecoverAI...</div>
      </div>
    );
  }

  // Everyone goes to landing page first
  // Landing page shows different CTAs for authenticated vs non-authenticated users
  return <Navigate to="/landing" replace />;
};

const App: React.FC = () => {
  const { toasts, removeToast } = useNotification();

  return (
    <>
      <BrowserRouter>
        <React.Suspense
          fallback={
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center mb-3">
                <span className="text-white font-bold">R</span>
              </div>
              <div className="text-gray-500 dark:text-gray-400">Loading RecoverAI...</div>
            </div>
          }
        >
          <Routes>
            {/* Public routes */}
            <Route path="/landing" element={<Landing />} />
            <Route path="/" element={<RootRedirect />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/terms-of-service" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/privacy-policy" element={<Privacy />} />
            <Route path="/support" element={<Support />} />
            <Route path="/refund-policy" element={<Refund />} />
            <Route path="/cancellation" element={<Refund />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/dpa" element={<Dpa />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/google/callback" element={<GoogleCallback />} />
            <Route path="/stripe/oauth/callback" element={<StripeCallback />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/onboard" element={<Onboard />} />

            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Audit Flow: Integrations → Audit Report */}
            <Route
              path="/integrations"
              element={
                <ProtectedRoute requireEmailVerification>
                  <Integrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-report"
              element={
                <ProtectedRoute requireEmailVerification>
                  <AuditReport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/success"
              element={
                <ProtectedRoute>
                  <BillingSuccess />
                </ProtectedRoute>
              }
            />

            {/* Protected routes (with Layout) — all require email verification */}
            {/* Root route "/" is handled by RootRedirect above */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requireEmailVerification>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/app" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute requireEmailVerification>
                  <Layout>
                    <Invoices />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices/:id"
              element={
                <ProtectedRoute requireEmailVerification>
                  <Layout>
                    <InvoiceDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute requireEmailVerification>
                  <Layout>
                    <Customers />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:id"
              element={
                <ProtectedRoute requireEmailVerification>
                  <Layout>
                    <CustomerDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requireEmailVerification>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/email-queue"
              element={
                <ProtectedRoute requireEmailVerification>
                  <Layout>
                    <EmailQueue />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute requireEmailVerification>
                  <Layout>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity"
              element={
                <ProtectedRoute requireEmailVerification>
                  <Layout>
                    <Activity />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute requireEmailVerification>
                  <Layout>
                    <Billing />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireEmailVerification>
                  <Layout>
                    <Admin />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
};

export default App;
