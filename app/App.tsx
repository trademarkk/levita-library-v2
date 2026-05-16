import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { AssistantDashboard } from './components/AssistantDashboard';
import { SeniorAdminDashboard } from './components/SeniorAdminDashboard';
import { OwnerDashboard } from './components/OwnerDashboard';
import { RoleDashboard } from './components/RoleDashboard';
import { AdminDashboard } from './components/SeniorAdminDashboard';
import { SettingsPage } from './components/SettingsPage';
import { LibraryProvider } from './domain/LibraryContext';

export default function App() {
  return (
    <LibraryProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/assistant" element={<AssistantDashboard />} />
            <Route path="/senior-admin" element={<SeniorAdminDashboard />} />
            <Route path="/owner" element={<OwnerDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/senior-trainer" element={<RoleDashboard role="SENIOR_TRAINER" />} />
            <Route path="/trainer" element={<RoleDashboard role="TRAINER" />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </LibraryProvider>
  );
}
