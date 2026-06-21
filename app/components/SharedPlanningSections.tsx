import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Download, Plus, Trash2 } from 'lucide-react';
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
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

function upcomingDayTitle(dateKey: string) {
  const today = new Date(`${todayKey()}T00:00:00`);
  const date = new Date(`${dateKey}T00:00:00`);
  const difference = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (difference === 0) return 'Сегодня';
  if (difference === 1) return 'Завтра';
  if (difference === 2) return 'Послезавтра';
  return formatPlanDay(dateKey);
}

function formatPaymentValue(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  const amount = Number(normalized);
  if (normalized && Number.isFinite(amount)) return `${amount.toLocaleString('ru-RU')} ₽`;
  return value;
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
  const { state, refreshSlice, addFinancialPlanRow, updateFinancialPlanRow, deleteFinancialPlanRow, updateFinancialPlanCell } = useLibrary();
  const [month, setMonth] = useState(currentMonthKey());
  const [newTitle, setNewTitle] = useState('');
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});
  const plan = state.financialPlans.find((item) => item.month === month);
  const days = useMemo(() => daysInMonth(month), [month]);

  useEffect(() => {
    void refreshSlice('financial-plan', { month });
  }, [month]);

  const addRow = () => {
    addFinancialPlanRow(month, newTitle);
    setNewTitle('');
  };

  const cellKey = (rowId: string, day: string) => `${rowId}:${day}`;

  const commitCell = (rowId: string, day: string, value: string) => {
    const currentValue = plan?.rows.find((row) => row.id === rowId)?.payments[day] ?? '';
    if (value === currentValue) return;
    updateFinancialPlanCell(month, rowId, day, value);
  };

  return (
    <div className="space-y-5">
      <GlassCard>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl text-[#f5f3f0]">Финансовый план</h2>
            <p className="text-sm text-[#a89b8f] mt-1">Общая таблица ассистента и руководителя. Новый платёж и его даты автоматически повторяются в будущих месяцах.</p>
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

      <GlassCard>
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-[#c9a98d]" />
          <div>
            <h3 className="text-xl text-[#f5f3f0]">Ближайшие платежи</h3>
            <p className="mt-1 text-sm text-[#a89b8f]">Платежи на сегодня и следующие два дня.</p>
          </div>
        </div>
        {state.upcomingFinancialPayments.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {state.upcomingFinancialPayments.map((payment) => (
              <div key={`${payment.rowId}:${payment.date}`} className="rounded-lg border border-[#c9a98d]/20 bg-[#2a2630]/55 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase text-[#c9a98d]">{upcomingDayTitle(payment.date)}</p>
                    <p className="mt-1 text-xs text-[#a89b8f]">{formatPlanDay(payment.date)}</p>
                  </div>
                  <strong className="text-sm text-[#f5f3f0]">{formatPaymentValue(payment.value)}</strong>
                </div>
                <p className="mt-3 text-sm leading-5 text-[#f5f3f0]">{payment.title}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-[#c9a98d]/20 px-4 py-5 text-sm text-[#a89b8f]">
            На ближайшие три дня платежей нет.
          </div>
        )}
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
                      <input
                        value={cellDrafts[cellKey(row.id, day)] ?? row.payments[day] ?? ''}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setCellDrafts((current) => ({ ...current, [cellKey(row.id, day)]: nextValue }));
                        }}
                        onBlur={(event) => {
                          const key = cellKey(row.id, day);
                          commitCell(row.id, day, event.target.value);
                          setCellDrafts((current) => {
                            const next = { ...current };
                            delete next[key];
                            return next;
                          });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur();
                        }}
                        className="field px-2 py-1 text-sm text-center"
                        placeholder="₽"
                      />
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

export function ExpensesSection() {
  const { state, refreshSlice, createExpense, deleteExpense, createExpenseCategory, deleteExpenseCategory } = useLibrary();
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

  useEffect(() => {
    void refreshSlice('expenses', { month });
  }, [month]);

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

