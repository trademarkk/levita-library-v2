import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { LoginPage } from './components/LoginPage';
import { LibraryProvider, useLibrary } from './domain/LibraryContext';
import { roleRoutes } from './domain/labels';
import type { Role } from './domain/types';

const AssistantDashboard = lazy(() => import('./components/AssistantDashboard').then((module) => ({ default: module.AssistantDashboard })));
const SeniorAdminDashboard = lazy(() => import('./components/SeniorAdminDashboard').then((module) => ({ default: module.SeniorAdminDashboard })));
const AdminDashboard = lazy(() => import('./components/SeniorAdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const OwnerDashboard = lazy(() => import('./components/OwnerDashboard').then((module) => ({ default: module.OwnerDashboard })));
const RoleDashboard = lazy(() => import('./components/RoleDashboard').then((module) => ({ default: module.RoleDashboard })));
const SettingsPage = lazy(() => import('./components/SettingsPage').then((module) => ({ default: module.SettingsPage })));

function RouteLoader() {
  return (
    <div className="min-h-screen bg-background px-6 py-8 text-foreground">
      <p className="text-sm text-muted-foreground">Загружаем раздел...</p>
    </div>
  );
}

function ProtectedRoute({ children, role }: { children: JSX.Element; role?: Role }) {
  const location = useLocation();
  const { currentUser, isAuthLoading } = useLibrary();

  if (isAuthLoading) return <RouteLoader />;
  if (!currentUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && currentUser.role !== role) return <Navigate to={roleRoutes[currentUser.role]} replace />;

  return children;
}

export default function App() {
  return (
    <LibraryProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground">
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/assistant" element={<ProtectedRoute role="ASSISTANT"><AssistantDashboard /></ProtectedRoute>} />
              <Route path="/senior-admin" element={<ProtectedRoute role="SENIOR_ADMIN"><SeniorAdminDashboard /></ProtectedRoute>} />
              <Route path="/owner" element={<ProtectedRoute role="OWNER"><OwnerDashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
              <Route path="/senior-trainer" element={<ProtectedRoute role="SENIOR_TRAINER"><RoleDashboard role="SENIOR_TRAINER" /></ProtectedRoute>} />
              <Route path="/trainer" element={<ProtectedRoute role="TRAINER"><RoleDashboard role="TRAINER" /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </div>
      </BrowserRouter>
    </LibraryProvider>
  );
}
