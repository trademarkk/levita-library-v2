import { useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { GlassCard } from './GlassCard';
import { TabNavigation } from './TabNavigation';
import { ConfirmChecklistDialog } from './ConfirmChecklistDialog';
import { RoleContentViewer, RoleLinksViewer, RoleTemplatesViewer } from './RoleContent';
import { TrainerEvaluationSheetsSection, TrainerRatingSection } from './TrainerEvaluationSections';
import { useLibrary } from '../domain/LibraryContext';
import { roleLabels } from '../domain/labels';
import type { Role } from '../domain/types';
import { CheckSquare, ListChecks } from 'lucide-react';

type RoleDashboardRole = 'ADMIN' | 'SENIOR_TRAINER' | 'TRAINER';

interface RoleDashboardProps {
  role: RoleDashboardRole;
}

const roleContent = {
  ADMIN: {
    subtitle: 'Операционная смена, база знаний и шаблоны клиентской коммуникации',
    tabs: [
      { id: 'responsibilities', label: 'Обязанности' },
      { id: 'regulations', label: 'Регламенты' },
      { id: 'info', label: 'Важная информация' },
      { id: 'knowledge', label: 'База знаний' },
      { id: 'templates', label: 'Шаблоны сообщений' },
      { id: 'links', label: 'Рабочие ссылки' },
      { id: 'checklist', label: 'Чек-лист' },
    ],
  },
  SENIOR_TRAINER: {
    subtitle: 'Методические стандарты, материалы и координация тренерской команды',
    tabs: [
      { id: 'responsibilities', label: 'Обязанности' },
      { id: 'regulations', label: 'Регламенты' },
      { id: 'info', label: 'Важная информация' },
      { id: 'knowledge', label: 'База знаний' },
      { id: 'templates', label: 'Шаблоны сообщений' },
      { id: 'links', label: 'Рабочие ссылки' },
      { id: 'evaluation-sheets', label: 'Листы оценивания' },
      { id: 'trainer-rating', label: 'Рейтинг тренеров' },
      { id: 'checklist', label: 'Чек-лист' },
    ],
  },
  TRAINER: {
    subtitle: 'Подготовка занятий, стандарты студии и персональный чек-лист',
    tabs: [
      { id: 'responsibilities', label: 'Обязанности' },
      { id: 'regulations', label: 'Регламенты' },
      { id: 'info', label: 'Важная информация' },
      { id: 'knowledge', label: 'База знаний' },
      { id: 'templates', label: 'Шаблоны сообщений' },
      { id: 'links', label: 'Рабочие ссылки' },
      { id: 'trainer-rating', label: 'Рейтинг тренеров' },
      { id: 'checklist', label: 'Чек-лист' },
    ],
  },
};

export function RoleDashboard({ role }: RoleDashboardProps) {
  const [activeTab, setActiveTab] = useState(roleContent[role].tabs[0].id);
  const { currentUser, state } = useLibrary();
  const user = currentUser?.role === role ? currentUser : state.users.find((item) => item.role === role);

  return (
    <DashboardLayout role={role} userName={user?.name ?? roleLabels[role]}>
      <div className="p-6 lg:p-10">
        <div className="mb-10">
          <h1 className="text-4xl lg:text-5xl mb-3 text-[#f5f3f0]">Кабинет: {roleLabels[role]}</h1>
          <p className="text-[#a89b8f]">{roleContent[role].subtitle}</p>
        </div>

        <TabNavigation tabs={roleContent[role].tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="max-w-6xl">
          {activeTab === 'responsibilities' && <RoleContentViewer role={role} category="RESPONSIBILITY" />}
          {activeTab === 'regulations' && <RoleContentViewer role={role} category="REGULATION" />}
          {activeTab === 'info' && <RoleContentViewer role={role} category="IMPORTANT_INFO" />}
          {activeTab === 'knowledge' && <RoleContentViewer role={role} category="KNOWLEDGE" />}
          {activeTab === 'templates' && <RoleTemplatesViewer role={role} />}
          {activeTab === 'links' && <RoleLinksViewer role={role} />}
          {activeTab === 'evaluation-sheets' && <TrainerEvaluationSheetsSection />}
          {activeTab === 'trainer-rating' && <TrainerRatingSection />}
          {activeTab === 'checklist' && <RoleChecklist userId={user?.id ?? ''} />}
        </div>
      </div>
    </DashboardLayout>
  );
}

function RoleChecklist({ userId }: { userId: string }) {
  const { checklistForUser, toggleChecklistItem } = useLibrary();
  const [confirmItemId, setConfirmItemId] = useState<string | null>(null);
  const checklist = checklistForUser(userId);
  const confirmItem = checklist?.items.find((item) => item.id === confirmItemId) ?? null;

  if (!checklist) return <GlassCard><p className="text-[#a89b8f]">Чек-лист пока не создан.</p></GlassCard>;

  return (
    <GlassCard>
      <div className="flex items-center gap-3 mb-6">
        <ListChecks className="w-6 h-6 text-[#c9a98d]" />
        <h2 className="text-2xl text-[#f5f3f0]">{checklist.title}</h2>
      </div>
      <div className="space-y-3">
        {checklist.items.map((item) => (
          <label key={item.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a2630] transition-colors">
            <input type="checkbox" checked={item.completed} onChange={() => item.completed ? toggleChecklistItem(checklist.id, item.id, userId) : setConfirmItemId(item.id)} className="w-5 h-5 rounded accent-[#c9a98d]" />
            <CheckSquare className="w-4 h-4 text-[#c9a98d]" />
            <span className={`flex-1 ${item.completed ? 'text-[#a89b8f] line-through' : 'text-[#f5f3f0]'}`}>{item.label}</span>
          </label>
        ))}
      </div>
      {confirmItem && (
        <ConfirmChecklistDialog
          itemLabel={confirmItem.label}
          onCancel={() => setConfirmItemId(null)}
          onConfirm={() => {
            toggleChecklistItem(checklist.id, confirmItem.id, userId);
            setConfirmItemId(null);
          }}
        />
      )}
    </GlassCard>
  );
}
