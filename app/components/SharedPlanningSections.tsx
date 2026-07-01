import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, ChevronDown, Download, Filter, Pencil, Plus, RotateCcw, Save, Search, Tags, Trash2, X } from 'lucide-react';
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

const EXPENSE_REVIEW_STORAGE_PREFIX = 'levita.expense-review.v1';

type ExpenseSortKey = 'reviewed' | 'date' | 'amount' | 'account' | 'category' | 'studio' | 'previousMonthCredit' | 'comment';
type ExpenseSortDirection = 'asc' | 'desc';
type ExpenseCreditFilter = 'ALL' | 'FLAGGED' | 'UNFLAGGED';
type ExpenseReviewFilter = 'ALL' | 'REVIEWED' | 'UNREVIEWED';
type ExpenseSortConfig = { key: ExpenseSortKey; direction: ExpenseSortDirection };
type ExpenseFilterState = {
  query: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  account: 'ALL' | ExpenseAccount;
  category: string;
  studio: 'ALL' | ExpenseStudio;
  reviewed: ExpenseReviewFilter;
};

const EMPTY_EXPENSE_FILTERS: ExpenseFilterState = {
  query: '',
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
  account: 'ALL',
  category: 'ALL',
  studio: 'ALL',
  reviewed: 'ALL',
};

const expenseTextCollator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

function defaultExpenseSortDirection(key: ExpenseSortKey): ExpenseSortDirection {
  return key === 'date' || key === 'amount' || key === 'reviewed' || key === 'previousMonthCredit' ? 'desc' : 'asc';
}

function expenseSortValue(expense: ExpenseRecord, key: ExpenseSortKey, reviewedIds: Set<string>): string | number {
  switch (key) {
    case 'reviewed': return Number(reviewedIds.has(expense.id));
    case 'date': return expense.date;
    case 'amount': return expense.amount;
    case 'account': return accountLabels[expense.account];
    case 'category': return expense.category;
    case 'studio': return studioLabels[expense.studio];
    case 'previousMonthCredit': return Number(Boolean(expense.previousMonthCredit));
    case 'comment': return expense.comment || '';
  }
}

function sortExpenses(expenses: ExpenseRecord[], sort: ExpenseSortConfig, reviewedIds: Set<string>) {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...expenses].sort((left, right) => {
    const leftValue = expenseSortValue(left, sort.key, reviewedIds);
    const rightValue = expenseSortValue(right, sort.key, reviewedIds);
    const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : expenseTextCollator.compare(String(leftValue), String(rightValue));
    return comparison * direction || right.date.localeCompare(left.date) || right.id.localeCompare(left.id);
  });
}

function filterExpenses(
  expenses: ExpenseRecord[],
  filters: ExpenseFilterState,
  creditFilter: ExpenseCreditFilter,
  reviewedIds: Set<string>,
) {
  const query = filters.query.trim().toLocaleLowerCase('ru-RU');
  const amountMin = filters.amountMin.trim() ? Number(filters.amountMin.replace(',', '.')) : null;
  const amountMax = filters.amountMax.trim() ? Number(filters.amountMax.replace(',', '.')) : null;

  return expenses.filter((expense) => {
    if (creditFilter !== 'ALL' && Boolean(expense.previousMonthCredit) !== (creditFilter === 'FLAGGED')) return false;
    if (filters.dateFrom && expense.date < filters.dateFrom) return false;
    if (filters.dateTo && expense.date > filters.dateTo) return false;
    if (amountMin !== null && Number.isFinite(amountMin) && expense.amount < amountMin) return false;
    if (amountMax !== null && Number.isFinite(amountMax) && expense.amount > amountMax) return false;
    if (filters.account !== 'ALL' && expense.account !== filters.account) return false;
    if (filters.category !== 'ALL' && expense.category !== filters.category) return false;
    if (filters.studio !== 'ALL' && expense.studio !== filters.studio) return false;
    if (filters.reviewed !== 'ALL' && reviewedIds.has(expense.id) !== (filters.reviewed === 'REVIEWED')) return false;
    if (!query) return true;
    const searchable = [
      expense.date,
      formatDate(expense.date),
      String(expense.amount),
      accountLabels[expense.account],
      expense.category,
      studioLabels[expense.studio],
      expense.comment || '',
    ].join(' ').toLocaleLowerCase('ru-RU');
    return searchable.includes(query);
  });
}

function expenseReviewStorageKey(userId?: string) {
  return `${EXPENSE_REVIEW_STORAGE_PREFIX}:${userId || 'anonymous'}`;
}

function readReviewedExpenseIds(storageKey: string) {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as { ids?: unknown };
    return new Set(Array.isArray(stored.ids) ? stored.ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    window.localStorage.removeItem(storageKey);
    return new Set<string>();
  }
}

function persistReviewedExpenseIds(storageKey: string, reviewedIds: Set<string>) {
  if (typeof window === 'undefined') return;
  if (reviewedIds.size === 0) {
    window.localStorage.removeItem(storageKey);
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify({ ids: [...reviewedIds] }));
}

function useReviewedExpenses(userId?: string) {
  const storageKey = expenseReviewStorageKey(userId);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => readReviewedExpenseIds(storageKey));

  useEffect(() => {
    setReviewedIds(readReviewedExpenseIds(storageKey));
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setReviewedIds(readReviewedExpenseIds(storageKey));
    };
    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, [storageKey]);

  const setReviewed = useCallback((expenseId: string, checked: boolean) => {
    setReviewedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(expenseId);
      else next.delete(expenseId);
      persistReviewedExpenseIds(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const clearReviewed = useCallback(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey);
    setReviewedIds(new Set());
  }, [storageKey]);

  return { reviewedIds, setReviewed, clearReviewed };
}

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

function expenseCategoryCountLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'статей';
  if (last === 1) return 'статья';
  if (last >= 2 && last <= 4) return 'статьи';
  return 'статей';
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
  const {
    state,
    refreshSlice,
    addFinancialPlanRow,
    updateFinancialPlanRow,
    deleteFinancialPlanRow,
    updateFinancialPlanCell,
    updateFinancialPlanPaymentStatus,
  } = useLibrary();
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
                    <td key={day} className={`financial-table-cell ${row.paidPayments?.[day] ? 'financial-payment-paid' : ''}`}>
                      <div className="space-y-1.5">
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
                        {String(row.payments[day] || '').trim() && (
                          <label className="financial-payment-status">
                            <input
                              type="checkbox"
                              checked={Boolean(row.paidPayments?.[day])}
                              onChange={(event) => updateFinancialPlanPaymentStatus(month, row.id, day, event.target.checked)}
                              aria-label={`Оплачено: ${row.title}, ${formatPlanDay(day)}`}
                            />
                            <span>Оплачено</span>
                          </label>
                        )}
                      </div>
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
  const { state, currentUser, refreshSlice, createExpense, updateExpense, deleteExpense, createExpenseCategory, deleteExpenseCategory } = useLibrary();
  const [activeTab, setActiveTab] = useState('STAVROPOLSKAYA');
  const [month, setMonth] = useState(currentMonthKey());
  const [categoryName, setCategoryName] = useState('');
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [creditFilter, setCreditFilter] = useState<ExpenseCreditFilter>('ALL');
  const [filters, setFilters] = useState<ExpenseFilterState>(() => ({ ...EMPTY_EXPENSE_FILTERS }));
  const [sort, setSort] = useState<ExpenseSortConfig>({ key: 'date', direction: 'desc' });
  const { reviewedIds, setReviewed, clearReviewed } = useReviewedExpenses(currentUser?.id);
  const [draft, setDraft] = useState({
    date: todayKey(),
    amount: 0,
    account: 'RS_SBER' as ExpenseAccount,
    category: state.expenseCategories[0]?.name ?? '',
    studio: 'STAVROPOLSKAYA' as ExpenseStudio,
    previousMonthCredit: false,
    comment: '',
  });

  const tabs = [
    { id: 'STAVROPOLSKAYA', label: 'Расходы Ставропольская' },
    { id: 'MACHUGI', label: 'Расходы Мачуги' },
    { id: 'SUMMARY', label: 'Расходы СВОД' },
  ];
  const monthlyExpenses = useMemo(() => state.expenses.filter((expense) => expense.date.startsWith(month)), [month, state.expenses]);
  const visibleExpenses = useMemo(
    () => activeTab === 'SUMMARY' ? monthlyExpenses : monthlyExpenses.filter((expense) => expense.studio === activeTab),
    [activeTab, monthlyExpenses],
  );
  const displayedExpenses = useMemo(() => {
    const filtered = filterExpenses(visibleExpenses, filters, creditFilter, reviewedIds);
    return sortExpenses(filtered, sort, reviewedIds);
  }, [creditFilter, filters, reviewedIds, sort, visibleExpenses]);
  const total = visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const visibleReviewedCount = displayedExpenses.reduce((count, expense) => count + Number(reviewedIds.has(expense.id)), 0);

  useEffect(() => {
    void refreshSlice('expenses', { month });
  }, [month]);

  useEffect(() => {
    setFilters((current) => current.studio === 'ALL' ? current : { ...current, studio: 'ALL' });
  }, [activeTab]);

  useEffect(() => {
    const firstCategory = state.expenseCategories[0]?.name;
    if (!firstCategory) return;
    setDraft((current) => state.expenseCategories.some((category) => category.name === current.category)
      ? current
      : { ...current, category: firstCategory });
  }, [state.expenseCategories]);

  const saveExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.date) {
      setFormError('Укажите дату расхода.');
      return;
    }
    if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
      setFormError('Укажите сумму расхода больше нуля.');
      return;
    }
    if (!draft.category.trim()) {
      setFormError('Выберите статью расхода. Если список пуст, сначала добавьте статью ниже.');
      return;
    }
    createExpense({ ...draft, category: draft.category.trim(), comment: draft.comment.trim() });
    setFormError('');
    setDraft((value) => ({ ...value, amount: 0, previousMonthCredit: false, comment: '' }));
  };

  const addCategory = () => {
    createExpenseCategory(categoryName);
    setCategoryName('');
  };

  const removeExpense = (id: string) => {
    setReviewed(id, false);
    deleteExpense(id);
  };

  const changeSort = useCallback((key: ExpenseSortKey) => {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: defaultExpenseSortDirection(key) });
  }, []);

  const exportRows = displayedExpenses.map((expense) => [
    expense.date,
    expense.amount,
    accountLabels[expense.account],
    expense.category,
    studioLabels[expense.studio],
    expense.previousMonthCredit ? 'Да' : 'Нет',
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
            <button onClick={() => downloadExcel(`expenses-${activeTab}-${month}.xls`, [['Дата', 'Расход', 'Счет', 'Статья', 'Студия', 'Кр. пред. месяца', 'Комментарий'], ...exportRows])} className="primary-action flex items-center gap-2">
              <Download className="w-4 h-4" />Выгрузить в Excel
            </button>
          </div>
        </div>

        <form noValidate onSubmit={saveExpense} className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input aria-label="Дата расхода" type="date" value={draft.date} onChange={(event) => { setFormError(''); setDraft((value) => ({ ...value, date: event.target.value })); }} className="field" />
          <input aria-label="Сумма расхода" type="number" min="0.01" step="0.01" value={draft.amount || ''} onChange={(event) => { setFormError(''); setDraft((value) => ({ ...value, amount: Number(event.target.value) })); }} placeholder="Сумма" className="field" />
          <select aria-label="Счет расхода" value={draft.account} onChange={(event) => setDraft((value) => ({ ...value, account: event.target.value as ExpenseAccount }))} className="field">
            {Object.entries(accountLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="Статья расхода" value={draft.category} onChange={(event) => { setFormError(''); setDraft((value) => ({ ...value, category: event.target.value })); }} className="field">
            {state.expenseCategories.length === 0 && <option value="">Сначала добавьте статью</option>}
            {state.expenseCategories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
          </select>
          <select aria-label="Студия расхода" value={draft.studio} onChange={(event) => setDraft((value) => ({ ...value, studio: event.target.value as ExpenseStudio }))} className="field">
            {Object.entries(studioLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label className="field inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-[#d8d1c8]">
            <input type="checkbox" checked={draft.previousMonthCredit} onChange={(event) => setDraft((value) => ({ ...value, previousMonthCredit: event.target.checked }))} className="h-4 w-4 shrink-0 accent-[#c9a98d]" />
            Кр. пред. месяца
          </label>
          <textarea aria-label="Комментарий к расходу" value={draft.comment} onChange={(event) => setDraft((value) => ({ ...value, comment: event.target.value }))} placeholder="Комментарий" className="field min-h-20 md:col-span-2 xl:col-span-5" />
          <button type="submit" className="primary-action min-h-11 self-stretch">Добавить</button>
          {formError && <p role="alert" className="text-sm text-[#f0a9b9] md:col-span-3 xl:col-span-6">{formError}</p>}
        </form>
      </GlassCard>

      <div className="overflow-hidden rounded-lg border border-[#c9a98d]/20 bg-[#1a1820]/65">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#c9a98d]/12 text-[#c9a98d]">
              <Tags className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base text-[#f5f3f0]">Статьи расходов</h3>
              <p className="text-xs text-[#a89b8f]">{state.expenseCategories.length} {expenseCategoryCountLabel(state.expenseCategories.length)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCategoryManagerOpen((current) => !current)}
            aria-expanded={isCategoryManagerOpen}
            aria-controls="expense-category-manager"
            className="soft-action inline-flex items-center gap-2 px-3 py-2 text-sm"
          >
            {isCategoryManagerOpen ? 'Свернуть' : 'Управлять'}
            <ChevronDown className={`h-4 w-4 transition-transform ${isCategoryManagerOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {isCategoryManagerOpen && (
          <div id="expense-category-manager" className="border-t border-[#c9a98d]/15 px-4 py-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                addCategory();
              }}
              className="flex max-w-2xl flex-col gap-2 sm:flex-row"
            >
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Новая статья расходов"
                aria-label="Название новой статьи расходов"
                className="field min-w-0 flex-1"
              />
              <button type="submit" disabled={!categoryName.trim()} className="primary-action inline-flex items-center justify-center gap-2 px-4 disabled:cursor-not-allowed disabled:opacity-45">
                <Plus className="h-4 w-4" />
                Добавить
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {state.expenseCategories.map((category) => (
                <span key={category.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#c9a98d]/15 bg-[#c9a98d]/10 py-1 pl-3 pr-1.5 text-sm text-[#c9a98d]">
                  {category.name}
                  <button type="button" onClick={() => deleteExpenseCategory(category.id)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-[#8b3a52]/25 hover:text-[#f0c5cf]" aria-label={`Удалить статью ${category.name}`} title="Удалить статью">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              {state.expenseCategories.length === 0 && <p className="text-sm text-[#a89b8f]">Статьи пока не добавлены.</p>}
            </div>
          </div>
        )}
      </div>

      <ExpenseTable
        expenses={displayedExpenses}
        totalCount={visibleExpenses.length}
        categories={state.expenseCategories.map((category) => category.name)}
        showStudioFilter={activeTab === 'SUMMARY'}
        reviewedIds={reviewedIds}
        reviewedCount={visibleReviewedCount}
        creditFilter={creditFilter}
        filters={filters}
        sort={sort}
        onCreditFilterChange={setCreditFilter}
        onFiltersChange={setFilters}
        onResetFilters={() => {
          setFilters({ ...EMPTY_EXPENSE_FILTERS });
          setCreditFilter('ALL');
        }}
        onSort={changeSort}
        onReviewedChange={setReviewed}
        onPreviousMonthCreditChange={(id, checked) => updateExpense(id, { previousMonthCredit: checked })}
        onUpdate={updateExpense}
        onClearReviewed={clearReviewed}
        onDelete={removeExpense}
      />
    </div>
  );
}

type ExpenseTableProps = {
  expenses: ExpenseRecord[];
  totalCount: number;
  categories: string[];
  showStudioFilter: boolean;
  reviewedIds: Set<string>;
  reviewedCount: number;
  creditFilter: ExpenseCreditFilter;
  filters: ExpenseFilterState;
  sort: ExpenseSortConfig;
  onCreditFilterChange: (filter: ExpenseCreditFilter) => void;
  onFiltersChange: (filters: ExpenseFilterState) => void;
  onResetFilters: () => void;
  onSort: (key: ExpenseSortKey) => void;
  onReviewedChange: (id: string, checked: boolean) => void;
  onPreviousMonthCreditChange: (id: string, checked: boolean) => void;
  onUpdate: (id: string, input: Partial<Pick<ExpenseRecord, 'date' | 'amount' | 'account' | 'category' | 'studio' | 'previousMonthCredit' | 'comment'>>) => void;
  onClearReviewed: () => void;
  onDelete: (id: string) => void;
};

type ExpenseEditDraft = {
  date: string;
  amount: string;
  account: ExpenseAccount;
  category: string;
  studio: ExpenseStudio;
  previousMonthCredit: boolean;
  comment: string;
};

type SortableExpenseHeaderProps = {
  label: string;
  sortKey: ExpenseSortKey;
  sort: ExpenseSortConfig;
  onSort: (key: ExpenseSortKey) => void;
  className?: string;
};

function SortableExpenseHeader({ label, sortKey, sort, onSort, className = '' }: SortableExpenseHeaderProps) {
  const isActive = sort.key === sortKey;
  const ariaSort = isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  const SortIcon = !isActive ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th aria-sort={ariaSort} className={`border-b border-[#c9a98d]/15 p-3 ${className}`}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-[#f5f3f0]">
        {label}
        <SortIcon className={`h-3.5 w-3.5 ${isActive ? 'text-[#d9b99c]' : 'opacity-45'}`} />
      </button>
    </th>
  );
}

function ExpenseTable({
  expenses,
  totalCount,
  categories,
  showStudioFilter,
  reviewedIds,
  reviewedCount,
  creditFilter,
  filters,
  sort,
  onCreditFilterChange,
  onFiltersChange,
  onResetFilters,
  onSort,
  onReviewedChange,
  onPreviousMonthCreditChange,
  onUpdate,
  onClearReviewed,
  onDelete,
}: ExpenseTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ExpenseEditDraft | null>(null);
  const [editError, setEditError] = useState('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const activeFilterCount = [
    filters.query,
    filters.dateFrom,
    filters.dateTo,
    filters.amountMin,
    filters.amountMax,
    filters.account !== 'ALL',
    filters.category !== 'ALL',
    filters.studio !== 'ALL',
    filters.reviewed !== 'ALL',
    creditFilter !== 'ALL',
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const updateFilter = <Key extends keyof ExpenseFilterState,>(key: Key, value: ExpenseFilterState[Key]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const startEditing = (expense: ExpenseRecord) => {
    setEditingId(expense.id);
    setEditError('');
    setEditDraft({
      date: expense.date,
      amount: String(expense.amount),
      account: expense.account,
      category: expense.category,
      studio: expense.studio,
      previousMonthCredit: Boolean(expense.previousMonthCredit),
      comment: expense.comment || '',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDraft(null);
    setEditError('');
  };

  const saveEditing = () => {
    if (!editingId || !editDraft) return;
    const amount = Number(editDraft.amount.replace(',', '.'));
    if (!editDraft.date) {
      setEditError('Укажите дату расхода.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setEditError('Сумма расхода должна быть больше нуля.');
      return;
    }
    if (!editDraft.category.trim()) {
      setEditError('Выберите статью расхода.');
      return;
    }
    onUpdate(editingId, {
      ...editDraft,
      amount,
      category: editDraft.category.trim(),
      comment: editDraft.comment.trim(),
    });
    cancelEditing();
  };

  return (
    <GlassCard>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg text-[#f5f3f0]">Проверка расходов</h3>
          <p className="mt-1 text-sm text-[#a89b8f]">Показано: {expenses.length} из {totalCount}. Проверено: {reviewedCount}</p>
        </div>
        <button
          type="button"
          onClick={onClearReviewed}
          disabled={reviewedIds.size === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#c9a98d]/25 px-4 py-2 text-sm text-[#c9a98d] transition-colors hover:border-[#c9a98d]/50 hover:bg-[#c9a98d]/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RotateCcw className="h-4 w-4" />
          Сбросить отметки
        </button>
      </div>

      <div className="mb-5 rounded-lg border border-[#c9a98d]/15 bg-[#17151c]/35 p-4">
        <div className={`flex flex-wrap items-center justify-between gap-3 ${isFiltersOpen ? 'mb-3' : ''}`}>
          <button
            type="button"
            data-testid="expense-filters-toggle"
            aria-expanded={isFiltersOpen}
            aria-controls="expense-filters-panel"
            onClick={() => setIsFiltersOpen((current) => !current)}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-[#d9b99c] transition-colors hover:bg-[#c9a98d]/10 hover:text-[#f5f3f0]"
          >
            <Filter className="h-4 w-4" />
            Фильтры
            {activeFilterCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c9a98d] px-1.5 text-[11px] font-semibold text-[#17151c]">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isFiltersOpen ? 'rotate-180' : ''}`} />
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="soft-action px-3 py-1.5 text-xs"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
        {isFiltersOpen && (
        <div id="expense-filters-panel" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#a89b8f]" />
            <input
              aria-label="Поиск по расходам"
              value={filters.query}
              onChange={(event) => updateFilter('query', event.target.value)}
              placeholder="Поиск по статье, комментарию, сумме"
              className="field pl-10"
            />
          </label>
          <input aria-label="Дата расхода от" type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} className="field" />
          <input aria-label="Дата расхода до" type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} className="field" />
          <input aria-label="Минимальная сумма расхода" type="number" min="0" step="0.01" value={filters.amountMin} onChange={(event) => updateFilter('amountMin', event.target.value)} placeholder="Сумма от" className="field" />
          <input aria-label="Максимальная сумма расхода" type="number" min="0" step="0.01" value={filters.amountMax} onChange={(event) => updateFilter('amountMax', event.target.value)} placeholder="Сумма до" className="field" />
          <select aria-label="Фильтр по счету" value={filters.account} onChange={(event) => updateFilter('account', event.target.value as ExpenseFilterState['account'])} className="field">
            <option value="ALL">Все счета</option>
            {Object.entries(accountLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="Фильтр по статье" value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} className="field">
            <option value="ALL">Все статьи</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          {showStudioFilter && (
            <select aria-label="Фильтр по студии" value={filters.studio} onChange={(event) => updateFilter('studio', event.target.value as ExpenseFilterState['studio'])} className="field">
              <option value="ALL">Все студии</option>
              {Object.entries(studioLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          )}
          <select aria-label="Фильтр по статусу проверки" value={filters.reviewed} onChange={(event) => updateFilter('reviewed', event.target.value as ExpenseReviewFilter)} className="field">
            <option value="ALL">Все статусы проверки</option>
            <option value="REVIEWED">Только проверенные</option>
            <option value="UNREVIEWED">Только непроверенные</option>
          </select>
          <select aria-label="Фильтр по кредиторской задолженности предыдущего месяца" value={creditFilter} onChange={(event) => onCreditFilterChange(event.target.value as ExpenseCreditFilter)} className="field">
            <option value="ALL">Все расходы</option>
            <option value="FLAGGED">Только Кр. пред. месяца</option>
            <option value="UNFLAGGED">Без Кр. пред. месяца</option>
          </select>
        </div>
        )}
      </div>

      {editError && <p role="alert" className="mb-3 text-sm text-[#f0a9b9]">{editError}</p>}
      <div className="-mx-6 overflow-x-auto px-6 pb-1">
        <table className="min-w-[1120px] w-full">
          <thead>
            <tr className="text-left text-sm text-[#c9a98d]">
              <SortableExpenseHeader label="Проверен" sortKey="reviewed" sort={sort} onSort={onSort} className="w-28" />
              <SortableExpenseHeader label="Дата" sortKey="date" sort={sort} onSort={onSort} />
              <SortableExpenseHeader label="Расход" sortKey="amount" sort={sort} onSort={onSort} />
              <SortableExpenseHeader label="Счет" sortKey="account" sort={sort} onSort={onSort} />
              <SortableExpenseHeader label="Статья" sortKey="category" sort={sort} onSort={onSort} />
              <SortableExpenseHeader label="Студия" sortKey="studio" sort={sort} onSort={onSort} />
              <SortableExpenseHeader label="Кр. пред. месяца" sortKey="previousMonthCredit" sort={sort} onSort={onSort} className="w-44" />
              <SortableExpenseHeader label="Комментарий" sortKey="comment" sort={sort} onSort={onSort} />
              <th className="border-b border-[#c9a98d]/15 p-3"> </th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => {
              const isReviewed = reviewedIds.has(expense.id);
              const rowDraft = editingId === expense.id ? editDraft : null;
              return (
                <tr
                  key={expense.id}
                  className={`text-sm transition-colors ${isReviewed ? 'bg-[#3b5147]/55 text-[#f5f3f0]' : 'text-[#d8d1c8] hover:bg-[#c9a98d]/5'}`}
                  data-expense-id={expense.id}
                  data-expense-date={expense.date}
                  data-expense-reviewed={isReviewed ? 'true' : 'false'}
                  data-expense-previous-month-credit={expense.previousMonthCredit ? 'true' : 'false'}
                >
                  <td className="p-3 border-b border-[#c9a98d]/10">
                    <input
                      type="checkbox"
                      checked={isReviewed}
                      onChange={(event) => onReviewedChange(expense.id, event.target.checked)}
                      className="h-5 w-5 cursor-pointer accent-[#c9a98d]"
                      aria-label={`Отметить расход от ${formatDate(expense.date)} как проверенный`}
                    />
                  </td>
                  {rowDraft ? (
                    <>
                      <td className="p-2 border-b border-[#c9a98d]/10">
                        <input aria-label="Редактировать дату расхода" type="date" value={rowDraft.date} onChange={(event) => setEditDraft({ ...rowDraft, date: event.target.value })} className="field min-w-36 px-2 py-1.5 text-sm" />
                      </td>
                      <td className="p-2 border-b border-[#c9a98d]/10">
                        <input aria-label="Редактировать сумму расхода" type="number" min="0.01" step="0.01" value={rowDraft.amount} onChange={(event) => setEditDraft({ ...rowDraft, amount: event.target.value })} className="field min-w-28 px-2 py-1.5 text-sm" />
                      </td>
                      <td className="p-2 border-b border-[#c9a98d]/10">
                        <select aria-label="Редактировать счет расхода" value={rowDraft.account} onChange={(event) => setEditDraft({ ...rowDraft, account: event.target.value as ExpenseAccount })} className="field min-w-32 px-2 py-1.5 text-sm">
                          {Object.entries(accountLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </td>
                      <td className="p-2 border-b border-[#c9a98d]/10">
                        <select aria-label="Редактировать статью расхода" value={rowDraft.category} onChange={(event) => setEditDraft({ ...rowDraft, category: event.target.value })} className="field min-w-36 px-2 py-1.5 text-sm">
                          {!categories.includes(rowDraft.category) && <option value={rowDraft.category}>{rowDraft.category}</option>}
                          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                      </td>
                      <td className="p-2 border-b border-[#c9a98d]/10">
                        <select aria-label="Редактировать студию расхода" value={rowDraft.studio} onChange={(event) => setEditDraft({ ...rowDraft, studio: event.target.value as ExpenseStudio })} className="field min-w-36 px-2 py-1.5 text-sm">
                          {Object.entries(studioLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </td>
                      <td className="p-2 border-b border-[#c9a98d]/10">
                        <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap">
                          <input type="checkbox" checked={rowDraft.previousMonthCredit} onChange={(event) => setEditDraft({ ...rowDraft, previousMonthCredit: event.target.checked })} className="h-4 w-4 shrink-0 accent-[#c9a98d]" />
                          {rowDraft.previousMonthCredit ? 'Да' : 'Нет'}
                        </label>
                      </td>
                      <td className="p-2 border-b border-[#c9a98d]/10">
                        <input aria-label="Редактировать комментарий расхода" value={rowDraft.comment} onChange={(event) => setEditDraft({ ...rowDraft, comment: event.target.value })} className="field min-w-48 px-2 py-1.5 text-sm" />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 border-b border-[#c9a98d]/10">{formatDate(expense.date)}</td>
                      <td className="p-3 border-b border-[#c9a98d]/10">{money(expense.amount)}</td>
                      <td className="p-3 border-b border-[#c9a98d]/10">{accountLabels[expense.account]}</td>
                      <td className="p-3 border-b border-[#c9a98d]/10">{expense.category}</td>
                      <td className="p-3 border-b border-[#c9a98d]/10">{studioLabels[expense.studio]}</td>
                      <td className="p-3 border-b border-[#c9a98d]/10">
                        <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={Boolean(expense.previousMonthCredit)}
                            onChange={(event) => onPreviousMonthCreditChange(expense.id, event.target.checked)}
                            className="h-4 w-4 shrink-0 accent-[#c9a98d]"
                            aria-label={`Кр. пред. месяца для расхода от ${formatDate(expense.date)}`}
                          />
                          {expense.previousMonthCredit ? 'Да' : 'Нет'}
                        </label>
                      </td>
                      <td className="p-3 border-b border-[#c9a98d]/10">{expense.comment}</td>
                    </>
                  )}
                  <td className="p-3 border-b border-[#c9a98d]/10">
                    <div className="flex items-center justify-end gap-2">
                      {rowDraft ? (
                        <>
                          <button type="button" onClick={saveEditing} className="icon-action h-8 w-8 p-0 text-[#9fc5a4]" aria-label="Сохранить изменения расхода" title="Сохранить"><Save className="h-4 w-4" /></button>
                          <button type="button" onClick={cancelEditing} className="icon-action h-8 w-8 p-0" aria-label="Отменить редактирование расхода" title="Отменить"><X className="h-4 w-4" /></button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEditing(expense)} className="text-[#a89b8f] hover:text-[#d9b99c]" aria-label={`Редактировать расход от ${formatDate(expense.date)}`} title="Редактировать"><Pencil className="h-4 w-4" /></button>
                          <button type="button" onClick={() => onDelete(expense.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label="Удалить расход" title="Удалить"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {expenses.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-[#a89b8f]">По выбранному фильтру расходов нет.</td></tr>}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

