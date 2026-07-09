import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from '@/components/theme-provider';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { getToken } from '@/api/http';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Complaints from '@/pages/Complaints';
import ComplaintDetail from '@/pages/ComplaintDetail';
import Kanban from '@/pages/Kanban';
import Reports from '@/pages/Reports';
import Notifications from '@/pages/Notifications';
import Users from '@/pages/Users';
import Settings from '@/pages/Settings';
import Products from '@/pages/Products';
import RolesPermissions from '@/pages/RolesPermissions';
import Integrations from '@/pages/Integrations';
import Marketplace from '@/pages/Marketplace';
import MarketplaceReviews from '@/pages/MarketplaceReviews';
import SsoNexus from '@/pages/SsoNexus';
import TrackComplaint from '@/pages/TrackComplaint';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const ProtectedRoute = ({ children }) => {
  const { isLoadingAuth, navigateToLogin } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!getToken()) {
    navigateToLogin();
    return null;
  }

  return children;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<TrackComplaint />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/sso/nexus" element={<SsoNexus />} />
    <Route element={
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    }>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/complaints" element={<Complaints />} />
      <Route path="/complaints/:id" element={<ComplaintDetail />} />
      <Route path="/kanban" element={<Kanban />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/users" element={<Users />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/products" element={<Products />} />
      <Route path="/roles" element={<RolesPermissions />} />
      <Route path="/integrations" element={<Integrations />} />
      <Route path="/marketplace" element={<Navigate to="/marketplace/tiktok-shop" replace />} />
      <Route path="/marketplace/:platform" element={<Marketplace />} />
      <Route path="/tiktok-shop" element={<Navigate to="/marketplace/tiktok-shop" replace />} />
      <Route path="/shopee" element={<Navigate to="/marketplace/shopee" replace />} />
      <Route path="/marketplace-reviews" element={<MarketplaceReviews />} />
      <Route path="/oms" element={<Navigate to="/integrations" replace />} />
    </Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AppRoutes />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
