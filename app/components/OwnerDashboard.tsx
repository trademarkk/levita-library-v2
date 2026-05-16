import { useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { TabNavigation } from './TabNavigation';
import { GlassCard } from './GlassCard';
import { OwnerLinksManager, OwnerRoleContentManager, OwnerTemplatesManager } from './RoleContent';
import { CalendarSection, ExpensesSection, FinancialPlanSection } from './SharedPlanningSections';
import { useLibrary } from '../domain/LibraryContext';
import { employeeStatusLabels, formatDate, formatTime, refundStatusLabels, roleLabels } from '../domain/labels';
import type { ChecklistControlStatus, EmployeeStatus, KnowledgeCategory, RefundStatus, Role } from '../domain/types';
import { AlertCircle, DollarSign, Edit2, FileText, Info, Link as LinkIcon, ListChecks, Plus, Save, Trash2, X } from 'lucide-react';

const tabs = [
  { id: 'team', label: 'Команда' },
  { id: 'financial-plan', label: 'Финансовый план' },
  { id: 'calendar', label: 'Календарь' },
  { id: 'expenses', label: 'Расходы' },
  { id: 'responsibilities', label: 'Обязанности' },
  { id: 'regulations', label: 'Регламенты' },
  { id: 'info', label: 'Важная информация' },
  { id: 'knowledge', label: 'База знаний' },
  { id: 'templates', label: 'Шаблоны сообщений' },
  { id: 'document-templates', label: 'Шаблоны документов' },
  { id: 'links', label: 'Рабочие ссылки и таблицы' },
  { id: 'checklists', label: 'Чек-листы' },
  { id: 'calls', label: 'Чек-лист звонка' },
  { id: 'refunds', label: 'Возвраты' },
];

export function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState('team');
  const { currentUser, state, refreshState } = useLibrary();
  const owner = currentUser?.role === 'OWNER' ? currentUser : state.users.find((user) => user.role === 'OWNER');

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
            if (tab === 'checklists') void refreshState();
          }}
        />

        <div className="max-w-7xl">
          {activeTab === 'team' && <TeamSection />}
          {activeTab === 'financial-plan' && <FinancialPlanSection />}
          {activeTab === 'calendar' && <CalendarSection />}
          {activeTab === 'expenses' && <ExpensesSection />}
          {activeTab === 'responsibilities' && <OwnerRoleContentManager category="RESPONSIBILITY" />}
          {activeTab === 'regulations' && <OwnerRoleContentManager category="REGULATION" />}
          {activeTab === 'info' && <OwnerRoleContentManager category="IMPORTANT_INFO" />}
          {activeTab === 'knowledge' && <OwnerRoleContentManager category="KNOWLEDGE" />}
          {activeTab === 'templates' && <OwnerTemplatesManager />}
          {activeTab === 'document-templates' && <OwnerDocumentTemplatesSection />}
          {activeTab === 'links' && <OwnerLinksManager />}
          {activeTab === 'checklists' && <MonitoringSection />}
          {activeTab === 'calls' && <CallsSection />}
          {activeTab === 'refunds' && <RefundsOverviewSection />}
        </div>
      </div>
    </DashboardLayout>
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
    setDraft({ name: employee.name, email: employee.email, password: employee.password, role: employee.role, status: employee.status });
    setShowModal(true);
  };

  const save = () => {
    if (!draft.name.trim() || !draft.email.trim() || !draft.password.trim()) return;
    if (editingId) updateEmployee(editingId, draft);
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
                <button onClick={() => openEdit(employee)} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${employee.name}`}><Edit2 className="w-4 h-4" /></button>
                {employee.role !== 'OWNER' && <button onClick={() => setDeleteTargetId(employee.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${employee.name}`}><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-[#0f0e12]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-xl">
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
        <div className="fixed inset-0 z-50 bg-[#0f0e12]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md">
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
          <GlassCard key={template.id} delay={idx * 0.06}>
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

function MonitoringSection() {
  const { ownerChecklistReports, refreshState } = useLibrary();
  const reports = ownerChecklistReports();
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const selectedReport = reports.find((report) => report.assignee.id === selectedAssigneeId) ?? null;
  const grouped = reports.reduce<Record<string, typeof reports>>((acc, report) => {
    const date = new Date(report.checklist.date);
    const key = Number.isNaN(date.getTime()) ? 'unknown-date' : date.toISOString().slice(0, 10);
    acc[key] = [...(acc[key] ?? []), report];
    return acc;
  }, {});

  if (selectedReport) {
    return <OwnerChecklistSnapshot report={selectedReport} onBack={() => setSelectedAssigneeId(null)} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl text-[#f5f3f0]">Контроль чек-листов администраторов</h2>
        <p className="text-[#a89b8f] mt-2">Показываются только администраторы и старшие администраторы.</p>
      </div>
      <button onClick={() => void refreshState()} className="px-4 py-2 rounded-lg border border-[#c9a98d]/20 text-[#f5f3f0] hover:bg-[#2a2630] w-fit">
        Обновить из базы
      </button>
      {reports.length === 0 && (
        <GlassCard>
          <p className="text-[#a89b8f]">Пока нет чек-листов администраторов для контроля.</p>
        </GlassCard>
      )}
      {Object.entries(grouped).map(([dateKey, items]) => (
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
                  <button onClick={() => setSelectedAssigneeId(report.assignee.id)} className="px-4 py-2 rounded-lg bg-[#c9a98d]/20 text-[#c9a98d] hover:bg-[#c9a98d]/30 w-fit">
                    Открыть чек-лист
                  </button>
                  <div className="grid xl:grid-cols-3 gap-3">
                    <ControlReportCard slot="14:00" status={report.report14} />
                    <ControlReportCard slot="18:00" status={report.report18} />
                    <ControlReportCard slot="22:00" status={report.report22} />
                  </div>
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
        <div className="grid xl:grid-cols-3 gap-3 mb-6">
          <ControlReportCard slot="14:00" status={report.report14} />
          <ControlReportCard slot="18:00" status={report.report18} />
          <ControlReportCard slot="22:00" status={report.report22} />
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
  const telegram = !status.telegramSent ? 'не отправлен' : status.telegramOnTime ? 'отправлен вовремя' : 'отправлен поздно';

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-[#f5f3f0]">Отчет {slot}</h4>
        <span className={`text-xs px-2 py-1 rounded-full ${status.submitted && status.onTime ? 'bg-[#5e6d58]/35 text-[#d8e0d2]' : 'bg-[#8b3a52]/25 text-[#f0c5cf]'}`}>{submission}</span>
      </div>
      <p className="text-xs text-[#a89b8f] mb-3">{status.label}</p>
      <div className="space-y-1 text-sm text-[#d8d1c8]">
        <p>Сдача: {formatTime(status.completedAt)}</p>
        <p>Telegram: {telegram}{status.telegramSentAt ? ` · ${formatTime(status.telegramSentAt)}` : ''}</p>
      </div>
    </div>
  );
}

function CallsSection() {
  const { state } = useLibrary();
  return (
    <GlassCard>
      <h2 className="text-2xl text-[#f5f3f0] mb-4">Чек-лист звонка</h2>
      <div className="space-y-2">
        {state.callChecklist.map((item) => <div key={item} className="p-3 rounded-lg bg-[#2a2630]/60 text-[#f5f3f0]">{item}</div>)}
      </div>
    </GlassCard>
  );
}

function RefundsOverviewSection() {
  const { state, updateRefund } = useLibrary();
  const stats = {
    pending: state.refunds.filter((refund) => refund.status === 'NEW' || refund.status === 'IN_PROGRESS').length,
    approved: state.refunds.filter((refund) => refund.status === 'RESOLVED').length,
    totalAmount: state.refunds.reduce((sum, refund) => sum + refund.amount, 0),
  };

  return (
    <div>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <StatCard value={stats.pending} label="В работе" />
        <StatCard value={stats.approved} label="Решено" />
        <StatCard value={`${stats.totalAmount.toLocaleString('ru-RU')} ₽`} label="Сумма" />
      </div>
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
              <select value={refund.status} onChange={(event) => updateRefund(refund.id, { status: event.target.value as RefundStatus })} className="field max-w-44">
                <option value="NEW">Новый</option>
                <option value="IN_PROGRESS">В работе</option>
                <option value="RESOLVED">Решён</option>
                <option value="DECLINED">Отклонён</option>
              </select>
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
