import { type ReactNode, useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { TabNavigation } from './TabNavigation';
import { GlassCard } from './GlassCard';
import { ConfirmChecklistDialog } from './ConfirmChecklistDialog';
import { RoleContentViewer } from './RoleContent';
import { ExpensesSection, FinancialPlanSection } from './SharedPlanningSections';
import { TrainerEvaluationSheetsSection, TrainerRatingSection } from './TrainerEvaluationSections';
import { CallRatingSection } from './CallRatingSection';
import { AuditLogSection, ControlCenterSection, ShiftJournalSection } from './OwnerDashboard';
import { useLibrary } from '../domain/LibraryContext';
import { employeeStatusLabels, formatDate, formatTime, roleLabels, studioLabels } from '../domain/labels';
import { assistantManagedTeamRoles, can } from '../domain/permissions';
import type { ChecklistControlStatus, EmployeeStatus, Role } from '../domain/types';
import { BookOpen, CheckSquare, Edit2, FileText, Info, Link as LinkIcon, ListChecks, Plus, Save, Trash2, UserRound, X } from 'lucide-react';

export function AssistantDashboard() {
  const [activeTab, setActiveTab] = useState('tasks');
  const { currentUser, state, refreshState } = useLibrary();
  const assistant = currentUser?.role === 'ASSISTANT' ? currentUser : state.users.find((user) => user.role === 'ASSISTANT');

  const tabs = [
    { id: 'control-center', label: 'Центр контроля' },
    { id: 'shift-journal', label: 'Журнал смен' },
    { id: 'audit', label: 'Аудит действий' },
    { id: 'tasks', label: 'Важные задачи' },
    { id: 'financial-plan', label: 'Финансовый план' },
    { id: 'expenses', label: 'Расходы' },
    { id: 'team', label: 'Команда' },
    { id: 'evaluation-sheets', label: 'Листы оценивания' },
    { id: 'trainer-rating', label: 'Рейтинг тренеров' },
    { id: 'call-rating', label: 'Рейтинг звонков' },
    { id: 'admin-checklists', label: 'Контроль чек-листов' },
    { id: 'responsibilities', label: 'Обязанности' },
    { id: 'regulations', label: 'Регламенты' },
    { id: 'info', label: 'Важная информация' },
    { id: 'knowledge', label: 'База знаний' },
    { id: 'templates', label: 'Шаблоны ответов' },
    { id: 'document-templates', label: 'Шаблоны документов' },
    { id: 'links', label: 'Полезные ссылки' },
    { id: 'contacts', label: 'Полезные контакты' },
    { id: 'training', label: 'Обучение' },
    { id: 'checklist', label: 'Чек-лист дня' },
  ];

  return (
    <DashboardLayout role="ASSISTANT" userName={assistant?.name ?? 'Ассистент'}>
      <div className="p-6 lg:p-10">
        <div className="mb-10">
          <h1 className="text-4xl lg:text-5xl mb-3 text-[#f5f3f0]">Кабинет ассистента</h1>
          <p className="text-[#a89b8f]">Единый кабинет роли: доступ выдаётся сотруднику через логин и пароль, без наследования личного кабинета.</p>
        </div>

        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === 'admin-checklists' || tab === 'control-center') void refreshState();
          }}
        />

        <div className="max-w-7xl">
          {activeTab === 'control-center' && <ControlCenterSection />}
          {activeTab === 'shift-journal' && <ShiftJournalSection />}
          {activeTab === 'audit' && <AuditLogSection />}
          {activeTab === 'tasks' && <TasksSection />}
          {activeTab === 'financial-plan' && <FinancialPlanSection />}
          {activeTab === 'expenses' && <ExpensesSection />}
          {activeTab === 'team' && <AssistantTeamSection />}
          {activeTab === 'evaluation-sheets' && <TrainerEvaluationSheetsSection />}
          {activeTab === 'trainer-rating' && <TrainerRatingSection />}
          {activeTab === 'call-rating' && <CallRatingSection />}
          {activeTab === 'admin-checklists' && <AdminChecklistMonitor />}
          {activeTab === 'responsibilities' && <RoleContentViewer role="ASSISTANT" category="RESPONSIBILITY" />}
          {activeTab === 'regulations' && <RoleContentViewer role="ASSISTANT" category="REGULATION" />}
          {activeTab === 'info' && <RoleContentViewer role="ASSISTANT" category="IMPORTANT_INFO" />}
          {activeTab === 'knowledge' && <RoleContentViewer role="ASSISTANT" category="KNOWLEDGE" />}
          {activeTab === 'templates' && <TemplatesSection />}
          {activeTab === 'document-templates' && <DocumentTemplatesSection />}
          {activeTab === 'links' && <LinksSection />}
          {activeTab === 'contacts' && <ContactsSection />}
          {activeTab === 'training' && <TrainingSection />}
          {activeTab === 'checklist' && <ChecklistSection userId={assistant?.id ?? ''} />}
        </div>
      </div>
    </DashboardLayout>
  );
}

const assistantTeamRoles: Role[] = assistantManagedTeamRoles;

function AssistantTeamSection() {
  const { state, createEmployee, updateEmployee, deleteEmployee } = useLibrary();
  const [showModal, setShowModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', email: '', password: '', role: 'ADMIN' as Role, status: 'active' as EmployeeStatus });
  const employees = state.users.filter((employee) => assistantTeamRoles.includes(employee.role));
  const deleteTarget = employees.find((employee) => employee.id === deleteTargetId) ?? null;

  const resetDraft = () => {
    setDraft({ name: '', email: '', password: '', role: 'ADMIN', status: 'active' });
    setEditingId(null);
  };

  const openCreate = () => {
    resetDraft();
    setShowModal(true);
  };

  const openEdit = (employee: typeof employees[number]) => {
    setEditingId(employee.id);
    setDraft({ name: employee.name, email: employee.email, password: '', role: employee.role, status: employee.status });
    setShowModal(true);
  };

  const save = () => {
    if (!draft.name.trim() || !draft.email.trim() || (!editingId && !draft.password.trim())) return;
    if (!can('ASSISTANT', editingId ? 'update' : 'create', 'team', { targetRole: draft.role })) return;
    if (editingId) {
      const input = draft.password.trim() ? draft : { name: draft.name, email: draft.email, role: draft.role, status: draft.status };
      updateEmployee(editingId, input);
    }
    else createEmployee(draft);
    setShowModal(false);
    resetDraft();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl text-[#f5f3f0]">Команда</h2>
          <p className="mt-2 text-sm text-[#a89b8f]">Ассистент управляет доступами администраторов и тренеров. Роли руководителя и ассистента здесь недоступны.</p>
        </div>
        <button onClick={openCreate} className="primary-action inline-flex items-center justify-center gap-2">
          <Plus className="h-4 w-4" />
          Добавить сотрудника
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {employees.map((employee, idx) => (
          <GlassCard key={employee.id} delay={idx * 0.04}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg text-[#f5f3f0]">{employee.name}</h3>
                <p className="mt-1 text-sm text-[#c9a98d]">{roleLabels[employee.role]}</p>
                <p className="mt-3 text-sm text-[#a89b8f]">{employee.email}</p>
                <p className="mt-1 text-xs text-[#a89b8f]">{employeeStatusLabels[employee.status]} · c {employee.joinDate}</p>
              </div>
              <div className="flex gap-2">
                {can('ASSISTANT', 'update', 'team', { targetRole: employee.role }) && <button onClick={() => openEdit(employee)} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${employee.name}`}><Edit2 className="h-4 w-4" /></button>}
                {can('ASSISTANT', 'delete', 'team', { targetRole: employee.role }) && <button onClick={() => setDeleteTargetId(employee.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${employee.name}`}><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
          </GlassCard>
        ))}
        {employees.length === 0 && <GlassCard><p className="text-[#a89b8f]">В команде пока нет администраторов и тренеров.</p></GlassCard>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f0e12]/70 p-4 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <GlassCard className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-2xl text-[#f5f3f0]">{editingId ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h3>
              <button onClick={() => setShowModal(false)} className="text-[#a89b8f] hover:text-[#f5f3f0]" aria-label="Закрыть окно"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} placeholder="Имя" className="field" />
              <input value={draft.email} onChange={(event) => setDraft((value) => ({ ...value, email: event.target.value }))} placeholder="Почта" className="field" />
              <input value={draft.password} onChange={(event) => setDraft((value) => ({ ...value, password: event.target.value }))} placeholder="Пароль" className="field" />
              <select value={draft.role} onChange={(event) => setDraft((value) => ({ ...value, role: event.target.value as Role }))} className="field">
                <option value="SENIOR_ADMIN">Старший администратор</option>
                <option value="ADMIN">Администратор</option>
                <option value="SENIOR_TRAINER">Старший тренер</option>
                <option value="TRAINER">Тренер</option>
              </select>
              <select value={draft.status} onChange={(event) => setDraft((value) => ({ ...value, status: event.target.value as EmployeeStatus }))} className="field md:col-span-2">
                <option value="active">Активен</option>
                <option value="blocked">Заблокирован</option>
                <option value="read-only">Только просмотр</option>
              </select>
            </div>
            <button onClick={save} className="primary-action mt-4">Сохранить</button>
          </GlassCard>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f0e12]/70 p-4 backdrop-blur-sm" onClick={() => setDeleteTargetId(null)}>
          <GlassCard className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl text-[#f5f3f0]">Удалить сотрудника?</h3>
                <p className="mt-2 text-[#a89b8f]">Будет удалён доступ сотрудника: {deleteTarget.name}.</p>
              </div>
              <button onClick={() => setDeleteTargetId(null)} className="text-[#a89b8f] hover:text-[#f5f3f0]" aria-label="Закрыть подтверждение"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={() => setDeleteTargetId(null)} className="rounded-lg border border-[#c9a98d]/20 px-4 py-2 text-[#f5f3f0] hover:bg-[#2a2630]">Отмена</button>
              <button onClick={() => { deleteEmployee(deleteTarget.id); setDeleteTargetId(null); }} className="rounded-lg bg-[#8b3a52] px-4 py-2 text-[#f5f3f0] hover:bg-[#743044]">Удалить</button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function getDeadlineState(deadline?: string | null) {
  if (!deadline) return { label: 'не указан', className: 'bg-[#2a2630] text-[#a89b8f]', border: 'border-transparent' };
  const target = new Date(`${deadline}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  const label = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }).format(target);

  if (diffDays <= 1) return { label, className: 'bg-[#8b3a52]/30 text-[#f0c5cf]', border: 'border-[#8b3a52]' };
  if (diffDays === 2) return { label, className: 'bg-[#b86b3d]/25 text-[#f3c6a8]', border: 'border-[#b86b3d]' };
  if (diffDays === 3) return { label, className: 'bg-[#c9a98d]/25 text-[#f0dcc4]', border: 'border-[#c9a98d]' };
  return { label, className: 'bg-[#2a2630] text-[#a89b8f]', border: 'border-transparent' };
}

function TasksSection() {
  const { state, toggleTask, createTask } = useLibrary();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ title: '', period: '', description: '', priority: 'medium' as const, deadline: '' });
  const tasks = state.tasks
    .filter((task) => task.role === 'ASSISTANT')
    .sort((left, right) => Number(left.status === 'completed') - Number(right.status === 'completed'));

  const addTask = () => {
    if (!draft.title.trim() || !draft.period.trim()) return;
    createTask({ ...draft, deadline: draft.deadline || null });
    setDraft({ title: '', period: '', description: '', priority: 'medium', deadline: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button onClick={() => setShowForm((value) => !value)} className="flex items-center gap-2 px-4 py-2 bg-[#c9a98d]/20 text-[#c9a98d] rounded-lg hover:bg-[#c9a98d]/30">
          <Plus className="w-4 h-4" />
          Добавить задачу
        </button>
      </div>

      {showForm && (
        <GlassCard>
          <div className="grid md:grid-cols-4 gap-3">
            <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Название задачи" className="field" />
            <input value={draft.period} onChange={(event) => setDraft((value) => ({ ...value, period: event.target.value }))} placeholder="Периодичность" className="field" />
            <input type="date" value={draft.deadline} onChange={(event) => setDraft((value) => ({ ...value, deadline: event.target.value }))} className="field" />
            <select value={draft.priority} onChange={(event) => setDraft((value) => ({ ...value, priority: event.target.value as 'high' | 'medium' | 'low' }))} className="field">
              <option value="high">Высокий приоритет</option>
              <option value="medium">Средний приоритет</option>
              <option value="low">Низкий приоритет</option>
            </select>
            <button onClick={addTask} className="primary-action">Сохранить</button>
          </div>
          <textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Описание" className="field min-h-20 mt-3" />
        </GlassCard>
      )}

      {tasks.map((task, idx) => {
        const done = task.status === 'completed';
        const deadline = getDeadlineState(task.deadline);
        return (
          <GlassCard key={task.id} delay={idx * 0.04}>
            <div className={`flex items-start justify-between gap-4 rounded-xl border-l-4 pl-4 ${done ? 'opacity-60' : ''} ${deadline.border}`}>
              <div className="flex items-start gap-4 flex-1">
                <div className={`w-2.5 h-2.5 rounded-full mt-2 ${done ? 'bg-[#5e6d58]' : task.priority === 'high' ? 'bg-[#8b3a52]' : task.priority === 'medium' ? 'bg-[#c9a98d]' : 'bg-[#a89b8f]'}`}></div>
                <div className="flex-1">
                  <h3 className={`text-lg mb-1 ${done ? 'text-[#a89b8f] line-through' : 'text-[#f5f3f0]'}`}>{task.title}</h3>
                  <p className="text-sm text-[#a89b8f] mb-3">{task.description}</p>
                  <div className="flex flex-wrap gap-3">
                    <span className={`text-xs px-2 py-1 rounded ${done ? 'bg-[#5e6d58]/30 text-[#d8e0d2]' : 'bg-[#c9a98d]/20 text-[#c9a98d]'}`}>{done ? 'выполнено' : task.status === 'in-progress' ? 'в работе' : 'ожидает'}</span>
                    <span className="text-xs text-[#a89b8f]">Период: {task.period}</span>
                    {task.deadline && <span className={`text-xs px-2 py-1 rounded ${deadline.className}`}>Дедлайн: {deadline.label}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => toggleTask(task.id)} className={`transition-colors ${done ? 'text-[#5e6d58] hover:text-[#c9a98d]' : 'text-[#a89b8f] hover:text-[#c9a98d]'}`} aria-label={`Переключить задачу ${task.title}`}>
                <CheckSquare className="w-5 h-5" />
              </button>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

function AdminChecklistMonitor() {
  const { adminChecklistReports, refreshState } = useLibrary();
  const reports = adminChecklistReports();
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const selectedReport = reports.find((report) => report.checklist.id === selectedChecklistId) ?? null;
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const getDateKey = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'unknown-date';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const todayReports = reports.filter((report) => getDateKey(report.checklist.date) === todayKey);
  const historyReports = reports.filter((report) => getDateKey(report.checklist.date) !== todayKey);
  const grouped = historyReports.reduce<Record<string, typeof reports>>((acc, report) => {
    const key = getDateKey(report.checklist.date);
    acc[key] = [...(acc[key] ?? []), report];
    return acc;
  }, {});

  if (selectedReport) {
    return <ChecklistSnapshot report={selectedReport} onBack={() => setSelectedChecklistId(null)} />;
  }

  return (
    <div className="space-y-8">
      <button onClick={() => void refreshState()} className="px-4 py-2 rounded-lg border border-[#c9a98d]/20 text-[#f5f3f0] hover:bg-[#2a2630]">
        Обновить из базы
      </button>
      {reports.length === 0 && (
        <GlassCard>
          <p className="text-[#a89b8f]">Пока нет чек-листов администраторов для контроля.</p>
        </GlassCard>
      )}
      <div>
        <h3 className="text-xl mb-4 text-[#f5f3f0]">Сегодня</h3>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {todayReports.map((report, idx) => (
            <GlassCard key={report.checklist.id} delay={idx * 0.05}>
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-lg text-[#f5f3f0]">{report.assignee.name}</h3>
                  <p className="text-sm text-[#a89b8f]">{roleLabels[report.assignee.role]} · {formatDate(report.checklist.date)} · {report.completedCount}/{report.checklist.items.length}</p>
                </div>
                <button onClick={() => setSelectedChecklistId(report.checklist.id)} className="px-4 py-2 rounded-lg bg-[#c9a98d]/20 text-[#c9a98d] hover:bg-[#c9a98d]/30 w-fit">
                  Открыть чек-лист
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xl mb-4 text-[#f5f3f0]">История чек-листов</h3>
        {historyReports.length === 0 && <GlassCard><p className="text-[#a89b8f]">Прошлых чек-листов пока нет.</p></GlassCard>}
      </div>
      {Object.entries(grouped).sort(([left], [right]) => right.localeCompare(left)).map(([dateKey, items]) => (
        <div key={dateKey}>
          <h3 className="text-xl mb-4 text-[#f5f3f0]">{formatDate(dateKey)}</h3>
          <div className="space-y-4">
            {items.map((report, idx) => (
              <GlassCard key={report.checklist.id} delay={idx * 0.05}>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg text-[#f5f3f0]">{report.assignee.name}</h3>
                    <p className="text-sm text-[#a89b8f]">{roleLabels[report.assignee.role]} · {report.completedCount}/{report.checklist.items.length}</p>
                  </div>
                  <button onClick={() => setSelectedChecklistId(report.checklist.id)} className="px-4 py-2 rounded-lg bg-[#c9a98d]/20 text-[#c9a98d] hover:bg-[#c9a98d]/30 w-fit">
                    Открыть чек-лист
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Status({ label, done, time }: { label: string; done: boolean; time?: string | null }) {
  return <span className={`px-3 py-2 rounded-lg ${done ? 'bg-[#5e6d58]/30 text-[#d8e0d2]' : 'bg-[#8b3a52]/25 text-[#f0c5cf]'}`}>{label}: {done ? 'зачтён' : 'нет'} · {formatTime(time)}</span>;
}

type ChecklistMonitorReport = ReturnType<ReturnType<typeof useLibrary>['adminChecklistReports']>[number];

function ChecklistSnapshot({ report, onBack }: { report: ChecklistMonitorReport; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="px-4 py-2 rounded-lg border border-[#c9a98d]/20 text-[#f5f3f0] hover:bg-[#2a2630]">
        Назад к контролю
      </button>
      <GlassCard>
        <div className="mb-6">
          <h3 className="text-2xl text-[#f5f3f0]">{report.assignee.name}</h3>
          <p className="text-sm text-[#a89b8f]">{roleLabels[report.assignee.role]} · {formatDate(report.checklist.date)} · {report.completedCount}/{report.checklist.items.length}</p>
        </div>
        <div className="grid xl:grid-cols-2 gap-3 mb-6">
          <ReportStatusCard slot="14:00" status={report.report14} />
          <ReportStatusCard slot="18:00" status={report.report18} />
        </div>
        <div className="space-y-3">
          {report.checklist.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#2a2630]/55">
              <span className={`w-3 h-3 rounded-full ${item.completed ? 'bg-[#5e6d58]' : 'bg-[#8b3a52]'}`} />
              <span className={`flex-1 ${item.completed ? 'text-[#a89b8f] line-through' : 'text-[#f5f3f0]'}`}>{item.label}</span>
              <span className="text-xs text-[#a89b8f]">{formatTime(item.completedAt)}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function ReportStatusCard({ slot, status }: { slot: string; status: ChecklistControlStatus }) {
  const tone = !status.submitted ? 'border-[#8b3a52]/40 bg-[#8b3a52]/10' : status.onTime ? 'border-[#5e6d58]/45 bg-[#5e6d58]/15' : 'border-[#c9a98d]/45 bg-[#c9a98d]/10';
  const submission = !status.submitted ? 'не сдан' : status.onTime ? 'сдан вовремя' : 'сдан поздно';
  const max = !status.maxSent ? 'не отправлен' : status.maxOnTime ? 'отправлен вовремя' : 'отправлен поздно';

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-[#f5f3f0]">Отчет {slot}</h4>
        <span className={`text-xs px-2 py-1 rounded-full ${status.submitted && status.onTime ? 'bg-[#5e6d58]/35 text-[#d8e0d2]' : 'bg-[#8b3a52]/25 text-[#f0c5cf]'}`}>{submission}</span>
      </div>
      <p className="text-xs text-[#a89b8f] mb-3">{status.label}</p>
      <div className="space-y-1 text-sm text-[#d8d1c8]">
        <p>Студия: {studioLabels[status.studio]}</p>
        <p>Сдача: {formatTime(status.completedAt)}</p>
        <p>MAX: {max}{status.maxSentAt ? ` · ${formatTime(status.maxSentAt)}` : ''}</p>
        {status.maxSendError && <p className="text-[#f0c5cf]">Ошибка MAX: {status.maxSendError}</p>}
      </div>
    </div>
  );
}

function InfoSection() {
  const { state } = useLibrary();
  const infoCards = state.knowledge.filter((entry) => entry.category === 'IMPORTANT_INFO');
  return <Cards entries={infoCards} icon={<Info className="w-5 h-5 text-[#c9a98d] mt-1" />} empty="Важная информация пока не добавлена." />;
}

function Cards({ entries, icon, empty }: { entries: Array<{ id: string; title: string; content: string; hashtags?: string | null }>; icon: ReactNode; empty: string }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {entries.map((card, idx) => (
        <GlassCard key={card.id} delay={idx * 0.08}>
          <div className="flex items-start gap-3 mb-3">
            {icon}
            <h3 className="text-xl text-[#f5f3f0]">{card.title}</h3>
          </div>
          <p className="text-[#a89b8f] leading-relaxed">{card.content}</p>
          {card.hashtags && <p className="text-xs text-[#c9a98d] mt-4">{card.hashtags}</p>}
        </GlassCard>
      ))}
      {entries.length === 0 && <GlassCard><p className="text-[#a89b8f]">{empty}</p></GlassCard>}
    </div>
  );
}

function TemplatesSection() {
  const { state, createTemplate, updateTemplate, deleteTemplate } = useLibrary();
  const templates = state.templates.filter((template) => template.role === 'ASSISTANT');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', body: '', purpose: '' });

  const startEdit = (template: { id: string; title: string; body: string; purpose?: string | null }) => {
    setEditingId(template.id);
    setDraft({ title: template.title, body: template.body, purpose: template.purpose ?? '' });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateTemplate(editingId, draft);
    setEditingId(null);
  };

  return (
    <EditableTemplateList templates={templates} draft={draft} setDraft={setDraft} editingId={editingId} startEdit={startEdit} saveEdit={saveEdit} onAdd={() => createTemplate({ title: 'Новый шаблон ассистента', body: 'Введите текст шаблона...', role: 'ASSISTANT', purpose: 'кандидаты' })} onDelete={deleteTemplate} />
  );
}

function EditableTemplateList({ templates, draft, setDraft, editingId, startEdit, saveEdit, onAdd, onDelete }: any) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2 bg-[#c9a98d]/20 text-[#c9a98d] rounded-lg hover:bg-[#c9a98d]/30">
          <Plus className="w-4 h-4" />
          Добавить шаблон
        </button>
      </div>
      <div className="space-y-4">
        {templates.map((template: any, idx: number) => (
          <GlassCard key={template.id} delay={idx * 0.08}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#c9a98d]" />
                {editingId === template.id ? <input value={draft.title} onChange={(event) => setDraft((value: any) => ({ ...value, title: event.target.value }))} className="field" /> : <h3 className="text-lg text-[#f5f3f0]">{template.title}</h3>}
              </div>
              <div className="flex gap-2">
                {editingId === template.id ? (
                  <>
                    <button onClick={saveEdit} className="text-[#c9a98d]" aria-label="Сохранить шаблон"><Save className="w-4 h-4" /></button>
                    <button onClick={() => startEdit({ id: '', title: '', body: '' })} className="text-[#a89b8f]" aria-label="Отменить"><X className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(template)} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label="Редактировать шаблон"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(template.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label="Удалить шаблон"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            </div>
            {editingId === template.id ? <textarea value={draft.body} onChange={(event) => setDraft((value: any) => ({ ...value, body: event.target.value }))} className="field min-h-24" /> : <p className="text-sm text-[#a89b8f] leading-relaxed">{template.body}</p>}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function LinksSection() {
  const { state, createLink, updateLink, deleteLink } = useLibrary();
  const [draft, setDraft] = useState({ title: '', url: '', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const links = state.links.filter((link) => link.role === 'ASSISTANT');

  const save = () => {
    if (!draft.title.trim()) {
      setError('Укажите название ссылки.');
      return;
    }
    if (!draft.url.trim()) {
      setError('Поле ссылки обязательно.');
      return;
    }
    setError(null);
    if (editingId) updateLink(editingId, draft);
    else createLink({ ...draft, role: 'ASSISTANT' });
    setDraft({ title: '', url: '', description: '' });
    setEditingId(null);
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-4">{editingId ? 'Редактировать ссылку' : 'Добавить ссылку'}</h3>
        <div className="space-y-3">
          <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Название" className="field" />
          <input value={draft.url} onChange={(event) => setDraft((value) => ({ ...value, url: event.target.value }))} placeholder="https://..." className="field" />
          <textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Описание" className="field min-h-20" />
          {error && <p className="text-sm text-[#f0c5cf]">{error}</p>}
          <button onClick={save} className="primary-action">Сохранить</button>
        </div>
      </GlassCard>
      {links.map((link, idx) => (
        <GlassCard key={link.id} delay={idx * 0.08}>
          <div className="flex items-start gap-3">
            <LinkIcon className="w-5 h-5 text-[#c9a98d] mt-1" />
            <div className="flex-1">
              <h3 className="text-[#f5f3f0] mb-1">{link.title}</h3>
              <a href={link.url} className="text-sm text-[#a89b8f] hover:text-[#c9a98d] break-all">{link.url}</a>
              <p className="text-sm text-[#a89b8f] mt-2">{link.description}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => (setEditingId(link.id), setDraft({ title: link.title, url: link.url, description: link.description ?? '' }))} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${link.title}`}><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => deleteLink(link.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${link.title}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function DocumentTemplatesSection() {
  const { state, createDocumentTemplate } = useLibrary();
  const [draft, setDraft] = useState({ title: '', url: '' });

  const save = () => {
    if (!draft.title.trim() || !draft.url.trim()) return;
    createDocumentTemplate(draft);
    setDraft({ title: '', url: '' });
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-4">Добавить шаблон документа</h3>
        <div className="grid md:grid-cols-[1fr_2fr_auto] gap-3">
          <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Название документа" className="field" />
          <input value={draft.url} onChange={(event) => setDraft((value) => ({ ...value, url: event.target.value }))} placeholder="Ссылка Google Drive" className="field" />
          <button onClick={save} className="primary-action">Добавить</button>
        </div>
      </GlassCard>
      <div className="grid md:grid-cols-2 gap-4">
        {state.documentTemplates.map((template, idx) => (
          <GlassCard key={template.id} delay={idx * 0.06}>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-[#c9a98d] mt-1" />
              <div>
                <h3 className="text-lg text-[#f5f3f0]">{template.title}</h3>
                <a href={template.url} target="_blank" rel="noreferrer" className="text-sm text-[#a89b8f] hover:text-[#c9a98d] break-all">{template.url}</a>
              </div>
            </div>
          </GlassCard>
        ))}
        {state.documentTemplates.length === 0 && <GlassCard><p className="text-[#a89b8f]">Шаблоны документов пока не добавлены.</p></GlassCard>}
      </div>
    </div>
  );
}

function ContactsSection() {
  const { state, createUsefulContact, updateUsefulContact, deleteUsefulContact } = useLibrary();
  const [draft, setDraft] = useState({ name: '', phone: '', company: '', specialty: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = () => {
    if (!draft.name.trim() || !draft.phone.trim()) return;
    if (editingId) updateUsefulContact(editingId, draft);
    else createUsefulContact(draft);
    setDraft({ name: '', phone: '', company: '', specialty: '' });
    setEditingId(null);
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-4">{editingId ? 'Редактировать контакт' : 'Добавить контакт'}</h3>
        <div className="space-y-3">
          <input value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} placeholder="Имя" className="field" />
          <input value={draft.phone} onChange={(event) => setDraft((value) => ({ ...value, phone: event.target.value }))} placeholder="Номер" className="field" />
          <input value={draft.company} onChange={(event) => setDraft((value) => ({ ...value, company: event.target.value }))} placeholder="Компания" className="field" />
          <textarea value={draft.specialty} onChange={(event) => setDraft((value) => ({ ...value, specialty: event.target.value }))} placeholder="Чем занимаются" className="field min-h-20" />
          <button onClick={save} className="primary-action">Сохранить</button>
        </div>
      </GlassCard>
      {state.usefulContacts.map((contact, idx) => (
        <GlassCard key={contact.id} delay={idx * 0.08}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <UserRound className="w-5 h-5 text-[#c9a98d] mt-1" />
              <div>
                <h3 className="text-[#f5f3f0]">{contact.name}</h3>
                <p className="text-sm text-[#c9a98d]">{contact.phone}</p>
                <p className="text-sm text-[#a89b8f] mt-2">{contact.company}</p>
                <p className="text-sm text-[#a89b8f] mt-1">{contact.specialty}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => (setEditingId(contact.id), setDraft({ name: contact.name, phone: contact.phone, company: contact.company, specialty: contact.specialty }))} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${contact.name}`}><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => deleteUsefulContact(contact.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${contact.name}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function TrainingSection() {
  const { state, createKnowledge } = useLibrary();
  const [draft, setDraft] = useState({ title: '', content: '' });
  const materials = state.knowledge.filter((entry) => entry.category === 'TRAINING' && entry.role === 'ASSISTANT');

  const add = () => {
    if (!draft.title.trim() || !draft.content.trim()) return;
    createKnowledge({ ...draft, role: 'ASSISTANT', category: 'TRAINING', hashtags: '#обучение' });
    setDraft({ title: '', content: '' });
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-4">Добавить материал</h3>
        <div className="grid md:grid-cols-[1fr_2fr_auto] gap-3">
          <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Название" className="field" />
          <input value={draft.content} onChange={(event) => setDraft((value) => ({ ...value, content: event.target.value }))} placeholder="Описание или ссылка на материал" className="field" />
          <button onClick={add} className="primary-action">Добавить</button>
        </div>
      </GlassCard>
      {materials.map((material, idx) => (
        <GlassCard key={material.id} delay={idx * 0.08}>
          <div className="flex items-center gap-4">
            <BookOpen className="w-5 h-5 text-[#c9a98d]" />
            <div className="min-w-0">
              <h3 className="text-lg mb-1 text-[#f5f3f0]">{material.title}</h3>
              <p className="break-anywhere text-sm text-[#a89b8f]">{material.content}</p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function ChecklistSection({ userId }: { userId: string }) {
  const { checklistForUser, toggleChecklistItem, addChecklistItem, deleteChecklistItem } = useLibrary();
  const [label, setLabel] = useState('');
  const [confirmItemId, setConfirmItemId] = useState<string | null>(null);
  const checklist = checklistForUser(userId);
  const confirmItem = checklist?.items.find((item) => item.id === confirmItemId) ?? null;

  if (!checklist) return <GlassCard><p className="text-[#a89b8f]">Чек-лист ещё не создан.</p></GlassCard>;

  return (
    <GlassCard>
      <div className="flex items-center gap-3 mb-6">
        <ListChecks className="w-6 h-6 text-[#c9a98d]" />
        <h2 className="text-2xl text-[#f5f3f0]">{checklist.title}</h2>
      </div>
      <div className="flex gap-2 mb-4">
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Новый пункт чек-листа" className="field" />
        <button onClick={() => (addChecklistItem(checklist.id, label), setLabel(''))} className="primary-action">Добавить</button>
      </div>
      <div className="space-y-3">
        {checklist.items.map((item) => (
          <label key={item.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a2630]">
            <input type="checkbox" checked={item.completed} onChange={() => item.completed ? toggleChecklistItem(checklist.id, item.id, userId) : setConfirmItemId(item.id)} className="w-5 h-5 rounded accent-[#c9a98d]" />
            <span className={`flex-1 ${item.completed ? 'text-[#a89b8f] line-through' : 'text-[#f5f3f0]'}`}>{item.label}</span>
            <button type="button" onClick={() => deleteChecklistItem(checklist.id, item.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${item.label}`}><Trash2 className="w-4 h-4" /></button>
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
