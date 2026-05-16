import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Download, ExternalLink, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { TabNavigation } from './TabNavigation';
import { useLibrary } from '../domain/LibraryContext';
import { formatDate } from '../domain/labels';
import type { CalendarEvent, ExpenseAccount, ExpenseRecord, ExpenseStudio } from '../domain/types';

const accountLabels: Record<ExpenseAccount, string> = {
  RS_SBER: 'РС Сбер',
  TOCHKA: 'Точка',
  CREDIT: 'Кредитные',
};

const studioLabels: Record<ExpenseStudio, string> = {
  STAVROPOLSKAYA: 'Ставропольская',
  MACHUGI: 'Мачуги',
};

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysInMonth(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const daysCount = new Date(year, monthIndex, 0).getDate();
  return Array.from({ length: daysCount }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
}

function addMonths(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  const date = new Date(year, monthIndex - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonthStart(month: string) {
  return `${addMonths(month, 1)}-01`;
}

function monthTitle(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function calendarCells(month: string) {
  const days = daysInMonth(month);
  const [year, monthIndex] = month.split('-').map(Number);
  const firstDay = new Date(year, monthIndex - 1, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const cells = [...Array.from({ length: startOffset }, () => null as string | null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function sameMonth(date: string, month: string) {
  return date.startsWith(month);
}

function formatPlanDay(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const weekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} (${weekdays[date.getDay()]})`;
}

function money(value: number) {
  return value.toLocaleString('ru-RU') + ' ₽';
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downloadExcel(filename: string, rows: Array<Array<string | number>>) {
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('')}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function FinancialPlanSection() {
  const { state, addFinancialPlanRow, updateFinancialPlanRow, deleteFinancialPlanRow, updateFinancialPlanCell } = useLibrary();
  const [month, setMonth] = useState(currentMonthKey());
  const [newTitle, setNewTitle] = useState('');
  const plan = state.financialPlans.find((item) => item.month === month);
  const days = useMemo(() => daysInMonth(month), [month]);

  const addRow = () => {
    addFinancialPlanRow(month, newTitle);
    setNewTitle('');
  };

  return (
    <div className="space-y-5">
      <GlassCard>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl text-[#f5f3f0]">Финансовый план</h2>
            <p className="text-sm text-[#a89b8f] mt-1">Общая таблица ассистента и руководителя. Данные сохраняются отдельно по каждому месяцу.</p>
          </div>
          <label className="text-sm text-[#a89b8f]">
            Месяц
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="field mt-2 max-w-56" />
          </label>
        </div>
        <div className="mt-5 grid md:grid-cols-[1fr_auto] gap-3">
          <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Название платежа" className="field" />
          <button onClick={addRow} className="primary-action flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Добавить платеж</button>
        </div>
      </GlassCard>

      <div className="financial-table-card">
        <div className="financial-table-scroll">
          <table className="financial-table">
            <thead>
              <tr>
                <th className="financial-sticky-cell financial-table-head text-left min-w-64">Платеж</th>
                {days.map((day) => (
                  <th key={day} className="financial-table-head min-w-28">{formatPlanDay(day)}</th>
                ))}
                <th className="financial-table-head min-w-12"> </th>
              </tr>
            </thead>
            <tbody>
              {(plan?.rows ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="financial-sticky-cell financial-table-cell">
                    <input value={row.title} onChange={(event) => updateFinancialPlanRow(month, row.id, event.target.value)} className="field min-w-56" />
                  </td>
                  {days.map((day) => (
                    <td key={day} className="financial-table-cell">
                      <input value={row.payments[day] ?? ''} onChange={(event) => updateFinancialPlanCell(month, row.id, day, event.target.value)} className="field px-2 py-1 text-sm text-center" placeholder="₽" />
                    </td>
                  ))}
                  <td className="financial-table-cell text-center">
                    <button onClick={() => deleteFinancialPlanRow(month, row.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${row.title}`}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {(plan?.rows ?? []).length === 0 && (
                <tr><td colSpan={days.length + 2} className="p-6 text-center text-[#a89b8f]">Для выбранного месяца платежи пока не добавлены.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function CalendarSection() {
  const { state, googleCalendarStatus, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, refreshGoogleCalendarStatus, connectGoogleCalendar, importGoogleCalendarEvents, syncCalendarEventToGoogle } = useLibrary();
  const [month, setMonth] = useState(currentMonthKey());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [draft, setDraft] = useState({ title: '', date: todayKey(), description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: '', date: todayKey(), description: '' });
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importedMonthsRef = useRef<Set<string>>(new Set());
  const cells = useMemo(() => calendarCells(month), [month]);
  const monthEvents = useMemo(
    () => [...state.calendarEvents]
      .filter((event) => sameMonth(event.date, month))
      .sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title)),
    [month, state.calendarEvents],
  );
  const eventsByDate = useMemo(() => monthEvents.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    acc[event.date] = [...(acc[event.date] ?? []), event];
    return acc;
  }, {}), [monthEvents]);
  const selectedEvents = eventsByDate[selectedDate] ?? [];
  const editingEvent = editingId ? state.calendarEvents.find((event) => event.id === editingId) ?? null : null;

  useEffect(() => {
    void refreshGoogleCalendarStatus();
  }, []);

  useEffect(() => {
    if (!sameMonth(selectedDate, month)) setSelectedDate(`${month}-01`);
  }, [month, selectedDate]);

  const save = () => {
    if (!draft.title.trim() || !draft.date) return;
    createCalendarEvent(draft);
    setDraft({ title: '', date: todayKey(), description: '' });
  };

  const importFromGoogle = async (targetMonth = month) => {
    setIsImporting(true);
    setImportError(null);
    try {
      await importGoogleCalendarEvents(`${targetMonth}-01`, nextMonthStart(targetMonth));
      importedMonthsRef.current.add(targetMonth);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Не удалось загрузить события Google.');
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    if (!editingEvent) return;
    setEditDraft({
      title: editingEvent.title,
      date: editingEvent.date,
      description: editingEvent.description ?? '',
    });
  }, [editingEvent?.id]);

  useEffect(() => {
    if (!googleCalendarStatus?.connected) return;
    if (importedMonthsRef.current.has(month)) return;
    void importFromGoogle(month);
  }, [googleCalendarStatus?.connected, month]);

  const openEvent = (event: CalendarEvent) => {
    setEditingId(event.id);
  };

  const saveEditing = () => {
    if (!editingEvent || !editDraft.title.trim() || !editDraft.date) return;
    updateCalendarEvent(editingEvent.id, {
      title: editDraft.title,
      date: editDraft.date,
      description: editDraft.description,
    });
    setEditingId(null);
  };

  const moveEvent = (id: string, date: string) => {
    updateCalendarEvent(id, { date });
    setSelectedDate(date);
  };

  return (
    <div className="space-y-5">
      <GlassCard>
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-[#c9a98d]" />
          <div>
            <h2 className="text-2xl text-[#f5f3f0]">Календарь</h2>
            <p className="text-sm text-[#a89b8f]">Общий календарь ассистента и руководителя. Важные задачи с флагом добавляются сюда автоматически.</p>
          </div>
          </div>
          <div className="rounded-xl border border-[#c9a98d]/15 bg-[#2a2630]/45 p-3 text-sm min-w-72">
            <p className="text-[#f5f3f0]">Google Calendar</p>
            <p className="mt-1 text-xs text-[#a89b8f]">
              {!googleCalendarStatus && 'Проверяем подключение...'}
              {googleCalendarStatus && !googleCalendarStatus.configured && 'Не настроены GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.'}
              {googleCalendarStatus?.configured && !googleCalendarStatus.connected && 'Настроен, но еще не подключен.'}
              {googleCalendarStatus?.connected && `Подключен: ${googleCalendarStatus.calendarId}`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={connectGoogleCalendar} disabled={googleCalendarStatus ? !googleCalendarStatus.configured : true} className="rounded-lg border border-[#c9a98d]/25 px-3 py-1 text-xs text-[#c9a98d] disabled:opacity-50">
                Подключить
              </button>
              <button onClick={() => void refreshGoogleCalendarStatus()} className="rounded-lg border border-[#c9a98d]/25 px-3 py-1 text-xs text-[#a89b8f] hover:text-[#c9a98d]">
                Обновить статус
              </button>
              <button onClick={() => void importFromGoogle()} disabled={!googleCalendarStatus?.connected || isImporting} className="rounded-lg border border-[#c9a98d]/25 px-3 py-1 text-xs text-[#a89b8f] hover:text-[#c9a98d] disabled:opacity-50">
                {isImporting ? 'Загружаем...' : 'Обновить события'}
              </button>
            </div>
          </div>
        </div>
        {googleCalendarStatus?.connected && !isImporting && importedMonthsRef.current.has(month) && (
          <p className="mb-4 text-xs text-[#a89b8f]">События Google за выбранный месяц загружены.</p>
        )}
        {importError && <p className="mb-4 text-sm text-[#f0c5cf]">{importError}</p>}
        <div className="grid md:grid-cols-[1.2fr_180px] gap-3">
          <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Событие" className="field" />
          <input type="date" value={draft.date} onChange={(event) => setDraft((value) => ({ ...value, date: event.target.value }))} className="field" />
          <textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Комментарий" className="field md:col-span-2 min-h-20" />
        </div>
        <button onClick={save} className="primary-action mt-4 flex items-center gap-2"><Save className="w-4 h-4" />Сохранить событие</button>
      </GlassCard>

      <div className="calendar-shell">
        <div className="calendar-toolbar">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#c9a98d]">Календарная сетка</p>
            <h3 className="text-2xl text-[#f5f3f0] capitalize">{monthTitle(month)}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setMonth(addMonths(month, -1))} className="calendar-icon-button" aria-label="Предыдущий месяц"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => (setMonth(currentMonthKey()), setSelectedDate(todayKey()))} className="calendar-soft-button">Сегодня</button>
            <button onClick={() => setMonth(addMonths(month, 1))} className="calendar-icon-button" aria-label="Следующий месяц"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="calendar-grid">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => <div key={day} className="calendar-weekday">{day}</div>)}
          {cells.map((date, index) => {
            const dayEvents = date ? eventsByDate[date] ?? [] : [];
            const isSelected = date === selectedDate;
            const isToday = date === todayKey();
            return (
              <button
                key={date ?? `blank-${index}`}
                type="button"
                disabled={!date}
                onClick={() => date && setSelectedDate(date)}
                onDragOver={(event) => date && event.preventDefault()}
                onDrop={(event) => {
                  const id = event.dataTransfer.getData('text/calendar-event-id');
                  if (date && id) moveEvent(id, date);
                }}
                className={`calendar-day ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
              >
                {date && (
                  <>
                    <span className="calendar-day-number">{Number(date.slice(-2))}</span>
                    <span className="calendar-day-events">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          draggable
                          onClick={(mouseEvent) => (mouseEvent.stopPropagation(), openEvent(event))}
                          onDragStart={(dragEvent) => dragEvent.dataTransfer.setData('text/calendar-event-id', event.id)}
                          className={`calendar-event-chip ${event.sourceTaskId ? 'is-task' : event.source === 'google' ? 'is-google' : ''}`}
                        >
                          {event.title}
                        </span>
                      ))}
                      {dayEvents.length > 3 && <span className="calendar-more">+{dayEvents.length - 3}</span>}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-4">
        <GlassCard>
          <p className="text-xs text-[#c9a98d]">{formatDate(selectedDate)}</p>
          <h3 className="mt-1 text-xl text-[#f5f3f0]">События выбранного дня</h3>
          <div className="mt-4 space-y-3">
            {selectedEvents.map((event) => (
              <CalendarEventCard
                key={event.id}
                event={event}
                onEdit={() => openEvent(event)}
                onSync={() => void syncCalendarEventToGoogle(event.id)}
                onDelete={() => deleteCalendarEvent(event.id)}
              />
            ))}
            {selectedEvents.length === 0 && <p className="rounded-lg bg-[#2a2630]/45 p-4 text-sm text-[#a89b8f]">На эту дату событий пока нет.</p>}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[#c9a98d]">Месяц</p>
              <h3 className="text-xl text-[#f5f3f0]">Все события</h3>
            </div>
            <span className="rounded-full bg-[#c9a98d]/15 px-3 py-1 text-xs text-[#c9a98d]">{monthEvents.length}</span>
          </div>
          <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-2">
            {monthEvents.map((event) => (
              <CalendarEventCard
                key={event.id}
                event={event}
                onEdit={() => openEvent(event)}
                onSync={() => void syncCalendarEventToGoogle(event.id)}
                onDelete={() => deleteCalendarEvent(event.id)}
              />
            ))}
            {monthEvents.length === 0 && <p className="rounded-lg bg-[#2a2630]/45 p-4 text-sm text-[#a89b8f]">В этом месяце событий пока нет.</p>}
          </div>
        </GlassCard>
      </div>

      {editingEvent && (
        <div className="calendar-modal-backdrop" role="dialog" aria-modal="true">
          <div className="calendar-modal">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-[#c9a98d]">Редактирование события</p>
                <h3 className="text-2xl text-[#f5f3f0]">{editingEvent.title}</h3>
              </div>
              <button onClick={() => setEditingId(null)} className="calendar-icon-button" aria-label="Закрыть"><X className="w-4 h-4" /></button>
            </div>
            <div className="mt-5 grid gap-3">
              <input value={editDraft.title} onChange={(event) => setEditDraft((value) => ({ ...value, title: event.target.value }))} className="field" />
              <input type="date" value={editDraft.date} onChange={(event) => setEditDraft((value) => ({ ...value, date: event.target.value }))} className="field" />
              <textarea value={editDraft.description} onChange={(event) => setEditDraft((value) => ({ ...value, description: event.target.value }))} className="field min-h-28" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={saveEditing} className="primary-action flex items-center gap-2"><Save className="w-4 h-4" />Сохранить и отправить</button>
              <button onClick={() => void syncCalendarEventToGoogle(editingEvent.id)} className="calendar-soft-button inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" />Синхронизировать</button>
              {editingEvent.googleHtmlLink && <a href={editingEvent.googleHtmlLink} target="_blank" rel="noreferrer" className="calendar-soft-button inline-flex items-center gap-2"><ExternalLink className="w-4 h-4" />Открыть в Google</a>}
              <button onClick={() => (deleteCalendarEvent(editingEvent.id), setEditingId(null))} className="calendar-danger-button inline-flex items-center gap-2"><Trash2 className="w-4 h-4" />Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarEventCard({ event, onEdit, onSync, onDelete }: { event: CalendarEvent; onEdit: () => void; onSync: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-xl border border-[#c9a98d]/15 bg-[#2a2630]/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[#c9a98d]">{formatDate(event.date)}</p>
          <h4 className="mt-1 text-[#f5f3f0]">{event.title}</h4>
          {event.description && <p className="mt-2 text-sm text-[#a89b8f]">{event.description}</p>}
          {event.sourceTaskId && <p className="mt-2 text-xs text-[#a89b8f]">Создано из важной задачи</p>}
        </div>
        <button onClick={onDelete} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${event.title}`}><Trash2 className="w-4 h-4" /></button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {event.source === 'google' && <span className="rounded-full bg-[#486a8d]/25 px-3 py-1 text-[#bdd7f0]">Источник: Google</span>}
        {event.googleSyncStatus === 'synced' && <span className="rounded-full bg-[#5c7a5e]/25 px-3 py-1 text-[#b9d0b7]">Google: синхронизировано</span>}
        {event.googleSyncStatus === 'pending' && <span className="rounded-full bg-[#c9a98d]/20 px-3 py-1 text-[#c9a98d]">Google: синхронизация</span>}
        {event.googleSyncStatus === 'not_connected' && <span className="rounded-full bg-[#2a2630] px-3 py-1 text-[#a89b8f]">Google: не подключен</span>}
        {event.googleSyncStatus === 'error' && <span className="rounded-full bg-[#8b3a52]/25 px-3 py-1 text-[#f0c5cf]">Google: ошибка</span>}
        {event.googleSyncError && <span className="text-[#a89b8f]">{event.googleSyncError}</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onEdit} className="calendar-soft-button inline-flex items-center gap-1"><Pencil className="w-3 h-3" />Редактировать</button>
        <button onClick={onSync} className="calendar-soft-button inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" />В Google</button>
        {event.googleHtmlLink && <a href={event.googleHtmlLink} target="_blank" rel="noreferrer" className="calendar-soft-button inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />Открыть</a>}
      </div>
    </div>
  );
}

export function ExpensesSection() {
  const { state, createExpense, deleteExpense, createExpenseCategory, deleteExpenseCategory } = useLibrary();
  const [activeTab, setActiveTab] = useState('STAVROPOLSKAYA');
  const [month, setMonth] = useState(currentMonthKey());
  const [categoryName, setCategoryName] = useState('');
  const [draft, setDraft] = useState({
    date: todayKey(),
    amount: 0,
    account: 'RS_SBER' as ExpenseAccount,
    category: state.expenseCategories[0]?.name ?? '',
    studio: 'STAVROPOLSKAYA' as ExpenseStudio,
    comment: '',
  });

  const tabs = [
    { id: 'STAVROPOLSKAYA', label: 'Расходы Ставропольская' },
    { id: 'MACHUGI', label: 'Расходы Мачуги' },
    { id: 'SUMMARY', label: 'Расходы СВОД' },
  ];
  const monthlyExpenses = state.expenses.filter((expense) => expense.date.startsWith(month));
  const visibleExpenses = activeTab === 'SUMMARY' ? monthlyExpenses : monthlyExpenses.filter((expense) => expense.studio === activeTab);
  const total = visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const saveExpense = () => {
    if (!draft.date || !draft.amount || !draft.category) return;
    createExpense(draft);
    setDraft((value) => ({ ...value, amount: 0, comment: '' }));
  };

  const addCategory = () => {
    createExpenseCategory(categoryName);
    setCategoryName('');
  };

  const exportRows = visibleExpenses.map((expense) => [
    expense.date,
    expense.amount,
    accountLabels[expense.account],
    expense.category,
    studioLabels[expense.studio],
    expense.comment ?? '',
  ]);

  return (
    <div className="space-y-5">
      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <GlassCard>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl text-[#f5f3f0]">Расходы</h2>
            <p className="text-sm text-[#a89b8f] mt-1">Итого за выбранный месяц: <span className="text-[#c9a98d]">{money(total)}</span></p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <label className="text-sm text-[#a89b8f]">
              Месяц
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="field mt-2 min-w-52" />
            </label>
            <button onClick={() => downloadExcel(`expenses-${activeTab}-${month}.xls`, [['Дата', 'Расход', 'Счет', 'Статья', 'Студия', 'Комментарий'], ...exportRows])} className="primary-action flex items-center gap-2">
              <Download className="w-4 h-4" />Выгрузить в Excel
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3">
          <input type="date" value={draft.date} onChange={(event) => setDraft((value) => ({ ...value, date: event.target.value }))} className="field" />
          <input type="number" value={draft.amount || ''} onChange={(event) => setDraft((value) => ({ ...value, amount: Number(event.target.value) }))} placeholder="Сумма" className="field" />
          <select value={draft.account} onChange={(event) => setDraft((value) => ({ ...value, account: event.target.value as ExpenseAccount }))} className="field">
            {Object.entries(accountLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={draft.category} onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value }))} className="field">
            {state.expenseCategories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
          </select>
          <select value={draft.studio} onChange={(event) => setDraft((value) => ({ ...value, studio: event.target.value as ExpenseStudio }))} className="field">
            {Object.entries(studioLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button onClick={saveExpense} className="primary-action">Добавить</button>
          <textarea value={draft.comment} onChange={(event) => setDraft((value) => ({ ...value, comment: event.target.value }))} placeholder="Комментарий" className="field md:col-span-3 xl:col-span-6 min-h-20" />
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg text-[#f5f3f0] mb-3">Статьи расходов</h3>
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Новая категория" className="field" />
          <button onClick={addCategory} className="primary-action">Добавить статью</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {state.expenseCategories.map((category) => (
            <span key={category.id} className="inline-flex items-center gap-2 rounded-full bg-[#c9a98d]/15 px-3 py-1 text-sm text-[#c9a98d]">
              {category.name}
              <button onClick={() => deleteExpenseCategory(category.id)} className="hover:text-[#f0c5cf]" aria-label={`Удалить ${category.name}`}>×</button>
            </span>
          ))}
        </div>
      </GlassCard>

      <ExpenseTable expenses={visibleExpenses} onDelete={deleteExpense} />
    </div>
  );
}

function ExpenseTable({ expenses, onDelete }: { expenses: ExpenseRecord[]; onDelete: (id: string) => void }) {
  return (
    <GlassCard className="overflow-x-auto">
      <table className="min-w-[900px] w-full">
        <thead>
          <tr className="text-left text-sm text-[#c9a98d]">
            <th className="p-3 border-b border-[#c9a98d]/15">Дата</th>
            <th className="p-3 border-b border-[#c9a98d]/15">Расход</th>
            <th className="p-3 border-b border-[#c9a98d]/15">Счет</th>
            <th className="p-3 border-b border-[#c9a98d]/15">Статья</th>
            <th className="p-3 border-b border-[#c9a98d]/15">Студия</th>
            <th className="p-3 border-b border-[#c9a98d]/15">Комментарий</th>
            <th className="p-3 border-b border-[#c9a98d]/15"> </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id} className="text-sm text-[#d8d1c8]">
              <td className="p-3 border-b border-[#c9a98d]/10">{formatDate(expense.date)}</td>
              <td className="p-3 border-b border-[#c9a98d]/10">{money(expense.amount)}</td>
              <td className="p-3 border-b border-[#c9a98d]/10">{accountLabels[expense.account]}</td>
              <td className="p-3 border-b border-[#c9a98d]/10">{expense.category}</td>
              <td className="p-3 border-b border-[#c9a98d]/10">{studioLabels[expense.studio]}</td>
              <td className="p-3 border-b border-[#c9a98d]/10">{expense.comment}</td>
              <td className="p-3 border-b border-[#c9a98d]/10">
                <button onClick={() => onDelete(expense.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label="Удалить расход"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
          {expenses.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-[#a89b8f]">Расходы пока не добавлены.</td></tr>}
        </tbody>
      </table>
    </GlassCard>
  );
}
