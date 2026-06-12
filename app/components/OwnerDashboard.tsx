import { useEffect, useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { TabNavigation } from './TabNavigation';
import { GlassCard } from './GlassCard';
import { OwnerLinksManager, OwnerRoleContentManager, OwnerTemplatesManager } from './RoleContent';
import { ExpensesSection, FinancialPlanSection } from './SharedPlanningSections';
import { CallRatingSection } from './CallRatingSection';
import { TrainerEvaluationSheetsSection, TrainerRatingSection } from './TrainerEvaluationSections';
import { TrainerHiringSection } from './TrainerHiringSection';
import { useLibrary } from '../domain/LibraryContext';
import { employeeStatusLabels, formatDate, formatTime, refundStatusLabels, roleLabels, studioLabels } from '../domain/labels';
import { can } from '../domain/permissions';
import type { ChecklistControlStatus, EmployeeStatus, HelpfulLink, KnowledgeCategory, LinkCategory, RefundStatus, Role } from '../domain/types';
import { Activity, AlertCircle, Clock3, DollarSign, Edit2, FileText, Info, Link as LinkIcon, ListChecks, Plus, Save, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { SEARCH_NAVIGATION_EVENT, type SearchNavigationDetail } from './searchNavigation';


function SectionLoader() {
  return <GlassCard><p className="text-sm text-[#a89b8f]">Загружаем раздел...</p></GlassCard>;
}

const tabs = [
  { id: 'owner-links', label: 'Мои таблицы и ссылки' },
  { id: 'control-center', label: 'Центр контроля' },
  { id: 'shift-journal', label: 'Журнал смен' },
  { id: 'audit', label: 'Аудит действий' },
  { id: 'team', label: 'Команда' },
  { id: 'financial-plan', label: 'Финансовый план' },
  { id: 'expenses', label: 'Расходы' },
  { id: 'evaluation-sheets', label: 'Листы оценивания' },
  { id: 'trainer-hiring', label: 'Приём тренера' },
  { id: 'trainer-rating', label: 'Рейтинг тренеров' },
  { id: 'call-rating', label: 'Рейтинг звонков' },
  { id: 'responsibilities', label: 'Обязанности' },
  { id: 'regulations', label: 'Регламенты' },
  { id: 'info', label: 'Важная информация' },
  { id: 'knowledge', label: 'База знаний' },
  { id: 'templates', label: 'Шаблоны сообщений' },
  { id: 'document-templates', label: 'Шаблоны документов' },
  { id: 'links', label: 'Рабочие ссылки и таблицы' },
  { id: 'contacts', label: 'Полезные контакты' },
  { id: 'training', label: 'Обучение' },
  { id: 'checklists', label: 'Контроль чек-листов' },
  { id: 'calls', label: 'Чек-лист звонка' },
  { id: 'refunds', label: 'Возвраты' },
];

export function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState('control-center');
  const { currentUser, state, refreshSlice } = useLibrary();
  const owner = currentUser?.role === 'OWNER' ? currentUser : state.users.find((user) => user.role === 'OWNER');

  const refreshTabData = (tab: string) => {
    const sliceByTab: Record<string, Parameters<typeof refreshSlice>[0]> = {
      'control-center': 'control',
      'shift-journal': 'control',
      audit: 'audit',
      team: 'team',
      'financial-plan': 'financial-plan',
      expenses: 'expenses',
      'evaluation-sheets': 'ratings',
      'trainer-hiring': 'trainer-hiring',
      'trainer-rating': 'ratings',
      'call-rating': 'ratings',
      responsibilities: 'content',
      regulations: 'content',
      info: 'content',
      knowledge: 'content',
      templates: 'content',
      'document-templates': 'content',
      'owner-links': 'content',
      links: 'content',
      contacts: 'content',
      training: 'content',
      checklists: 'checklists',
      calls: 'content',
      refunds: 'refunds',
    };
    const slice = sliceByTab[tab];
    if (slice) void refreshSlice(slice);
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SearchNavigationDetail>).detail;
      if (!detail?.tabId || !tabs.some((tab) => tab.id === detail.tabId)) return;
      setActiveTab(detail.tabId);
      refreshTabData(detail.tabId);
    };

    window.addEventListener(SEARCH_NAVIGATION_EVENT, handler);
    return () => window.removeEventListener(SEARCH_NAVIGATION_EVENT, handler);
  }, []);

  return (
    <DashboardLayout role="OWNER" userName={owner?.name ?? 'Руководитель'}>
      <div className="p-6 lg:p-10">
        <div className="mb-10">
          <h1 className="text-4xl lg:text-5xl mb-3 text-[#f5f3f0]">Кабинет руководителя</h1>
          <p className="text-[#a89b8f]">Все рабочие вкладки сотрудников плюс отдельное управление контентом и доступами.</p>
        </div>

        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            refreshTabData(tab);
          }}
        />

        <div className="max-w-7xl">
          {activeTab === 'control-center' && <ControlCenterSection />}
          {activeTab === 'shift-journal' && <ShiftJournalSection />}
          {activeTab === 'audit' && <AuditLogSection />}
          {activeTab === 'team' && <TeamSection />}
          {activeTab === 'financial-plan' && <FinancialPlanSection />}
          {activeTab === 'expenses' && <ExpensesSection />}
          {activeTab === 'evaluation-sheets' && <TrainerEvaluationSheetsSection />}
          {activeTab === 'trainer-hiring' && <TrainerHiringSection />}
          {activeTab === 'trainer-rating' && <TrainerRatingSection />}
          {activeTab === 'call-rating' && <CallRatingSection />}
          {activeTab === 'responsibilities' && <OwnerRoleContentManager category="RESPONSIBILITY" />}
          {activeTab === 'regulations' && <OwnerRoleContentManager category="REGULATION" />}
          {activeTab === 'info' && <OwnerRoleContentManager category="IMPORTANT_INFO" />}
          {activeTab === 'knowledge' && <OwnerRoleContentManager category="KNOWLEDGE" />}
          {activeTab === 'templates' && <OwnerTemplatesManager />}
          {activeTab === 'document-templates' && <OwnerDocumentTemplatesSection />}
          {activeTab === 'owner-links' && <OwnerPersonalLinksSection />}
          {activeTab === 'links' && <OwnerLinksManager />}
          {activeTab === 'contacts' && <OwnerUsefulContactsSection />}
          {activeTab === 'training' && <OwnerRoleContentManager category="TRAINING" />}
          {activeTab === 'checklists' && <MonitoringSection />}
          {activeTab === 'calls' && <CallsSection />}
          {activeTab === 'refunds' && <RefundsOverviewSection />}
        </div>
      </div>
    </DashboardLayout>
  );
}

export function ControlCenterSection() {
  const { state, ownerChecklistReports, refreshSlice } = useLibrary();
  const today = localDateKey();
  const reports = ownerChecklistReports();
  const todayReports = reports.filter((report) => localDateKey(report.checklist.date) === today);
  const lateReports = todayReports.flatMap((report) => [
    { slot: '14:00', report, status: report.report14 },
    { slot: '18:00', report, status: report.report18 },
  ]).filter((item) => item.status.submitted && !item.status.onTime);
  const missingReports = todayReports.flatMap((report) => [
    { slot: '14:00', report, status: report.report14 },
    { slot: '18:00', report, status: report.report18 },
  ]).filter((item) => !item.status.submitted);
  const todayShifts = state.adminShifts.filter((shift) => shift.date === today);
  const activeRefunds = state.refunds.filter((refund) => refund.status === 'NEW' || refund.status === 'IN_PROGRESS');
  const activeTasks = state.tasks.filter((task) => task.status !== 'completed');
  const urgentTasks = activeTasks.filter((task) => {
    if (!task.deadline) return false;
    const diff = Math.ceil((new Date(`${task.deadline}T00:00:00`).getTime() - Date.now()) / 86_400_000);
    return diff <= 3;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl text-[#f5f3f0]">Центр контроля</h2>
          <p className="mt-2 text-sm text-[#a89b8f]">Оперативная сводка по сменам, отчётам, задачам и возвратам.</p>
        </div>
        <button onClick={() => void refreshSlice('control')} className="primary-action inline-flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Обновить из базы
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard value={todayShifts.length} label="Смен открыто сегодня" />
        <StatCard value={missingReports.length} label="Отчётов не сдано" />
        <StatCard value={lateReports.length} label="Сдано с опозданием" />
        <StatCard value={urgentTasks.length} label="Срочных задач" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <GlassCard>
          <div className="mb-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-[#c9a98d]" />
            <h3 className="text-xl text-[#f5f3f0]">Что требует внимания</h3>
          </div>
          <div className="space-y-3">
            {missingReports.slice(0, 8).map((item) => (
              <ControlRow
                key={`${item.report.checklist.id}-${item.slot}`}
                title={`${item.report.assignee.name} · отчёт ${item.slot}`}
                meta={`Не сдан · ${roleLabels[item.report.assignee.role]}`}
                tone="danger"
              />
            ))}
            {lateReports.slice(0, 8).map((item) => (
              <ControlRow
                key={`late-${item.report.checklist.id}-${item.slot}`}
                title={`${item.report.assignee.name} · отчёт ${item.slot}`}
                meta={`Сдан поздно: ${formatTime(item.status.completedAt)}`}
                tone="warning"
              />
            ))}
            {activeRefunds.slice(0, 5).map((refund) => (
              <ControlRow key={refund.id} title={`Возврат: ${refund.clientName}`} meta={`${refund.amount.toLocaleString('ru-RU')} ₽ · ${refundStatusLabels[refund.status]}`} tone="warning" />
            ))}
            {!missingReports.length && !lateReports.length && !activeRefunds.length && (
              <p className="text-sm text-[#a89b8f]">Критичных событий сейчас нет.</p>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-[#c9a98d]" />
            <h3 className="text-xl text-[#f5f3f0]">Сегодняшние смены</h3>
          </div>
          <div className="space-y-3">
            {todayShifts.map((shift) => {
              const user = state.users.find((item) => item.id === shift.userId);
              return (
                <ControlRow
                  key={shift.id}
                  title={shift.adminName}
                  meta={`${studioLabels[shift.studio]} · ${formatTime(shift.startedAt)} · ${user ? roleLabels[user.role] : 'Администратор'}`}
                  tone={shift.reminderScheduleError ? 'danger' : 'ok'}
                />
              );
            })}
            {!todayShifts.length && <p className="text-sm text-[#a89b8f]">Сегодня смены ещё не открывались.</p>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

export function ShiftJournalSection() {
  const { state } = useLibrary();
  const shifts = [...state.adminShifts].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl text-[#f5f3f0]">Журнал смен</h2>
        <p className="mt-2 text-sm text-[#a89b8f]">История открытия смен администраторами и статус постановки MAX-напоминаний.</p>
      </div>
      <div className="space-y-3">
        {shifts.map((shift) => {
          const user = state.users.find((item) => item.id === shift.userId);
          return (
            <GlassCard key={shift.id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg text-[#f5f3f0]">{shift.adminName}</h3>
                  <p className="mt-1 text-sm text-[#a89b8f]">{user ? roleLabels[user.role] : 'Администратор'} · {studioLabels[shift.studio]}</p>
                </div>
                <div className="grid gap-2 text-sm text-[#d8d1c8] md:text-right">
                  <span>{formatDate(shift.date)} · {formatTime(shift.startedAt)}</span>
                  <span className={shift.reminderScheduleError ? 'text-[#f0c5cf]' : 'text-[#d8e0d2]'}>
                    {shift.reminderScheduleError ? `MAX: ${shift.reminderScheduleError}` : shift.remindersScheduledAt ? `MAX-напоминания: ${formatTime(shift.remindersScheduledAt)}` : 'MAX-напоминания ожидают'}
                  </span>
                </div>
              </div>
            </GlassCard>
          );
        })}
        {!shifts.length && <GlassCard><p className="text-[#a89b8f]">Журнал смен пока пуст.</p></GlassCard>}
      </div>
    </div>
  );
}

export function AuditLogSection() {
  const { state } = useLibrary();
  const entries = [...(state.auditLog || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl text-[#f5f3f0]">Аудит действий</h2>
        <p className="mt-2 text-sm text-[#a89b8f]">Последние системные действия: входы, смены, сотрудники, чек-листы и отчёты.</p>
      </div>
      <div className="space-y-3">
        {entries.map((entry) => (
          <GlassCard key={entry.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 text-[#c9a98d]" />
                <div>
                  <h3 className="text-[#f5f3f0]">{entry.entityLabel}</h3>
                  <p className="mt-1 text-sm text-[#a89b8f]">{auditActionLabel(entry.action)} · {entry.description}</p>
                  <p className="mt-2 text-xs text-[#c9a98d]">{entry.actorName}{entry.actorRole ? ` · ${roleLabels[entry.actorRole]}` : ''}</p>
                </div>
              </div>
              <span className="text-sm text-[#a89b8f]">{formatDate(entry.createdAt)} · {formatTime(entry.createdAt)}</span>
            </div>
          </GlassCard>
        ))}
        {!entries.length && <GlassCard><p className="text-[#a89b8f]">Аудит пока пуст. Новые действия будут появляться здесь автоматически.</p></GlassCard>}
      </div>
    </div>
  );
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    'auth.login': 'Вход',
    'auth.password_reset': 'Смена пароля',
    'shift.start': 'Открытие смены',
    'employee.create': 'Создание сотрудника',
    'employee.update': 'Редактирование сотрудника',
    'employee.delete': 'Удаление сотрудника',
    'checklist.item_toggle': 'Пункт чек-листа',
    'checklist.report_update': 'Отчёт чек-листа',
    'content.create': 'Создание контента',
    'content.update': 'Редактирование контента',
    'content.delete': 'Удаление контента',
    'finance.update': 'Финансы',
  };
  return labels[action] ?? action;
}

function localDateKey(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function ControlRow({ title, meta, tone }: { title: string; meta: string; tone: 'ok' | 'warning' | 'danger' }) {
  const toneClass = tone === 'ok' ? 'bg-[#5e6d58]/18 text-[#d8e0d2]' : tone === 'warning' ? 'bg-[#c9a98d]/18 text-[#c9a98d]' : 'bg-[#8b3a52]/20 text-[#f0c5cf]';
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-[#2a2630]/55 p-3">
      <div>
        <p className="text-sm text-[#f5f3f0]">{title}</p>
        <p className="mt-1 text-xs text-[#a89b8f]">{meta}</p>
      </div>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneClass}`} />
    </div>
  );
}

function TeamSection() {
  const { state, createEmployee, updateEmployee, deleteEmployee } = useLibrary();
  const [showModal, setShowModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', email: '', password: '', role: 'ADMIN' as Role, status: 'active' as EmployeeStatus });
  const deleteTarget = state.users.find((employee) => employee.id === deleteTargetId) ?? null;

  const openCreate = () => {
    setEditingId(null);
    setDraft({ name: '', email: '', password: '', role: 'ADMIN', status: 'active' });
    setShowModal(true);
  };

  const openEdit = (employee: typeof state.users[number]) => {
    setEditingId(employee.id);
    setDraft({ name: employee.name, email: employee.email, password: '', role: employee.role, status: employee.status });
    setShowModal(true);
  };

  const save = () => {
    if (!draft.name.trim() || !draft.email.trim() || (!editingId && !draft.password.trim())) return;
    if (editingId) {
      const input = draft.password.trim() ? draft : { name: draft.name, email: draft.email, role: draft.role, status: draft.status };
      updateEmployee(editingId, input);
    }
    else createEmployee(draft);
    setShowModal(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl text-[#f5f3f0]">Команда</h2>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#c9a98d] to-[#b88b7a] text-[#0f0e12] rounded-lg">
          <Plus className="w-4 h-4" />
          Добавить сотрудника
        </button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {state.users.map((employee, idx) => (
          <GlassCard key={employee.id} delay={idx * 0.04}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg text-[#f5f3f0]">{employee.name}</h3>
                <p className="text-sm text-[#c9a98d] mt-1">{roleLabels[employee.role]}</p>
                <p className="text-sm text-[#a89b8f] mt-3">{employee.email}</p>
                <p className="text-xs text-[#a89b8f] mt-1">{employeeStatusLabels[employee.status]} · c {employee.joinDate}</p>
              </div>
              <div className="flex gap-2">
                {can('OWNER', 'update', 'team', { targetRole: employee.role }) && <button onClick={() => openEdit(employee)} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${employee.name}`}><Edit2 className="w-4 h-4" /></button>}
                {can('OWNER', 'delete', 'team', { targetRole: employee.role, ownerProtected: employee.role === 'OWNER' }) && <button onClick={() => setDeleteTargetId(employee.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${employee.name}`}><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-[#0f0e12]/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <GlassCard className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-2xl text-[#f5f3f0]">{editingId ? 'Редактировать сотрудника' : 'Новый сотрудник'}</h3>
              <button onClick={() => setShowModal(false)} className="text-[#a89b8f]" aria-label="Закрыть окно"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} placeholder="Имя" className="field" />
              <input value={draft.email} onChange={(event) => setDraft((value) => ({ ...value, email: event.target.value }))} placeholder="Почта" className="field" />
              <input value={draft.password} onChange={(event) => setDraft((value) => ({ ...value, password: event.target.value }))} placeholder="Пароль" className="field" />
              <select value={draft.role} onChange={(event) => setDraft((value) => ({ ...value, role: event.target.value as Role }))} className="field">
                <option value="ASSISTANT">Ассистент</option>
                <option value="SENIOR_ADMIN">Старший администратор</option>
                <option value="ADMIN">Администратор</option>
                <option value="SENIOR_TRAINER">Старший тренер</option>
                <option value="TRAINER">Тренер</option>
                <option value="OWNER">Руководитель</option>
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
        <div className="fixed inset-0 z-50 bg-[#0f0e12]/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteTargetId(null)}>
          <GlassCard className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-between items-start gap-4 mb-5">
              <div>
                <h3 className="text-2xl text-[#f5f3f0]">Удалить сотрудника?</h3>
                <p className="text-[#a89b8f] mt-2">Будет удалён доступ и связанный чек-лист: {deleteTarget.name}.</p>
              </div>
              <button onClick={() => setDeleteTargetId(null)} className="text-[#a89b8f]" aria-label="Закрыть подтверждение"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setDeleteTargetId(null)} className="px-4 py-2 rounded-lg border border-[#c9a98d]/20 text-[#f5f3f0] hover:bg-[#2a2630]">Отмена</button>
              <button onClick={() => { deleteEmployee(deleteTarget.id); setDeleteTargetId(null); }} className="px-4 py-2 rounded-lg bg-[#8b3a52] text-[#f5f3f0] hover:bg-[#743044]">Удалить</button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function KnowledgeList({ category }: { category: KnowledgeCategory }) {
  const { state } = useLibrary();
  const entries = state.knowledge.filter((entry) => entry.category === category);
  return (
    <div className="grid md:grid-cols-2 gap-5">
      {entries.map((entry, idx) => (
        <GlassCard key={entry.id} delay={idx * 0.05}>
          <div className="flex items-start gap-3 mb-3">
            <Info className="w-5 h-5 text-[#c9a98d] mt-1" />
            <div>
              <h3 className="text-xl text-[#f5f3f0]">{entry.title}</h3>
              <p className="text-xs text-[#c9a98d] mt-1">{roleLabels[entry.role]}</p>
            </div>
          </div>
          <p className="text-[#a89b8f]">{entry.content}</p>
        </GlassCard>
      ))}
    </div>
  );
}

function TemplatesSection() {
  const { state } = useLibrary();
  return (
    <div className="space-y-4">
      {state.templates.map((template, idx) => (
        <GlassCard key={template.id} delay={idx * 0.04}>
          <div className="flex gap-3">
            <FileText className="w-5 h-5 text-[#c9a98d] mt-1" />
            <div>
              <h3 className="text-lg text-[#f5f3f0]">{template.title}</h3>
              <p className="text-xs text-[#c9a98d]">{roleLabels[template.role]} · {template.purpose}</p>
              <p className="text-sm text-[#a89b8f] mt-3">{template.body}</p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function LinksSection() {
  const { state } = useLibrary();
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {state.links.map((link, idx) => (
        <GlassCard key={link.id} delay={idx * 0.04}>
          <div className="flex gap-3">
            <LinkIcon className="w-5 h-5 text-[#c9a98d] mt-1" />
            <div>
              <h3 className="text-[#f5f3f0]">{link.title}</h3>
              <a href={link.url} className="text-sm text-[#a89b8f] hover:text-[#c9a98d] break-all">{link.url}</a>
              <p className="text-sm text-[#a89b8f] mt-2">{link.description}</p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function OwnerPersonalLinksSection() {
  const { state, createLink, updateLink, deleteLink } = useLibrary();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', url: '', description: '', category: 'WORK_TABLE' as LinkCategory });
  const [error, setError] = useState<string | null>(null);
  const links = state.links.filter((link) => link.role === 'OWNER');

  const reset = () => {
    setEditingId(null);
    setDraft({ title: '', url: '', description: '', category: 'WORK_TABLE' });
  };

  const startEdit = (link: HelpfulLink) => {
    setEditingId(link.id);
    setDraft({
      title: link.title,
      url: link.url,
      description: link.description ?? '',
      category: link.category,
    });
    setError(null);
  };

  const save = () => {
    if (!draft.title.trim()) {
      setError('Укажите название.');
      return;
    }
    if (!draft.url.trim()) {
      setError('Поле ссылки обязательно.');
      return;
    }
    setError(null);
    const input = { ...draft, role: 'OWNER' as Role };
    if (editingId) updateLink(editingId, input);
    else createLink(input);
    reset();
  };

  return (
    <div className="space-y-5">
      <GlassCard>
        <div className="mb-4 flex items-start gap-3">
          <LinkIcon className="mt-1 h-5 w-5 text-[#c9a98d]" />
          <div>
            <h2 className="text-2xl text-[#f5f3f0]">Мои таблицы и ссылки</h2>
            <p className="mt-1 text-sm text-[#a89b8f]">Личные рабочие материалы руководителя. Доступ к созданию, редактированию и удалению есть только у руководителя.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Название" className="field" />
          <input value={draft.url} onChange={(event) => setDraft((value) => ({ ...value, url: event.target.value }))} placeholder="https://..." className="field" />
          <select value={draft.category} onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value as LinkCategory }))} className="field">
            <option value="WORK_TABLE">Таблица</option>
            <option value="HELPFUL">Ссылка</option>
            <option value="TRAINING">Материал</option>
          </select>
          <textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Описание" className="field min-h-24 md:col-span-2" />
        </div>
        {error && <p className="mt-3 text-sm text-[#f0c5cf]">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={save} className="primary-action inline-flex items-center gap-2"><Save className="h-4 w-4" />Сохранить</button>
          {editingId && <button onClick={reset} className="rounded-lg border border-[#c9a98d]/20 px-4 py-2 text-[#f5f3f0] hover:bg-[#2a2630]">Отменить</button>}
        </div>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2">
        {links.length === 0 && <GlassCard><p className="text-[#a89b8f]">Личные таблицы и ссылки пока не добавлены.</p></GlassCard>}
        {links.map((link) => (
          <GlassCard key={link.id} data-search-target={`link:${link.id}`}>
            <div className="flex justify-between gap-4">
              <div className="min-w-0">
                <p className="mb-2 text-xs uppercase tracking-[0.28em] text-[#c9a98d]">{link.category === 'WORK_TABLE' ? 'Таблица' : 'Ссылка'}</p>
                <h3 className="text-lg text-[#f5f3f0]">{link.title}</h3>
                <a href={link.url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm text-[#a89b8f] hover:text-[#c9a98d]">{link.url}</a>
                {link.description && <p className="mt-3 whitespace-pre-line text-sm text-[#a89b8f]">{link.description}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => startEdit(link)} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${link.title}`}><Edit2 className="h-4 w-4" /></button>
                <button onClick={() => deleteLink(link.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${link.title}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function OwnerDocumentTemplatesSection() {
  const { state, createDocumentTemplate, updateDocumentTemplate, deleteDocumentTemplate } = useLibrary();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', url: '' });

  const reset = () => {
    setEditingId(null);
    setDraft({ title: '', url: '' });
  };

  const save = () => {
    if (!draft.title.trim() || !draft.url.trim()) return;
    if (editingId) updateDocumentTemplate(editingId, draft);
    else createDocumentTemplate(draft);
    reset();
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-4">{editingId ? 'Редактировать шаблон документа' : 'Добавить шаблон документа'}</h3>
        <div className="grid md:grid-cols-[1fr_2fr_auto] gap-3">
          <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Название документа" className="field" />
          <input value={draft.url} onChange={(event) => setDraft((value) => ({ ...value, url: event.target.value }))} placeholder="Ссылка Google Drive" className="field" />
          <button onClick={save} className="primary-action">Сохранить</button>
        </div>
        {editingId && <button onClick={reset} className="mt-3 text-sm text-[#a89b8f] hover:text-[#c9a98d]">Отменить редактирование</button>}
      </GlassCard>
      <div className="grid md:grid-cols-2 gap-4">
        {state.documentTemplates.map((template, idx) => (
          <GlassCard key={template.id} delay={idx * 0.06} data-search-target={`documentTemplate:${template.id}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-[#c9a98d] mt-1" />
                <div>
                  <h3 className="text-lg text-[#f5f3f0]">{template.title}</h3>
                  <a href={template.url} target="_blank" rel="noreferrer" className="text-sm text-[#a89b8f] hover:text-[#c9a98d] break-all">{template.url}</a>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingId(template.id); setDraft({ title: template.title, url: template.url }); }} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${template.title}`}><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => deleteDocumentTemplate(template.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${template.title}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </GlassCard>
        ))}
        {state.documentTemplates.length === 0 && <GlassCard><p className="text-[#a89b8f]">Шаблоны документов пока не добавлены.</p></GlassCard>}
      </div>
    </div>
  );
}

function OwnerUsefulContactsSection() {
  const { state, createUsefulContact, updateUsefulContact, deleteUsefulContact } = useLibrary();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', phone: '', company: '', specialty: '' });

  const reset = () => {
    setEditingId(null);
    setDraft({ name: '', phone: '', company: '', specialty: '' });
  };

  const save = () => {
    if (!draft.name.trim() || !draft.phone.trim()) return;
    if (editingId) updateUsefulContact(editingId, draft);
    else createUsefulContact(draft);
    reset();
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-4">{editingId ? 'Редактировать полезный контакт' : 'Добавить полезный контакт'}</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <input value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} placeholder="Имя" className="field" />
          <input value={draft.phone} onChange={(event) => setDraft((value) => ({ ...value, phone: event.target.value }))} placeholder="Номер" className="field" />
          <input value={draft.company} onChange={(event) => setDraft((value) => ({ ...value, company: event.target.value }))} placeholder="Компания" className="field" />
          <textarea value={draft.specialty} onChange={(event) => setDraft((value) => ({ ...value, specialty: event.target.value }))} placeholder="Чем занимаются" className="field min-h-20" />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={save} className="primary-action">Сохранить</button>
          {editingId && <button onClick={reset} className="px-4 py-2 rounded-lg border border-[#c9a98d]/20 text-[#f5f3f0] hover:bg-[#2a2630]">Отмена</button>}
        </div>
      </GlassCard>

      <div className="grid md:grid-cols-2 gap-4">
        {state.usefulContacts.map((contact, idx) => (
          <GlassCard key={contact.id} delay={idx * 0.06} data-search-target={`usefulContact:${contact.id}`}>
            <div className="flex items-start justify-between gap-4">
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
                <button onClick={() => { setEditingId(contact.id); setDraft({ name: contact.name, phone: contact.phone, company: contact.company, specialty: contact.specialty }); }} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${contact.name}`}><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => deleteUsefulContact(contact.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${contact.name}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </GlassCard>
        ))}
        {state.usefulContacts.length === 0 && <GlassCard><p className="text-[#a89b8f]">Полезные контакты пока не добавлены.</p></GlassCard>}
      </div>
    </div>
  );
}

function MonitoringSection() {
  const { ownerChecklistReports, refreshSlice } = useLibrary();
  const reports = ownerChecklistReports();
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
    return <OwnerChecklistSnapshot report={selectedReport} onBack={() => setSelectedChecklistId(null)} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl text-[#f5f3f0]">Контроль чек-листов администраторов</h2>
        <p className="text-[#a89b8f] mt-2">Сегодня показаны только карточки чек-листов. Откройте карточку, чтобы посмотреть полный список пунктов и отчёты.</p>
      </div>
      <button onClick={() => void refreshSlice('checklists')} className="px-4 py-2 rounded-lg border border-[#c9a98d]/20 text-[#f5f3f0] hover:bg-[#2a2630] w-fit">
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
          {todayReports.map((report, i) => (
            <GlassCard key={report.checklist.id} delay={i * 0.04}>
              <div className="flex flex-col gap-4">
                <div>
                  <h4 className="text-[#f5f3f0]">{report.assignee.name}</h4>
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
            {items.map((report, i) => (
              <GlassCard key={report.checklist.id} delay={i * 0.04}>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[#f5f3f0]">{report.assignee.name}</h4>
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

function ReportBadge({ label, done, time }: { label: string; done: boolean; time?: string | null }) {
  return <span className={`px-3 py-2 rounded-lg flex items-center gap-2 ${done ? 'bg-[#5e6d58]/30 text-[#d8e0d2]' : 'bg-[#8b3a52]/25 text-[#f0c5cf]'}`}><AlertCircle className="w-3 h-3" />{label}: {done ? 'зачтён' : 'нет'} · {formatTime(time)}</span>;
}

type OwnerMonitorReport = ReturnType<ReturnType<typeof useLibrary>['ownerChecklistReports']>[number];

function OwnerChecklistSnapshot({ report, onBack }: { report: OwnerMonitorReport; onBack: () => void }) {
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
          <ControlReportCard slot="14:00" status={report.report14} />
          <ControlReportCard slot="18:00" status={report.report18} />
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

function ControlReportCard({ slot, status }: { slot: string; status: ChecklistControlStatus }) {
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

function CallsSection() {
  const { state, addCallChecklistItem, updateCallChecklistItem, deleteCallChecklistItem } = useLibrary();
  const [draft, setDraft] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const save = () => {
    if (!draft.trim()) return;
    if (editingIndex === null) addCallChecklistItem(draft);
    else updateCallChecklistItem(editingIndex, draft);
    setDraft('');
    setEditingIndex(null);
  };
  return (
    <div className="space-y-4">
      <GlassCard>
        <h2 className="text-2xl text-[#f5f3f0] mb-4">Чек-лист звонка</h2>
        <div className="grid md:grid-cols-[1fr_auto] gap-3">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Пункт чек-листа звонка" className="field" />
          <button onClick={save} className="primary-action">{editingIndex === null ? 'Добавить' : 'Сохранить'}</button>
        </div>
        {editingIndex !== null && <button onClick={() => { setEditingIndex(null); setDraft(''); }} className="mt-3 text-sm text-[#a89b8f] hover:text-[#c9a98d]">Отменить редактирование</button>}
      </GlassCard>
      <GlassCard>
      <h2 className="text-2xl text-[#f5f3f0] mb-4">Чек-лист звонка</h2>
      <div className="space-y-2">
        {state.callChecklist.map((item, index) => (
          <div key={`${item}-${index}`} className="flex items-center gap-3 p-3 rounded-lg bg-[#2a2630]/60 text-[#f5f3f0]">
            <span className="flex-1">{item}</span>
            <button onClick={() => { setEditingIndex(index); setDraft(item); }} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${item}`}><Edit2 className="w-4 h-4" /></button>
            <button onClick={() => deleteCallChecklistItem(index)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${item}`}><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </GlassCard>
    </div>
  );
}

function RefundsOverviewSection() {
  const { state, updateRefund } = useLibrary();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ clientName: '', amount: 0, reason: '', status: 'NEW' as RefundStatus, comment: '' });
  const stats = {
    pending: state.refunds.filter((refund) => refund.status === 'NEW' || refund.status === 'IN_PROGRESS').length,
    approved: state.refunds.filter((refund) => refund.status === 'RESOLVED').length,
    totalAmount: state.refunds.reduce((sum, refund) => sum + refund.amount, 0),
  };

  const startEditing = (refund: typeof state.refunds[number]) => {
    setEditingId(refund.id);
    setDraft({
      clientName: refund.clientName,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      comment: refund.comment ?? '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraft({ clientName: '', amount: 0, reason: '', status: 'NEW', comment: '' });
  };

  const saveEditing = () => {
    if (!editingId || !draft.clientName.trim() || !draft.reason.trim()) return;
    updateRefund(editingId, {
      clientName: draft.clientName.trim(),
      amount: draft.amount,
      reason: draft.reason.trim(),
      status: draft.status,
      comment: draft.comment.trim(),
    });
    cancelEditing();
  };

  return (
    <div>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <StatCard value={stats.pending} label="В работе" />
        <StatCard value={stats.approved} label="Решено" />
        <StatCard value={`${stats.totalAmount.toLocaleString('ru-RU')} ₽`} label="Сумма" />
      </div>
      {editingId && (
        <GlassCard className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xl text-[#f5f3f0]">Редактирование возврата</h3>
            <button type="button" onClick={cancelEditing} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label="Отменить редактирование">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={draft.clientName} onChange={(event) => setDraft((value) => ({ ...value, clientName: event.target.value }))} placeholder="Клиент" className="field" />
            <input type="number" value={draft.amount} onChange={(event) => setDraft((value) => ({ ...value, amount: Number(event.target.value) }))} placeholder="Сумма" className="field" />
            <input value={draft.reason} onChange={(event) => setDraft((value) => ({ ...value, reason: event.target.value }))} placeholder="Причина" className="field" />
            <select value={draft.status} onChange={(event) => setDraft((value) => ({ ...value, status: event.target.value as RefundStatus }))} className="field">
              <option value="NEW">Новый</option>
              <option value="IN_PROGRESS">В работе</option>
              <option value="RESOLVED">Решён</option>
              <option value="DECLINED">Отклонён</option>
            </select>
            <textarea value={draft.comment} onChange={(event) => setDraft((value) => ({ ...value, comment: event.target.value }))} placeholder="Комментарий" className="field min-h-20 md:col-span-2" />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={saveEditing} className="primary-action">Сохранить</button>
            <button type="button" onClick={cancelEditing} className="rounded-lg border border-[#c9a98d]/20 px-4 py-2 text-[#f5f3f0] hover:bg-[#2a2630]">Отмена</button>
          </div>
        </GlassCard>
      )}
      <div className="space-y-4">
        {state.refunds.map((refund, idx) => (
          <GlassCard key={refund.id} delay={idx * 0.05}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <DollarSign className="w-5 h-5 text-[#c9a98d] mt-1" />
                <div>
                  <h3 className="text-lg text-[#f5f3f0]">{refund.clientName}</h3>
                  <p className="text-sm text-[#a89b8f]">{refund.amount.toLocaleString('ru-RU')} ₽ · {refund.reason}</p>
                  <p className="text-sm text-[#a89b8f] mt-1">{refund.comment}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <select value={refund.status} onChange={(event) => updateRefund(refund.id, { status: event.target.value as RefundStatus })} className="field max-w-44">
                  <option value="NEW">Новый</option>
                  <option value="IN_PROGRESS">В работе</option>
                  <option value="RESOLVED">Решён</option>
                  <option value="DECLINED">Отклонён</option>
                </select>
                <button type="button" onClick={() => startEditing(refund)} className="rounded-lg border border-[#c9a98d]/20 p-2 text-[#a89b8f] hover:text-[#c9a98d]" aria-label="Редактировать возврат">
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function ManagementSection() {
  const { state, createKnowledge, deleteKnowledge, createTemplate, deleteTemplate, createLink, deleteLink } = useLibrary();

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-3">Информация</h3>
        <button onClick={() => createKnowledge({ title: 'Новая карточка', content: 'Добавьте текст...', role: 'ADMIN', category: 'IMPORTANT_INFO', hashtags: '#важное' })} className="primary-action mb-4">Добавить</button>
        <div className="space-y-2">{state.knowledge.map((entry) => <Row key={entry.id} title={entry.title} onDelete={() => deleteKnowledge(entry.id)} />)}</div>
      </GlassCard>
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-3">Шаблоны</h3>
        <button onClick={() => createTemplate({ title: 'Новый шаблон', body: 'Текст шаблона...', role: 'ADMIN', purpose: 'клиент' })} className="primary-action mb-4">Добавить</button>
        <div className="space-y-2">{state.templates.map((template) => <Row key={template.id} title={template.title} onDelete={() => deleteTemplate(template.id)} />)}</div>
      </GlassCard>
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-3">Ссылки</h3>
        <button onClick={() => createLink({ title: 'Новая ссылка', url: 'https://example.com', role: 'ADMIN', category: 'WORK_TABLE', description: 'Описание' })} className="primary-action mb-4">Добавить</button>
        <div className="space-y-2">{state.links.map((link) => <Row key={link.id} title={link.title} onDelete={() => deleteLink(link.id)} />)}</div>
      </GlassCard>
    </div>
  );
}

function Row({ title, onDelete }: { title: string; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[#2a2630]/60">
      <span className="text-sm text-[#f5f3f0]">{title}</span>
      <button onClick={onDelete} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${title}`}><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <GlassCard>
      <div className="text-center">
        <div className="text-3xl mb-2 text-[#c9a98d]">{value}</div>
        <div className="text-sm text-[#a89b8f]">{label}</div>
      </div>
    </GlassCard>
  );
}
