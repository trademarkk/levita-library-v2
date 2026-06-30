import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, Download, Plus, RotateCcw, Trash2 } from 'lucide-react';
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
type ExpenseSortConfig = { key: ExpenseSortKey; direction: ExpenseSortDirection };

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
  const [formError, setFormError] = useState('');
  const [creditFilter, setCreditFilter] = useState<ExpenseCreditFilter>('ALL');
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
    const filtered = creditFilter === 'ALL'
      ? visibleExpenses
      : visibleExpenses.filter((expense) => Boolean(expense.previousMonthCredit) === (creditFilter === 'FLAGGED'));
    return sortExpenses(filtered, sort, reviewedIds);
  }, [creditFilter, reviewedIds, sort, visibleExpenses]);
  const total = visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const visibleReviewedCount = displayedExpenses.reduce((count, expense) => count + Number(reviewedIds.has(expense.id)), 0);

  useEffect(() => {
    void refreshSlice('expenses', { month });
  }, [month]);

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

      <GlassCard className="max-w-3xl">
        <h3 className="text-lg text-[#f5f3f0] mb-3">Статьи расходов</h3>
        <div className="mb-3 flex max-w-xl flex-col gap-3 sm:flex-row">
          <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Новая категория" className="field sm:max-w-sm" />
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

      <ExpenseTable
        expenses={displayedExpenses}
        totalCount={visibleExpenses.length}
        reviewedIds={reviewedIds}
        reviewedCount={visibleReviewedCount}
        creditFilter={creditFilter}
        sort={sort}
        onCreditFilterChange={setCreditFilter}
        onSort={changeSort}
        onReviewedChange={setReviewed}
        onPreviousMonthCreditChange={(id, checked) => updateExpense(id, { previousMonthCredit: checked })}
        onClearReviewed={clearReviewed}
        onDelete={removeExpense}
      />
    </div>
  );
}

type ExpenseTableProps = {
  expenses: ExpenseRecord[];
  totalCount: number;
  reviewedIds: Set<string>;
  reviewedCount: number;
  creditFilter: ExpenseCreditFilter;
  sort: ExpenseSortConfig;
  onCreditFilterChange: (filter: ExpenseCreditFilter) => void;
  onSort: (key: ExpenseSortKey) => void;
  onReviewedChange: (id: string, checked: boolean) => void;
  onPreviousMonthCreditChange: (id: string, checked: boolean) => void;
  onClearReviewed: () => void;
  onDelete: (id: string) => void;
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
  reviewedIds,
  reviewedCount,
  creditFilter,
  sort,
  onCreditFilterChange,
  onSort,
  onReviewedChange,
  onPreviousMonthCreditChange,
  onClearReviewed,
  onDelete,
}: ExpenseTableProps) {
  return (
    <GlassCard>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg text-[#f5f3f0]">Проверка расходов</h3>
          <p className="mt-1 text-sm text-[#a89b8f]">Показано: {expenses.length} из {totalCount}. Проверено: {reviewedCount}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            aria-label="Фильтр по кредиторской задолженности предыдущего месяца"
            value={creditFilter}
            onChange={(event) => onCreditFilterChange(event.target.value as ExpenseCreditFilter)}
            className="field min-w-52 py-2 text-sm"
          >
            <option value="ALL">Все расходы</option>
            <option value="FLAGGED">Только Кр. пред. месяца</option>
            <option value="UNFLAGGED">Без Кр. пред. месяца</option>
          </select>
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
      </div>
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
                  <td className="p-3 border-b border-[#c9a98d]/10">
                    <button onClick={() => onDelete(expense.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label="Удалить расход"><Trash2 className="w-4 h-4" /></button>
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

