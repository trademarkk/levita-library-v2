import { useEffect, useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { TabNavigation } from './TabNavigation';
import { GlassCard } from './GlassCard';
import { ConfirmChecklistDialog } from './ConfirmChecklistDialog';
import { RoleContentViewer, RoleLinksViewer, RoleTemplatesViewer } from './RoleContent';
import { useLibrary } from '../domain/LibraryContext';
import { formatDate, formatTime, refundStatusLabels, reportSlotLabels, roleLabels, studioLabels } from '../domain/labels';
import type { ChecklistReport, KnowledgeCategory, RefundStatus, Role, Studio } from '../domain/types';
import { BookOpen, DollarSign, Edit2, FileText, Info, Link as LinkIcon, ListChecks, Phone, Plus, Save, Shield, Trash2, X } from 'lucide-react';

const adminTabs = [
  { id: 'responsibilities', label: 'Обязанности' },
  { id: 'regulations', label: 'Регламенты' },
  { id: 'info', label: 'Важная информация' },
  { id: 'knowledge', label: 'База знаний' },
  { id: 'templates', label: 'Шаблоны сообщений' },
  { id: 'links', label: 'Рабочие ссылки и таблицы' },
  { id: 'checklist', label: 'Чек-лист дня' },
  { id: 'calls', label: 'Чек-лист звонка' },
];

export function SeniorAdminDashboard() {
  return <AdminWorkspace role="SENIOR_ADMIN" canManageRefunds />;
}

export function AdminDashboard() {
  return <AdminWorkspace role="ADMIN" />;
}

function AdminWorkspace({ role, canManageTemplates = false, canManageLinks = false, canManageRefunds = false }: { role: 'ADMIN' | 'SENIOR_ADMIN'; canManageTemplates?: boolean; canManageLinks?: boolean; canManageRefunds?: boolean }) {
  const [activeTab, setActiveTab] = useState('responsibilities');
  const { currentUser, state, activeAdminShift } = useLibrary();
  const user = currentUser?.role === role ? currentUser : state.users.find((item) => item.role === role);
  const tabs = canManageRefunds ? [...adminTabs, { id: 'refunds', label: 'Возвраты' }] : adminTabs;
  const shift = user ? activeAdminShift(user.id) : null;

  return (
    <DashboardLayout role={role} userName={user?.name ?? roleLabels[role]}>
      <div className="p-6 lg:p-10">
        <div className="mb-10">
          <h1 className="text-4xl lg:text-5xl mb-3 text-[#f5f3f0]">Кабинет: {roleLabels[role]}</h1>
          <p className="text-[#a89b8f]">Регламенты, база знаний, чек-лист смены, звонки и рабочие таблицы.</p>
        </div>

        {!shift ? (
          <ShiftStartGate role={role} selectedUserId={user?.id ?? ''} />
        ) : (
          <>
            <GlassCard className="mb-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-[#a89b8f]">Смена открыта</p>
                  <p className="text-lg text-[#f5f3f0]">{shift.adminName} · {studioLabels[shift.studio]}</p>
                </div>
                <div className="text-sm text-[#a89b8f]">
                  MAX-напоминания: {shift.remindersScheduledAt ? 'запланированы' : shift.reminderScheduleError ? 'ошибка' : 'ожидают постановки'}
                </div>
              </div>
              {shift.reminderScheduleError && <p className="mt-3 text-sm text-[#f0c5cf]">{shift.reminderScheduleError}</p>}
            </GlassCard>

            <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="max-w-7xl">
              {activeTab === 'responsibilities' && <RoleContentViewer role={role} category="RESPONSIBILITY" />}
              {activeTab === 'regulations' && <RoleContentViewer role={role} category="REGULATION" />}
              {activeTab === 'info' && <RoleContentViewer role={role} category="IMPORTANT_INFO" />}
              {activeTab === 'knowledge' && <RoleContentViewer role={role} category="KNOWLEDGE" />}
              {activeTab === 'templates' && <RoleTemplatesViewer role={role} />}
              {activeTab === 'links' && <RoleLinksViewer role={role} />}
              {activeTab === 'checklist' && <ChecklistSection userId={user?.id ?? ''} shiftStudio={shift.studio} />}
              {activeTab === 'calls' && <CallsSection />}
              {activeTab === 'refunds' && canManageRefunds && <RefundsSection />}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function ShiftStartGate({ role, selectedUserId }: { role: 'ADMIN' | 'SENIOR_ADMIN'; selectedUserId: string }) {
  const { state, startAdminShift } = useLibrary();
  const users = state.users.filter((item) => item.role === role && item.status === 'active');
  const [userId, setUserId] = useState(selectedUserId || users[0]?.id || '');
  const [studio, setStudio] = useState<Studio>('STAVROPOLSKAYA');
  const [isStarting, setIsStarting] = useState(false);
  const selectedUser = users.find((item) => item.id === userId) ?? null;

  useEffect(() => {
    const fallbackUserId = selectedUserId || users[0]?.id || '';
    if (!userId && fallbackUserId) setUserId(fallbackUserId);
  }, [selectedUserId, userId, users]);

  const start = async () => {
    if (!selectedUser || isStarting) return;
    setIsStarting(true);
    try {
      await startAdminShift({ userId: selectedUser.id, adminName: selectedUser.name, studio });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <GlassCard className="max-w-3xl">
      <div className="flex items-start gap-4">
        <Shield className="mt-1 h-6 w-6 shrink-0 text-[#c9a98d]" />
        <div className="flex-1">
          <h2 className="text-2xl text-[#f5f3f0]">Перед началом смены</h2>
          <p className="mt-2 text-[#a89b8f]">
            Выберите администратора и студию. Без отметки смены кабинет и рабочие действия недоступны.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-[#a89b8f]">
              Администратор
              <select value={userId} onChange={(event) => setUserId(event.target.value)} className="field mt-2">
                {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-[#a89b8f]">
              Студия
              <select value={studio} onChange={(event) => setStudio(event.target.value as Studio)} className="field mt-2">
                <option value="STAVROPOLSKAYA">{studioLabels.STAVROPOLSKAYA}</option>
                <option value="MACHUGI">{studioLabels.MACHUGI}</option>
              </select>
            </label>
          </div>
          <button onClick={start} disabled={!selectedUser || isStarting} className="primary-action mt-6 disabled:cursor-not-allowed disabled:opacity-50">
            {isStarting ? 'Открываем смену...' : 'Я на смене'}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function KnowledgeSection({ category }: { category: KnowledgeCategory }) {
  const { state } = useLibrary();
  const entries = state.knowledge.filter((entry) => entry.category === category && ['ADMIN', 'SENIOR_ADMIN'].includes(entry.role));
  const Icon = category === 'RESPONSIBILITY' || category === 'REGULATION' ? Shield : category === 'KNOWLEDGE' ? BookOpen : Info;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {entries.map((entry, idx) => (
        <GlassCard key={entry.id} delay={idx * 0.08}>
          <div className="flex items-start gap-3 mb-3">
            <Icon className="w-5 h-5 text-[#c9a98d] mt-1" />
            <h3 className="text-xl text-[#f5f3f0]">{entry.title}</h3>
          </div>
          <p className="text-[#a89b8f] leading-relaxed">{entry.content}</p>
          {entry.hashtags && <p className="text-xs text-[#c9a98d] mt-4">{entry.hashtags}</p>}
        </GlassCard>
      ))}
      {entries.length === 0 && <GlassCard><p className="text-[#a89b8f]">Материалы для этой вкладки пока не добавлены.</p></GlassCard>}
    </div>
  );
}

function TemplatesSection({ editable }: { editable: boolean }) {
  const { state, createTemplate, deleteTemplate } = useLibrary();
  const templates = state.templates.filter((template) => template.role === 'ADMIN' || template.role === 'SENIOR_ADMIN');

  return (
    <div className="space-y-4">
      {editable && (
        <button onClick={() => createTemplate({ title: 'Новый шаблон сообщения', body: 'Введите текст сообщения...', role: 'ADMIN', purpose: 'клиент' })} className="flex items-center gap-2 px-4 py-2 bg-[#c9a98d]/20 text-[#c9a98d] rounded-lg hover:bg-[#c9a98d]/30 transition-all duration-300">
          <Plus className="w-4 h-4" />
          Добавить шаблон
        </button>
      )}
      {templates.map((template, idx) => (
        <GlassCard key={template.id} delay={idx * 0.08}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg text-[#f5f3f0]">{template.title}</h3>
              <p className="text-xs text-[#c9a98d] mt-1">{template.purpose}</p>
              <p className="text-sm text-[#a89b8f] mt-3">{template.body}</p>
            </div>
            {editable && <button onClick={() => deleteTemplate(template.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${template.title}`}><Trash2 className="w-4 h-4" /></button>}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function LinksSection({ editable }: { editable: boolean }) {
  const { state, createLink, updateLink, deleteLink } = useLibrary();
  const [draft, setDraft] = useState({ title: '', url: '', description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const links = state.links.filter((link) => link.role === 'ADMIN' || link.role === 'SENIOR_ADMIN');

  const saveEdit = () => {
    if (!editingId) return;
    updateLink(editingId, draft);
    setEditingId(null);
    setDraft({ title: '', url: '', description: '' });
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {editable && (
        <GlassCard>
          <h3 className="text-xl text-[#f5f3f0] mb-4">{editingId ? 'Редактировать ссылку' : 'Добавить ссылку'}</h3>
          <div className="space-y-3">
            <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Название" className="field" />
            <input value={draft.url} onChange={(event) => setDraft((value) => ({ ...value, url: event.target.value }))} placeholder="https://..." className="field" />
            <textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Описание" className="field min-h-20" />
            <button onClick={() => editingId ? saveEdit() : (createLink({ ...draft, role: 'ADMIN', category: 'WORK_TABLE' }), setDraft({ title: '', url: '', description: '' }))} className="primary-action">Сохранить</button>
          </div>
        </GlassCard>
      )}
      {links.map((link, idx) => (
        <GlassCard key={link.id} delay={idx * 0.08}>
          <div className="flex items-start gap-3">
            <LinkIcon className="w-5 h-5 text-[#c9a98d] mt-1" />
            <div className="flex-1">
              <h3 className="text-[#f5f3f0] mb-1">{link.title}</h3>
              <a href={link.url} className="text-sm text-[#a89b8f] hover:text-[#c9a98d] break-all">{link.url}</a>
              <p className="text-sm text-[#a89b8f] mt-2">{link.description}</p>
            </div>
            {editable && (
              <div className="flex gap-2">
                <button onClick={() => (setEditingId(link.id), setDraft({ title: link.title, url: link.url, description: link.description ?? '' }))} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${link.title}`}><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => deleteLink(link.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${link.title}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function ChecklistSection({ userId, shiftStudio }: { userId: string; shiftStudio: Studio }) {
  const { checklistForUser, toggleChecklistItem, updateChecklistReport } = useLibrary();
  const checklist = checklistForUser(userId);
  const [reportDrafts, setReportDrafts] = useState<Record<string, Partial<ChecklistReport>>>({});
  const [confirmItemId, setConfirmItemId] = useState<string | null>(null);

  if (!checklist) return <GlassCard><p className="text-[#a89b8f]">Чек-лист пока не создан.</p></GlassCard>;

  const completedCount = checklist.items.filter((item) => item.completed).length;
  const confirmItem = checklist.items.find((item) => item.id === confirmItemId) ?? null;

  const setReportField = (slot: string, key: keyof ChecklistReport, value: string) => {
    setReportDrafts((current) => ({ ...current, [slot]: { ...current[slot], [key]: value } }));
  };

  const setReportStudio = (slot: string, studio: Studio) => {
    setReportDrafts((current) => ({ ...current, [slot]: { ...current[slot], studio } }));
  };

  return (
    <div className="space-y-5">
      <GlassCard>
        <div className="flex items-center gap-3 mb-6">
          <ListChecks className="w-6 h-6 text-[#c9a98d]" />
          <div>
            <h2 className="text-2xl text-[#f5f3f0]">{checklist.title}</h2>
            <p className="text-sm text-[#a89b8f]">{formatDate(checklist.date)} · {completedCount} из {checklist.items.length}</p>
          </div>
        </div>
        <div className="space-y-3">
          {checklist.items.map((item) => (
            <label key={item.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a2630] transition-colors">
              <input type="checkbox" checked={item.completed} onChange={() => item.completed ? toggleChecklistItem(checklist.id, item.id, userId) : setConfirmItemId(item.id)} className="w-5 h-5 rounded accent-[#c9a98d]" />
              <span className={`flex-1 ${item.completed ? 'text-[#a89b8f] line-through' : 'text-[#f5f3f0]'}`}>{item.label}</span>
              <span className="text-xs text-[#a89b8f]">{formatTime(item.completedAt)}</span>
            </label>
          ))}
        </div>
      </GlassCard>

      <div className="grid xl:grid-cols-3 gap-4">
        {checklist.reports.map((report) => {
          const draft = { ...report, studio: report.studio ?? shiftStudio, ...reportDrafts[report.slot] };
          return (
            <GlassCard key={report.slot}>
              <h3 className="text-lg text-[#f5f3f0] mb-1">{reportSlotLabels[report.slot]}</h3>
              <p className="text-xs text-[#a89b8f] mb-4">Последняя отправка: {formatTime(report.submittedAt)}</p>
              <div className="space-y-2">
                <label className="grid grid-cols-[110px_1fr] items-center gap-2 text-sm text-[#a89b8f]">
                  <span>Студия:</span>
                  <select
                    value={draft.studio ?? shiftStudio}
                    onChange={(event) => setReportStudio(report.slot, event.target.value as Studio)}
                    className="field py-1.5"
                  >
                    <option value="STAVROPOLSKAYA">{studioLabels.STAVROPOLSKAYA}</option>
                    <option value="MACHUGI">{studioLabels.MACHUGI}</option>
                  </select>
                </label>
                <ReportInput label="Имя администратора" value={draft.adminName ?? ''} onChange={(value) => setReportField(report.slot, 'adminName', value)} />
                <ReportInput label="Звонки" value={draft.calls ?? ''} onChange={(value) => setReportField(report.slot, 'calls', value)} />
                <ReportInput label="Дозвоны" value={draft.reached ?? ''} onChange={(value) => setReportField(report.slot, 'reached', value)} />
                <ReportInput label="Записи" value={draft.bookings ?? ''} onChange={(value) => setReportField(report.slot, 'bookings', value)} />
                <ReportInput label="Касса" value={draft.cash ?? ''} onChange={(value) => setReportField(report.slot, 'cash', value)} />
                <ReportInput label="Был" value={draft.came ?? ''} onChange={(value) => setReportField(report.slot, 'came', value)} />
                <ReportInput label="Купил" value={draft.bought ?? ''} onChange={(value) => setReportField(report.slot, 'bought', value)} />
                <button onClick={() => updateChecklistReport(checklist.id, report.slot, draft)} className="primary-action w-full">Сохранить отчёт</button>
                {report.maxSentAt && <p className="text-xs text-[#a89b8f]">MAX отправлен: {formatTime(report.maxSentAt)}</p>}
                {report.maxSendError && <p className="text-xs text-[#f0c5cf]">Ошибка MAX: {report.maxSendError}</p>}
              </div>
            </GlassCard>
          );
        })}
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
    </div>
  );
}

function ReportInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid grid-cols-[110px_1fr] items-center gap-2 text-sm text-[#a89b8f]">
      <span>{label}:</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="field py-1.5" />
    </label>
  );
}

function RefundsSection() {
  const { state, createRefund, updateRefund } = useLibrary();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ clientName: '', amount: 0, reason: '', status: 'NEW' as RefundStatus, comment: '' });

  const save = () => {
    if (editingId) updateRefund(editingId, draft);
    else createRefund(draft);
    setEditingId(null);
    setDraft({ clientName: '', amount: 0, reason: '', status: 'NEW', comment: '' });
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-4">{editingId ? 'Редактировать возврат' : 'Новая карточка возврата'}</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <input value={draft.clientName} onChange={(event) => setDraft((value) => ({ ...value, clientName: event.target.value }))} placeholder="Клиент" className="field" />
          <input type="number" value={draft.amount} onChange={(event) => setDraft((value) => ({ ...value, amount: Number(event.target.value) }))} placeholder="Сумма" className="field" />
          <input value={draft.reason} onChange={(event) => setDraft((value) => ({ ...value, reason: event.target.value }))} placeholder="Причина" className="field" />
          <select value={draft.status} onChange={(event) => setDraft((value) => ({ ...value, status: event.target.value as RefundStatus }))} className="field">
            <option value="NEW">Новый</option>
            <option value="IN_PROGRESS">В работе</option>
            <option value="RESOLVED">Решён</option>
            <option value="DECLINED">Отклонён</option>
          </select>
          <textarea value={draft.comment} onChange={(event) => setDraft((value) => ({ ...value, comment: event.target.value }))} placeholder="Комментарий" className="field md:col-span-2 min-h-20" />
        </div>
        <button onClick={save} className="primary-action mt-3">Сохранить</button>
      </GlassCard>

      {state.refunds.map((refund, idx) => (
        <GlassCard key={refund.id} delay={idx * 0.08}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-5 h-5 text-[#c9a98d]" />
                <h3 className="text-lg text-[#f5f3f0]">{refund.clientName}</h3>
                <span className="text-xs px-2 py-1 rounded bg-[#c9a98d]/20 text-[#c9a98d]">{refundStatusLabels[refund.status]}</span>
              </div>
              <p className="text-sm text-[#a89b8f]">{refund.amount.toLocaleString('ru-RU')} ₽ · {formatDate(refund.requestedAt)} · {refund.reason}</p>
              <p className="text-sm text-[#a89b8f] mt-2">{refund.comment}</p>
            </div>
            <button onClick={() => (setEditingId(refund.id), setDraft({ clientName: refund.clientName, amount: refund.amount, reason: refund.reason, status: refund.status, comment: refund.comment ?? '' }))} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label="Редактировать возврат"><Edit2 className="w-4 h-4" /></button>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function CallsSection() {
  const { state } = useLibrary();
  const [completed, setCompleted] = useState<string[]>([]);

  return (
    <GlassCard>
      <div className="flex items-center gap-3 mb-6">
        <Phone className="w-6 h-6 text-[#c9a98d]" />
        <h2 className="text-2xl text-[#f5f3f0]">Чек-лист звонка</h2>
      </div>
      <div className="space-y-3">
        {state.callChecklist.map((topic) => (
          <label key={topic} className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#2a2630] transition-colors">
            <input type="checkbox" checked={completed.includes(topic)} onChange={() => setCompleted((items) => items.includes(topic) ? items.filter((item) => item !== topic) : [...items, topic])} className="w-5 h-5 rounded accent-[#c9a98d]" />
            <span className={completed.includes(topic) ? 'text-[#a89b8f] line-through' : 'text-[#f5f3f0]'}>{topic}</span>
          </label>
        ))}
      </div>
    </GlassCard>
  );
}
