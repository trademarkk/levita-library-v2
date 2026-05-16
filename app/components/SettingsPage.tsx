import { DashboardLayout } from './DashboardLayout';
import { GlassCard } from './GlassCard';
import { useLibrary } from '../domain/LibraryContext';

export function SettingsPage() {
  const { currentUser, state, updateSettings } = useLibrary();
  const role = currentUser?.role ?? 'OWNER';

  return (
    <DashboardLayout role={role}>
      <div className="p-6 lg:p-10 max-w-5xl">
        <div className="mb-10">
          <h1 className="text-4xl lg:text-5xl mb-3 text-[#f5f3f0]">Настройки</h1>
          <p className="text-[#a89b8f]">Локальные настройки интерфейса и поведения демо-контура.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <GlassCard>
            <h2 className="text-xl text-[#f5f3f0] mb-4">Внешний вид</h2>
            <label className="block text-sm text-[#a89b8f] mb-2">Цветовой режим</label>
            <select
              value={state.settings.colorMode}
              onChange={(event) => updateSettings({ colorMode: event.target.value as 'dark' | 'light' })}
              className="w-full bg-[#2a2630] border border-[#c9a98d]/20 rounded-lg px-3 py-2 text-[#f5f3f0]"
            >
              <option value="dark">Тёмный</option>
              <option value="light">Светлый</option>
            </select>
            <label className="block text-sm text-[#a89b8f] mt-4 mb-2">Плотность интерфейса</label>
            <select
              value={state.settings.density}
              onChange={(event) => updateSettings({ density: event.target.value as 'comfortable' | 'compact' })}
              className="w-full bg-[#2a2630] border border-[#c9a98d]/20 rounded-lg px-3 py-2 text-[#f5f3f0]"
            >
              <option value="comfortable">Комфортная</option>
              <option value="compact">Компактная</option>
            </select>
          </GlassCard>

          <GlassCard>
            <h2 className="text-xl text-[#f5f3f0] mb-4">Поведение</h2>
            <label className="flex items-center justify-between gap-4 py-3 border-b border-[#c9a98d]/10">
              <span className="text-[#f5f3f0]">Анимации интерфейса</span>
              <input type="checkbox" checked={state.settings.animations} onChange={(event) => updateSettings({ animations: event.target.checked })} className="w-5 h-5 accent-[#c9a98d]" />
            </label>
            <label className="flex items-center justify-between gap-4 py-3">
              <span className="text-[#f5f3f0]">Отправка отчётов в Telegram</span>
              <input type="checkbox" checked={state.settings.telegramReports} onChange={(event) => updateSettings({ telegramReports: event.target.checked })} className="w-5 h-5 accent-[#c9a98d]" />
            </label>
            <p className="text-sm text-[#a89b8f] mt-4">Интеграция с ботом пока отмечается как состояние. Подключение API Telegram будет отдельным backend-этапом.</p>
          </GlassCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
