import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import DevBanner from './components/DevBanner';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth();

  if (loading) {
    return <div className="app-loading">Memuat…</div>;
  }

  if (role !== 'user' && role !== 'guest') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { role, loading } = useAuth();

  if (loading) {
    return <div className="app-loading">Memuat…</div>;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={role === 'user' ? <Navigate to="/app" replace /> : <Landing />}
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DevBanner />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}