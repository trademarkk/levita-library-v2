import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, ExternalLink, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { TabNavigation } from './TabNavigation';
import { useLibrary } from '../domain/LibraryContext';
import { formatDate } from '../domain/labels';
import type { ExpenseAccount, ExpenseRecord, ExpenseStudio } from '../domain/types';

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
  const { state, googleCalendarStatus, createCalendarEvent, deleteCalendarEvent, refreshGoogleCalendarStatus, connectGoogleCalendar, syncCalendarEventToGoogle } = useLibrary();
  const [draft, setDraft] = useState({ title: '', date: todayKey(), description: '' });
  const events = [...state.calendarEvents].sort((left, right) => left.date.localeCompare(right.date));

  useEffect(() => {
    void refreshGoogleCalendarStatus();
  }, []);

  const save = () => {
    if (!draft.title.trim() || !draft.date) return;
    createCalendarEvent(draft);
    setDraft({ title: '', date: todayKey(), description: '' });
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
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-[1.2fr_180px] gap-3">
          <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Событие" className="field" />
          <input type="date" value={draft.date} onChange={(event) => setDraft((value) => ({ ...value, date: event.target.value }))} className="field" />
          <textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Комментарий" className="field md:col-span-2 min-h-20" />
        </div>
        <button onClick={save} className="primary-action mt-4 flex items-center gap-2"><Save className="w-4 h-4" />Сохранить событие</button>
      </GlassCard>

      <div className="grid lg:grid-cols-2 gap-4">
        {events.map((event) => (
          <GlassCard key={event.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-[#c9a98d]">{formatDate(event.date)}</p>
                <h3 className="text-lg text-[#f5f3f0] mt-1">{event.title}</h3>
                {event.description && <p className="text-sm text-[#a89b8f] mt-2">{event.description}</p>}
                {event.sourceTaskId && <p className="text-xs text-[#a89b8f] mt-3">Создано из важной задачи</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {event.googleSyncStatus === 'synced' && <span className="rounded-full bg-[#5c7a5e]/25 px-3 py-1 text-[#b9d0b7]">Google: синхронизировано</span>}
                  {event.googleSyncStatus === 'pending' && <span className="rounded-full bg-[#c9a98d]/20 px-3 py-1 text-[#c9a98d]">Google: синхронизация</span>}
                  {event.googleSyncStatus === 'not_connected' && <span className="rounded-full bg-[#2a2630] px-3 py-1 text-[#a89b8f]">Google: не подключен</span>}
                  {event.googleSyncStatus === 'error' && <span className="rounded-full bg-[#8b3a52]/25 px-3 py-1 text-[#f0c5cf]">Google: ошибка</span>}
                  {event.googleSyncError && <span className="text-[#a89b8f]">{event.googleSyncError}</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void syncCalendarEventToGoogle(event.id)} className="rounded-lg border border-[#c9a98d]/25 px-3 py-1 text-xs text-[#c9a98d] inline-flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />Отправить в Google
                  </button>
                  {event.googleHtmlLink && (
                    <a href={event.googleHtmlLink} target="_blank" rel="noreferrer" className="rounded-lg border border-[#c9a98d]/25 px-3 py-1 text-xs text-[#a89b8f] hover:text-[#c9a98d] inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />Открыть
                    </a>
                  )}
                </div>
              </div>
              <button onClick={() => deleteCalendarEvent(event.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${event.title}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          </GlassCard>
        ))}
        {events.length === 0 && <GlassCard><p className="text-[#a89b8f]">Событий пока нет.</p></GlassCard>}
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
