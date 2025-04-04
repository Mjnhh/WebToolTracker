import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import HomePage from './pages/home-page';
import AuthPage from './pages/auth-page';
import NotFound from './pages/not-found';
import Dashboard from './pages/admin/dashboard';
import ApiEndpoints from './pages/admin/api-endpoints';
import Inquiries from './pages/admin/inquiries';
import SupportDashboard from './pages/admin/support-dashboard';
import { AuthProvider } from '@/hooks/use-auth';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/api" element={<ApiEndpoints />} />
            <Route path="/admin/inquiries" element={<Inquiries />} />
            <Route path="/admin/support" element={<SupportDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
