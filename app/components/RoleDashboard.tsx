import { useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { GlassCard } from './GlassCard';
import { TabNavigation } from './TabNavigation';
import { ConfirmChecklistDialog } from './ConfirmChecklistDialog';
import { RoleContentViewer, RoleLinksManager, RoleLinksViewer, RoleTemplatesViewer } from './RoleContent';
import { TrainerEvaluationSheetsSection, TrainerRatingSection } from './TrainerEvaluationSections';
import { useLibrary } from '../domain/LibraryContext';
import { roleLabels } from '../domain/labels';
import { can } from '../domain/permissions';
import type { Role } from '../domain/types';
import { CheckSquare, Edit2, ListChecks, Plus, Save, Trash2, X } from 'lucide-react';

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
  const canManageRoleLinks = can(role, 'create', 'workLinks', { targetRole: role });

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
          {activeTab === 'links' && (canManageRoleLinks ? <RoleLinksManager role={role} /> : <RoleLinksViewer role={role} />)}
          {activeTab === 'evaluation-sheets' && <TrainerEvaluationSheetsSection />}
          {activeTab === 'trainer-rating' && <TrainerRatingSection />}
          {activeTab === 'checklist' && <RoleChecklist userId={user?.id ?? ''} role={role} />}
        </div>
      </div>
    </DashboardLayout>
  );
}

function RoleChecklist({ userId, role }: { userId: string; role: RoleDashboardRole }) {
  const { checklistForUser, toggleChecklistItem, addRoleChecklistItem, updateRoleChecklistItem, deleteRoleChecklistItem } = useLibrary();
  const [confirmItemId, setConfirmItemId] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const checklist = checklistForUser(userId);
  const confirmItem = checklist?.items.find((item) => item.id === confirmItemId) ?? null;
  const canEditTrainingChecklist = can(role, 'update', 'trainerChecklist');
  const trainingChecklistRoles: Role[] = ['TRAINER', 'SENIOR_TRAINER'];

  const addTrainingItem = () => {
    if (!newItemLabel.trim()) return;
    addRoleChecklistItem(trainingChecklistRoles, newItemLabel);
    setNewItemLabel('');
  };

  const startEdit = (index: number, label: string) => {
    setEditingIndex(index);
    setEditingLabel(label);
  };

  const saveEdit = () => {
    if (editingIndex === null || !editingLabel.trim()) return;
    updateRoleChecklistItem(trainingChecklistRoles, editingIndex, editingLabel);
    setEditingIndex(null);
    setEditingLabel('');
  };

  if (!checklist) return <GlassCard><p className="text-[#a89b8f]">Чек-лист пока не создан.</p></GlassCard>;

  return (
    <GlassCard>
      <div className="flex items-center gap-3 mb-6">
        <ListChecks className="w-6 h-6 text-[#c9a98d]" />
        <h2 className="text-2xl text-[#f5f3f0]">{checklist.title}</h2>
      </div>
      {canEditTrainingChecklist && (
        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <input value={newItemLabel} onChange={(event) => setNewItemLabel(event.target.value)} placeholder="Новый пункт чек-листа тренировки" className="field" />
          <button onClick={addTrainingItem} className="primary-action flex items-center justify-center gap-2"><Plus className="h-4 w-4" />Добавить</button>
        </div>
      )}
      <div className="space-y-3">
        {checklist.items.map((item, index) => (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a2630] transition-colors">
            <input type="checkbox" checked={item.completed} onChange={() => item.completed ? toggleChecklistItem(checklist.id, item.id, userId) : setConfirmItemId(item.id)} className="w-5 h-5 rounded accent-[#c9a98d]" />
            <CheckSquare className="w-4 h-4 text-[#c9a98d]" />
            {editingIndex === index ? (
              <input value={editingLabel} onChange={(event) => setEditingLabel(event.target.value)} className="field flex-1 py-2" />
            ) : (
              <span className={`flex-1 ${item.completed ? 'text-[#a89b8f] line-through' : 'text-[#f5f3f0]'}`}>{item.label}</span>
            )}
            {canEditTrainingChecklist && (
              <div className="flex shrink-0 gap-2">
                {editingIndex === index ? (
                  <>
                    <button onClick={saveEdit} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label="Сохранить пункт"><Save className="h-4 w-4" /></button>
                    <button onClick={() => { setEditingIndex(null); setEditingLabel(''); }} className="text-[#a89b8f] hover:text-[#f0c5cf]" aria-label="Отменить"><X className="h-4 w-4" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(index, item.label)} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${item.label}`}><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => deleteRoleChecklistItem(trainingChecklistRoles, index)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${item.label}`}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            )}
          </div>
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
