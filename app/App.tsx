import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from './components/LoginPage';
import { LibraryProvider } from './domain/LibraryContext';

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

export default function App() {
  return (
    <LibraryProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground">
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/assistant" element={<AssistantDashboard />} />
              <Route path="/senior-admin" element={<SeniorAdminDashboard />} />
              <Route path="/owner" element={<OwnerDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/senior-trainer" element={<RoleDashboard role="SENIOR_TRAINER" />} />
              <Route path="/trainer" element={<RoleDashboard role="TRAINER" />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </div>
      </BrowserRouter>
    </LibraryProvider>
  );
}
