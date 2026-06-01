import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles, Home, Settings, LogOut } from 'lucide-react';
import { ReactNode } from 'react';
import { useLibrary } from '../domain/LibraryContext';
import { roleLabels, roleRoutes } from '../domain/labels';
import type { Role } from '../domain/types';
import { GlobalSearch } from './GlobalSearch';

interface DashboardLayoutProps {
  children: ReactNode;
  role: Role;
  userName?: string;
}

export function DashboardLayout({ children, role, userName = 'Сотрудник' }: DashboardLayoutProps) {
  const location = useLocation();
  const { currentUser, logout, state, isDataLoading, isSaving, dataError } = useLibrary();
  const displayName = currentUser?.role === role ? currentUser.name : userName;
  const settingsClass = [
    `theme-${state.settings.colorMode}`,
    `density-${state.settings.density}`,
    state.settings.animations ? 'motion-on' : 'motion-off',
    isSaving ? 'is-saving' : '',
  ].join(' ');

  return (
    <div className={`min-h-screen flex flex-col lg:flex-row overflow-x-hidden app-shell ${settingsClass}`}>
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full lg:sticky lg:top-0 lg:h-screen lg:w-72 bg-[#141218] border-b lg:border-b-0 lg:border-r border-[#c9a98d]/10 flex flex-col lg:overflow-y-auto"
      >
        {/* Logo */}
        <div className="p-4 sm:p-6 lg:p-8 border-b border-[#c9a98d]/10">
          <Link to="/" className="flex items-center gap-2 mb-4 lg:mb-6">
            <Sparkles className="w-6 h-6 text-[#c9a98d]" />
            <span className="tracking-[0.3em] text-sm text-[#c9a98d] uppercase">LEVTIA</span>
          </Link>
          <div>
            <div className="text-xs text-[#a89b8f] mb-1 uppercase tracking-wider">Роль</div>
            <div className="text-lg text-[#c9a98d]">{roleLabels[role]}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex lg:flex-1 gap-2 lg:block p-4 lg:p-6 overflow-x-auto">
          <NavItem
            icon={<Home className="w-5 h-5" />}
            label="Рабочий стол"
            to={roleRoutes[role]}
            active={location.pathname === roleRoutes[role]}
          />
          <NavItem
            icon={<Settings className="w-5 h-5" />}
            label="Настройки"
            to="/settings"
            active={location.pathname === '/settings'}
          />
        </nav>

        <div className="px-4 pb-4 lg:px-6">
          <GlobalSearch />
        </div>

        {/* User info */}
        <div className="p-4 lg:p-6 border-t border-[#c9a98d]/10">
          <div className="flex items-center gap-3 mb-3 lg:mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c9a98d] to-[#b88b7a] flex items-center justify-center text-[#0f0e12]">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm text-[#f5f3f0]">{displayName}</div>
              <div className="text-xs text-[#a89b8f]">{roleLabels[role]}</div>
            </div>
          </div>
          <Link
            to="/login"
            onClick={logout}
            className="flex items-center gap-2 text-sm text-[#a89b8f] hover:text-[#c9a98d] transition-colors duration-300"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </Link>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 bg-gradient-to-br from-[#0f0e12] via-[#1a1820] to-[#2a2630] overflow-auto">
        {/* Ambient background */}
        <div className="fixed inset-0 pointer-events-none opacity-20">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#b88b7a] rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-[#8e7a92] rounded-full blur-[120px]"></div>
        </div>

        <div className="relative z-10">
          {(isDataLoading || isSaving) && (
            <div className="sticky top-0 z-50 border-b border-[#c9a98d]/20 bg-[#1f1a22]/95 px-4 py-3 text-sm text-[#f5f3f0] backdrop-blur">
              {isSaving ? 'Сохраняем данные в базе...' : 'Загружаем актуальные данные из базы...'}
            </div>
          )}
          {dataError && (
            <div className="sticky top-0 z-50 border-b border-[#8b3a52]/40 bg-[#3a1f2b]/95 px-4 py-3 text-sm text-[#f5f3f0] backdrop-blur">
              {dataError}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, to, active }: { icon: ReactNode; label: string; to: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all duration-300 whitespace-nowrap ${
        active
          ? 'bg-[#c9a98d]/20 text-[#c9a98d] border border-[#c9a98d]/30'
          : 'text-[#a89b8f] hover:bg-[#2a2630] hover:text-[#f5f3f0]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
