import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initialState } from './seed';
import { normalizeHashtags, roleRoutes } from './labels';
import type {
  AppSettings,
  AdminShift,
  AuditAction,
  BusinessModelScope,
  CallReview,
  ChecklistControlStatus,
  ChecklistReport,
  ChecklistReportSlot,
  ContentFavorite,
  ContentReadReceipt,
  DailyChecklist,
  DocumentTemplate,
  ExpenseAccount,
  ExpenseStudio,
  EmployeeStatus,
  FavoriteEntityType,
  FinancialPlanMonth,
  FinancialPlanRow,
  HelpfulLink,
  KnowledgeCategory,
  KnowledgeEntry,
  LibraryState,
  OwnerChecklistReport,
  RefundCase,
  RefundStatus,
  ResponseTemplate,
  Role,
  Studio,
  TaskTemplate,
  TrainerEvaluationSheet,
  UsefulContact,
  User,
} from './types';

const SETTINGS_KEY = 'levtia-library-settings-v2';
const SESSION_USER_KEY = 'levtia-library-session-user-v2';
const REPORT_ALIASES: Record<ChecklistReportSlot, string[]> = {
  '14:00': ['Отчет по звонкам и кассе в 14:00', 'Отчёт по звонкам и кассе в 14:00'],
  '18:00': ['Отчет по звонкам и кассе в 18:00', 'Отчёт по звонкам и кассе в 18:00'],
  '22:00': ['Поставить терминал и телефон на зарядку', 'Поставить телефон и терминал на зарядку', 'Поставила телефон и терминал на зарядку'],
};
const REPORT_DEADLINES: Record<ChecklistReportSlot, number> = {
  '14:00': 14 * 60,
  '18:00': 18 * 60,
  '22:00': 22 * 60,
};
const ACTIVE_REPORT_SLOTS: ChecklistReportSlot[] = ['14:00', '18:00'];
const CONTROL_REPORT_SLOTS: ChecklistReportSlot[] = ['14:00', '18:00', '22:00'];
const DEFAULT_STUDIO: Studio = 'STAVROPOLSKAYA';
const FINANCIAL_PLAN_FORWARD_MONTHS = 36;
const CANONICAL_ADMIN_CHECKLIST_ITEMS = [
  'Проверить чистоту студии: зеркала, углы и поверхности',
  'Отправить кружок об открытии студии до 09:30',
  'Скинуть план в чат до 10:00',
  'Подключиться на планёрку в 10:10',
  'Проверить воронку «Ждем оплату» до 12:00',
  'Позвонить по воронке «Взят в работу» до 12:00',
  'Разобрать задачи в листке до 14:00',
  'Отчет по звонкам и кассе в 14:00',
  'Разобрать встречи до 15:00',
  'Разобрать заявки в течение 15 минут',
  'Отчет по звонкам и кассе в 18:00',
  'Тренировка в приложении не менее 1 раза',
  'Сделать цифру дня',
  'Проверить задачи в amoCRM, нет просрочки',
  'Подарить купон на массаж всем пробницам и отправить контакт в «МАНТРУ» с согласия клиента',
  'Поменять воронку пробницам и поставить встречу тем, кто купил',
  'Отправить в чат «Документы» документы клиентов',
  'Проверить, что в листке все отмечены и пробные проведены',
  'Сверить выручку в отчетах, кассе и таблицах',
  'Заполнить таблицы на закрытие',
  'Сделать сверку итогов по кассе и терминалу рассрочки',
  'Скинуть в чат отчет и фото чеков закрытия смены',
  'Проверить запись на завтра и поднять людей из очереди',
  'Звонки: сделать план звонков и записей',
  'Поставить терминал и телефон на зарядку',
];
const DEFAULT_ASSISTANT_CHECKLIST_ITEMS = [
  'Проверить входящие сообщения',
  'Обновить статусы задач',
  'Подготовить рабочие материалы',
];
const DEFAULT_TRAINER_CHECKLIST_ITEMS = [
  'Проверить план занятия и цели группы',
  'Подготовить зал, инвентарь и музыку',
  'Отметить посещаемость',
  'Зафиксировать комментарии по ученикам',
  'Передать старшему тренеру вопросы и риски',
];

type CreateEmployeeInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
  status?: EmployeeStatus;
};

type CreateExpenseInput = {
  date: string;
  amount: number;
  account: ExpenseAccount;
  category: string;
  studio: ExpenseStudio;
  comment?: string;
};

type TrainerEvaluationInput = Omit<TrainerEvaluationSheet, 'id' | 'createdAt' | 'createdById'>;
type StateSlice = 'bootstrap' | 'tasks' | 'content' | 'checklists' | 'control' | 'financial-plan' | 'expenses' | 'ratings' | 'team' | 'audit' | 'refunds';

type StateSliceMeta = {
  month?: string;
};

type MutationOptions = {
  showSaving?: boolean;
};

type LibraryContextValue = {
  state: LibraryState;
  currentUser: User | null;
  isDataLoading: boolean;
  isSaving: boolean;
  dataError: string | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; route?: string }>;
  resetPassword: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  resetDemoData: () => void;
  refreshState: () => Promise<void>;
  refreshSlice: (slice: StateSlice, params?: StateSliceMeta) => Promise<void>;
  usersByRole: (role?: Role) => User[];
  checklistForUser: (userId: string) => DailyChecklist | null;
  adminChecklistReports: () => OwnerChecklistReport[];
  ownerChecklistReports: () => OwnerChecklistReport[];
  createEmployee: (input: CreateEmployeeInput) => void;
  updateEmployee: (id: string, input: Partial<Pick<User, 'name' | 'email' | 'password' | 'role' | 'status'>>) => void;
  deleteEmployee: (id: string) => void;
  addCallChecklistItem: (label: string) => void;
  updateCallChecklistItem: (index: number, label: string) => void;
  deleteCallChecklistItem: (index: number) => void;
  createTask: (input: Pick<TaskTemplate, 'title' | 'period' | 'description' | 'priority'> & Partial<Pick<TaskTemplate, 'deadline'>>) => void;
  updateTask: (id: string, input: Partial<Pick<TaskTemplate, 'title' | 'period' | 'description' | 'priority' | 'status' | 'deadline'>>) => void;
  toggleTask: (id: string) => void;
  createTemplate: (input: { title: string; body: string; role: Role; businessModel?: BusinessModelScope; purpose?: string; createdById?: string }) => void;
  updateTemplate: (id: string, input: Partial<{ title: string; body: string; role: Role; purpose: string; businessModel: BusinessModelScope }>) => void;
  deleteTemplate: (id: string) => void;
  createLink: (input: { title: string; url: string; description?: string; role: Role; category?: HelpfulLink['category'] }) => void;
  updateLink: (id: string, input: Partial<Pick<HelpfulLink, 'title' | 'url' | 'description' | 'role' | 'category'>>) => void;
  deleteLink: (id: string) => void;
  createDocumentTemplate: (input: Pick<DocumentTemplate, 'title' | 'url'>) => void;
  updateDocumentTemplate: (id: string, input: Partial<Pick<DocumentTemplate, 'title' | 'url'>>) => void;
  deleteDocumentTemplate: (id: string) => void;
  createUsefulContact: (input: Omit<UsefulContact, 'id' | 'createdAt'>) => void;
  updateUsefulContact: (id: string, input: Partial<Omit<UsefulContact, 'id' | 'createdAt'>>) => void;
  deleteUsefulContact: (id: string) => void;
  createKnowledge: (input: { title: string; content: string; role: Role; category: KnowledgeCategory; businessModel?: BusinessModelScope; hashtags?: string; isActual?: boolean }) => void;
  updateKnowledge: (id: string, input: Partial<Pick<KnowledgeEntry, 'title' | 'content' | 'hashtags' | 'role' | 'category' | 'isActual' | 'businessModel'>>) => void;
  deleteKnowledge: (id: string) => void;
  createImportantInfo: (title: string, content: string, hashtags?: string) => void;
  updateImportantInfo: (id: string, input: Partial<Pick<KnowledgeEntry, 'title' | 'content' | 'hashtags'>>) => void;
  deleteImportantInfo: (id: string) => void;
  toggleChecklistItem: (checklistId: string, itemId: string, userId?: string) => void;
  confirmChecklistItems: (checklistId: string, items: Array<{ itemId: string; completed: boolean }>, userId?: string) => Promise<void>;
  addChecklistItem: (checklistId: string, label: string) => void;
  deleteChecklistItem: (checklistId: string, itemId: string) => void;
  addRoleChecklistItem: (roles: Role[], label: string) => void;
  updateRoleChecklistItem: (roles: Role[], itemIndex: number, label: string) => void;
  deleteRoleChecklistItem: (roles: Role[], itemIndex: number) => void;
  updateChecklistReport: (checklistId: string, slot: ChecklistReportSlot, input: Partial<Omit<ChecklistReport, 'slot'>>) => Promise<void>;
  activeAdminShift: (userId: string) => AdminShift | null;
  startAdminShift: (input: { userId: string; adminName: string; studio: Studio }) => Promise<void>;
  createRefund: (input: Omit<RefundCase, 'id' | 'createdAt' | 'requestedAt'> & { requestedAt?: string }) => void;
  updateRefund: (id: string, input: { amount?: number; reason?: string; status?: RefundStatus; comment?: string; clientName?: string }) => void;
  addFinancialPlanRow: (month: string, title: string) => void;
  updateFinancialPlanRow: (month: string, rowId: string, title: string) => void;
  deleteFinancialPlanRow: (month: string, rowId: string) => void;
  updateFinancialPlanCell: (month: string, rowId: string, date: string, value: string) => void;
  createExpenseCategory: (name: string) => void;
  deleteExpenseCategory: (id: string) => void;
  createExpense: (input: CreateExpenseInput) => void;
  updateExpense: (id: string, input: Partial<CreateExpenseInput>) => void;
  deleteExpense: (id: string) => void;
  createTrainerEvaluation: (input: TrainerEvaluationInput) => void;
  updateTrainerEvaluation: (id: string, input: Partial<TrainerEvaluationInput>) => void;
  deleteTrainerEvaluation: (id: string) => void;
  updateSettings: (input: Partial<AppSettings>) => void;
  toggleFavorite: (entityType: FavoriteEntityType, entityId: string) => void;
  isFavorite: (entityType: FavoriteEntityType, entityId: string, userId?: string | null) => boolean;
  favoritesForCurrentUser: () => ContentFavorite[];
  markKnowledgeAsRead: (entityId: string) => void;
  knowledgeReadReceipt: (entityId: string, userId?: string | null) => ContentReadReceipt | null;
  knowledgeReadCount: (entityId: string) => number;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function cloneState(state: LibraryState): LibraryState {
  return JSON.parse(JSON.stringify(state)) as LibraryState;
}

function createEmptyState(): LibraryState {
  const state = cloneState(initialState);
  state.users = [];
  state.tasks = [];
  state.templates = [];
  state.links = [];
  state.documentTemplates = [];
  state.usefulContacts = [];
  state.knowledge = [];
  state.checklists = [];
  state.refunds = [];
  state.financialPlans = [];
  state.expenseCategories = [];
  state.expenses = [];
  state.trainerEvaluations = [];
  state.callReviews = [];
  state.favorites = [];
  state.readReceipts = [];
  state.callChecklist = [];
  state.adminShifts = [];
  state.auditLog = [];
  return state;
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeBusinessModel(value?: string | null): BusinessModelScope {
  return value === 'SUBSCRIPTION' || value === 'MEMBERSHIP' || value === 'ALL' ? value : 'ALL';
}

function startOfTodayIso() {
  return dateKey();
}

function dateKey(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function moscowDateParts(value: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}

function moscowDateKey(value: Date = new Date()) {
  return moscowDateParts(value).date;
}

function isAdminShiftClosed(shift: AdminShift, now = new Date()) {
  if (shift.closedAt) return true;
  const current = moscowDateParts(now);
  if (shift.date < current.date) return true;
  return shift.date === current.date && current.hour >= 23;
}

function addFinancialPlanMonths(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  const date = new Date(year, monthIndex - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function daysInFinancialPlanMonth(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex, 0).getDate();
}

function clampFinancialPlanDate(targetMonth: string, sourceDate: string) {
  const sourceDay = Number(sourceDate.slice(8, 10));
  const day = Math.min(Number.isFinite(sourceDay) ? sourceDay : 1, daysInFinancialPlanMonth(targetMonth));
  return `${targetMonth}-${String(day).padStart(2, '0')}`;
}

function ensureFinancialPlan(draft: LibraryState, month: string): FinancialPlanMonth {
  let plan = draft.financialPlans.find((item) => item.month === month);
  if (!plan) {
    plan = { month, rows: [] };
    draft.financialPlans.push(plan);
  }
  return plan;
}

function ensureFinancialPlanRow(plan: FinancialPlanMonth, sourceRow: FinancialPlanRow): FinancialPlanRow {
  let row = plan.rows.find((item) => item.id === sourceRow.id);
  if (!row) {
    row = { id: sourceRow.id, title: sourceRow.title, payments: {} };
    plan.rows.push(row);
  }
  return row;
}

function normalizeFinancialPlans(plans: FinancialPlanMonth[]): FinancialPlanMonth[] {
  const normalized = { financialPlans: cloneState(plans) } as LibraryState;
  const sourceRowsById = new Map<string, { month: string; row: FinancialPlanRow }>();
  [...plans]
    .sort((left, right) => left.month.localeCompare(right.month))
    .forEach((plan) => {
      plan.rows.forEach((row) => {
        if (!sourceRowsById.has(row.id)) sourceRowsById.set(row.id, { month: plan.month, row });
      });
    });
  const sourceRows = Array.from(sourceRowsById.values());
  sourceRows.forEach(({ month, row }) => {
    for (let index = 0; index <= FINANCIAL_PLAN_FORWARD_MONTHS; index += 1) {
      const targetMonth = addFinancialPlanMonths(month, index);
      const targetPlan = ensureFinancialPlan(normalized, targetMonth);
      const targetRow = ensureFinancialPlanRow(targetPlan, row);
      targetRow.title = targetRow.title || row.title;
      Object.entries(row.payments || {}).forEach(([date, value]) => {
        if (!date.startsWith(month) || !String(value).trim()) return;
        const targetDate = index === 0 ? date : clampFinancialPlanDate(targetMonth, date);
        if (targetRow.payments[targetDate] === undefined) targetRow.payments[targetDate] = value;
      });
    }
  });
  return normalized.financialPlans.sort((left, right) => left.month.localeCompare(right.month));
}

function checklistDateKey(checklist: Pick<DailyChecklist, 'date' | 'createdAt'>) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(checklist.date)) return checklist.date;
  return dateKey(checklist.date) || dateKey(checklist.createdAt);
}

function isToday(value?: string | null) {
  if (!value) return false;
  return dateKey(value) === dateKey();
}

function latestIso(left?: string | null, right?: string | null) {
  const leftTime = left ? new Date(left).getTime() : -1;
  const rightTime = right ? new Date(right).getTime() : -1;
  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return null;
  if (Number.isNaN(leftTime)) return right ?? null;
  if (Number.isNaN(rightTime)) return left ?? null;
  return leftTime >= rightTime ? left ?? null : right ?? null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase().replace('@levtia.com', '@levita.ru');
}

function blankReport(slot: ChecklistReportSlot, adminName: string): ChecklistReport {
  return {
    slot,
    studio: DEFAULT_STUDIO,
    adminName,
    calls: '',
    reached: '',
    bookings: '',
    cash: '',
    came: '',
    bought: '',
    submittedAt: null,
    sentToTelegram: false,
    telegramSentAt: null,
    sentToMax: false,
    maxSentAt: null,
    maxSendError: null,
    maxMessageId: null,
  };
}

function createDailyChecklist(user: User): DailyChecklist {
  const isAdminRole = user.role === 'ADMIN' || user.role === 'SENIOR_ADMIN';
  const isTrainerRole = user.role === 'TRAINER' || user.role === 'SENIOR_TRAINER';
  const finalLabels = isAdminRole
    ? CANONICAL_ADMIN_CHECKLIST_ITEMS
    : isTrainerRole
      ? DEFAULT_TRAINER_CHECKLIST_ITEMS
      : DEFAULT_ASSISTANT_CHECKLIST_ITEMS;

  return {
    id: newId('checklist'),
    title: isAdminRole ? 'Чек-лист администратора на смену' : isTrainerRole ? 'Чек-лист тренировки' : 'Чек-лист дня',
    role: user.role,
    assignedTo: user.id,
    date: startOfTodayIso(),
    createdAt: new Date().toISOString(),
    reports: isAdminRole ? ACTIVE_REPORT_SLOTS.map((slot) => blankReport(slot, user.name)) : [],
    items: finalLabels.map((label) => ({
      id: newId('checklist-item'),
      label,
      completed: false,
      completedAt: null,
      completedBy: null,
    })),
  };
}

function normalizeChecklistReportForToday(report: ChecklistReport) {
  const submittedAt = isToday(report.submittedAt) ? report.submittedAt ?? null : null;
  const telegramSentAt = isToday(report.telegramSentAt) ? report.telegramSentAt ?? null : null;
  const maxSentAt = isToday(report.maxSentAt) ? report.maxSentAt ?? null : null;
  return {
    ...report,
    submittedAt,
    sentToTelegram: Boolean(submittedAt && (report.sentToTelegram || telegramSentAt)),
    telegramSentAt: submittedAt ? telegramSentAt : null,
    sentToMax: Boolean(submittedAt && (report.sentToMax || maxSentAt)),
    maxSentAt: submittedAt ? maxSentAt : null,
    maxSendError: submittedAt ? report.maxSendError ?? null : null,
    maxMessageId: submittedAt ? report.maxMessageId ?? null : null,
  };
}

function mergeChecklistReports(left: ChecklistReport[], right: ChecklistReport[]) {
  return ACTIVE_REPORT_SLOTS.map((slot) => {
    const primary = left.find((report) => report.slot === slot);
    const incoming = right.find((report) => report.slot === slot);
    const report = { ...blankReport(slot, primary?.adminName || incoming?.adminName || ''), ...primary, ...incoming };
    const submittedAt = latestIso(primary?.submittedAt, incoming?.submittedAt);
    const telegramSentAt = latestIso(primary?.telegramSentAt, incoming?.telegramSentAt);
    const maxSentAt = latestIso(primary?.maxSentAt, incoming?.maxSentAt);
    return normalizeChecklistReportForToday({
      ...report,
      submittedAt,
      sentToTelegram: Boolean((primary?.sentToTelegram || incoming?.sentToTelegram) && submittedAt),
      telegramSentAt,
      sentToMax: Boolean((primary?.sentToMax || incoming?.sentToMax) && submittedAt),
      maxSentAt,
      maxSendError: primary?.maxSendError ?? incoming?.maxSendError ?? null,
      maxMessageId: primary?.maxMessageId ?? incoming?.maxMessageId ?? null,
      studio: primary?.studio ?? incoming?.studio ?? DEFAULT_STUDIO,
    });
  });
}

function normalizeChecklistReportForDate(report: ChecklistReport, targetDate: string) {
  if (targetDate === dateKey()) return normalizeChecklistReportForToday(report);
  return {
    ...report,
    submittedAt: report.submittedAt ?? null,
    sentToTelegram: Boolean(report.sentToTelegram),
    telegramSentAt: report.telegramSentAt ?? (report.sentToTelegram ? report.submittedAt ?? null : null),
    sentToMax: Boolean(report.sentToMax),
    maxSentAt: report.maxSentAt ?? (report.sentToMax ? report.submittedAt ?? null : null),
    maxSendError: report.maxSendError ?? null,
    maxMessageId: report.maxMessageId ?? null,
    studio: report.studio ?? DEFAULT_STUDIO,
  };
}

function mergeChecklistReportsForDate(left: ChecklistReport[], right: ChecklistReport[], targetDate: string) {
  return ACTIVE_REPORT_SLOTS.map((slot) => {
    const primary = left.find((report) => report.slot === slot);
    const incoming = right.find((report) => report.slot === slot);
    const report = { ...blankReport(slot, primary?.adminName || incoming?.adminName || ''), ...primary, ...incoming };
    const submittedAt = latestIso(primary?.submittedAt, incoming?.submittedAt);
    const telegramSentAt = latestIso(primary?.telegramSentAt, incoming?.telegramSentAt);
    const maxSentAt = latestIso(primary?.maxSentAt, incoming?.maxSentAt);
    return normalizeChecklistReportForDate({
      ...report,
      submittedAt,
      sentToTelegram: Boolean((primary?.sentToTelegram || incoming?.sentToTelegram) && submittedAt),
      telegramSentAt,
      sentToMax: Boolean((primary?.sentToMax || incoming?.sentToMax) && submittedAt),
      maxSentAt,
      maxSendError: primary?.maxSendError ?? incoming?.maxSendError ?? null,
      maxMessageId: primary?.maxMessageId ?? incoming?.maxMessageId ?? null,
      studio: primary?.studio ?? incoming?.studio ?? DEFAULT_STUDIO,
    }, targetDate);
  });
}

function mergeChecklistItems(left: DailyChecklist['items'], right: DailyChecklist['items'], isAdminRole: boolean, targetDate = dateKey()) {
  const maxLength = Math.max(left.length, right.length, isAdminRole ? CANONICAL_ADMIN_CHECKLIST_ITEMS.length : 0);
  return Array.from({ length: maxLength }, (_, index) => {
    const primary = left[index];
    const incoming = right[index];
    const label = isAdminRole && index < CANONICAL_ADMIN_CHECKLIST_ITEMS.length
      ? CANONICAL_ADMIN_CHECKLIST_ITEMS[index]
      : primary?.label ?? incoming?.label ?? '';
    const completedAt = latestIso(primary?.completedAt, incoming?.completedAt);
    const completed = targetDate === dateKey()
      ? Boolean(completedAt && isToday(completedAt))
      : Boolean(primary?.completed || incoming?.completed || completedAt);
    return {
      id: primary?.id ?? incoming?.id ?? newId('checklist-item'),
      label,
      completed,
      completedAt: completed ? completedAt : null,
      completedBy: completed ? primary?.completedBy ?? incoming?.completedBy ?? null : null,
    };
  }).filter((item) => item.label.trim());
}

function mergeUserChecklists(existing: DailyChecklist, incoming: DailyChecklist, assignee?: User) {
  const isAdminRole = assignee?.role === 'ADMIN' || assignee?.role === 'SENIOR_ADMIN' || existing.role === 'ADMIN' || existing.role === 'SENIOR_ADMIN' || incoming.role === 'ADMIN' || incoming.role === 'SENIOR_ADMIN';
  const targetDate = checklistDateKey(existing) || checklistDateKey(incoming) || dateKey();
  return {
    ...existing,
    role: assignee?.role ?? existing.role,
    date: targetDate,
    createdAt: latestIso(existing.createdAt, incoming.createdAt) ?? existing.createdAt,
    title: existing.title || incoming.title,
    items: mergeChecklistItems(existing.items, incoming.items, isAdminRole, targetDate),
    reports: isAdminRole ? mergeChecklistReportsForDate(existing.reports, incoming.reports, targetDate) : [],
  };
}

function normalizeState(raw: Partial<LibraryState> | null): LibraryState {
  const base = createEmptyState();
  if (!raw || !Array.isArray(raw.users)) return base;

  const users = raw.users.map((user) => ({
    ...user,
    email: normalizeEmail(user.email || ''),
    password: user.password ?? '',
    passwordHash: user.passwordHash ?? undefined,
    status: user.status === 'on-leave' ? 'blocked' : user.status || 'active',
    createdAt: user.createdAt || new Date().toISOString(),
    joinDate: user.joinDate || 'май 2026',
  })) as User[];

  const adminShifts = (raw.adminShifts || []).map((shift) => ({
    ...shift,
    studio: shift.studio ?? DEFAULT_STUDIO,
    remindersScheduledAt: shift.remindersScheduledAt ?? null,
    reminderScheduleError: shift.reminderScheduleError === 'shiftId, adminName and date are required' ? null : shift.reminderScheduleError ?? null,
  })) as AdminShift[];

  const today = dateKey();
  const normalizedChecklists = (raw.checklists || [])
    .filter((checklist) => users.some((user) => user.id === checklist.assignedTo))
    .map((checklist) => {
      const assignee = users.find((user) => user.id === checklist.assignedTo);
      const isAdminRole = assignee?.role === 'ADMIN' || assignee?.role === 'SENIOR_ADMIN' || checklist.role === 'ADMIN' || checklist.role === 'SENIOR_ADMIN';
      const targetDate = checklistDateKey(checklist) || today;
      const isTodayChecklist = targetDate === today;
      return {
        ...checklist,
        role: assignee?.role ?? checklist.role,
        date: targetDate,
        items: Array.isArray(checklist.items)
          ? checklist.items.map((item, index) => ({
              ...item,
              label: isAdminRole && index < CANONICAL_ADMIN_CHECKLIST_ITEMS.length ? CANONICAL_ADMIN_CHECKLIST_ITEMS[index] : item.label,
              completed: isTodayChecklist ? Boolean(item.completedAt && isToday(item.completedAt)) : Boolean(item.completed || item.completedAt),
              completedAt: isTodayChecklist ? (item.completedAt && isToday(item.completedAt) ? item.completedAt : null) : item.completedAt ?? null,
              completedBy: isTodayChecklist ? (item.completedAt && isToday(item.completedAt) ? item.completedBy ?? null : null) : item.completedBy ?? null,
            }))
          : [],
        reports: isAdminRole
          ? ACTIVE_REPORT_SLOTS.map((slot) => {
              const existing = checklist.reports?.find((report) => report.slot === slot);
              const report = { ...blankReport(slot, assignee?.name ?? ''), ...existing };
              return {
                ...normalizeChecklistReportForDate({
                  ...report,
                  telegramSentAt: report.telegramSentAt ?? (report.sentToTelegram ? report.submittedAt ?? null : null),
                  maxSentAt: report.maxSentAt ?? (report.sentToMax ? report.submittedAt ?? null : null),
                }, targetDate),
              };
            })
          : [],
      };
    });
  const checklistsByUser = new Map<string, DailyChecklist>();
  normalizedChecklists.forEach((checklist) => {
    const assignee = users.find((user) => user.id === checklist.assignedTo);
    const key = `${checklist.assignedTo}:${checklistDateKey(checklist) || today}`;
    const existing = checklistsByUser.get(key);
    checklistsByUser.set(
      key,
      existing ? mergeUserChecklists(existing, checklist, assignee) : mergeUserChecklists(checklist, checklist, assignee),
    );
  });
  const checklists = Array.from(checklistsByUser.values());
  users.forEach((user) => {
    const needsChecklist = user.role === 'ADMIN' || user.role === 'SENIOR_ADMIN' || user.role === 'ASSISTANT' || user.role === 'TRAINER' || user.role === 'SENIOR_TRAINER';
    const hasChecklist = checklists.some((checklist) => checklist.assignedTo === user.id && checklistDateKey(checklist) === today);
    if (needsChecklist && !hasChecklist) checklists.unshift(createDailyChecklist(user));
  });

  return {
    ...base,
    ...raw,
    schemaVersion: Math.max(Number(raw.schemaVersion) || 0, base.schemaVersion ?? 1),
    users,
    checklists,
    tasks: (raw.tasks ?? []).map((task) => ({ ...task, ownerUserId: undefined })),
    templates: (raw.templates ?? []).map((template) => ({ ...template, ownerUserId: undefined, businessModel: normalizeBusinessModel(template.businessModel) })),
    links: (raw.links ?? []).map((link) => ({ ...link, ownerUserId: undefined })),
    documentTemplates: raw.documentTemplates ?? [],
    usefulContacts: raw.usefulContacts ?? [],
    knowledge: (raw.knowledge ?? []).map((entry) => ({ ...entry, businessModel: normalizeBusinessModel(entry.businessModel) })),
    financialPlans: normalizeFinancialPlans(raw.financialPlans ?? []),
    expenseCategories: raw.expenseCategories ?? [],
    expenses: raw.expenses ?? [],
    trainerEvaluations: (raw.trainerEvaluations ?? []).map((evaluation) => ({
      ...evaluation,
      score: Number(evaluation.score) || 0,
      evaluatedAt: /^\d{4}-\d{2}-\d{2}$/.test(evaluation.evaluatedAt) ? evaluation.evaluatedAt : dateKey(evaluation.evaluatedAt) || dateKey(),
      createdById: evaluation.createdById ?? null,
    })),
    callReviews: (raw.callReviews ?? []).map((review) => ({
      ...review,
      source: 'levita-calls',
      score: Number(review.score) || 0,
      reviewedAt: /^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt) ? review.reviewedAt : dateKey(review.reviewedAt) || dateKey(),
      amoCrmDealUrl: review.amoCrmDealUrl ?? null,
      callUrl: review.callUrl ?? null,
      originalFilename: review.originalFilename ?? null,
      comment: review.comment ?? null,
      updatedAt: review.updatedAt || review.createdAt || new Date().toISOString(),
    })) as CallReview[],
    favorites: (raw.favorites ?? []).filter((favorite) => (
      typeof favorite?.userId === 'string'
      && typeof favorite?.entityType === 'string'
      && typeof favorite?.entityId === 'string'
    )) as ContentFavorite[],
    readReceipts: (raw.readReceipts ?? []).filter((receipt) => (
      typeof receipt?.userId === 'string'
      && receipt?.entityType === 'knowledge'
      && typeof receipt?.entityId === 'string'
    )) as ContentReadReceipt[],
    adminShifts,
    auditLog: (raw.auditLog ?? []).slice(0, 500),
    settings: { ...base.settings, ...(raw.settings || {}) },
  };
}

function loadLocalSettings(): Partial<AppSettings> {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<AppSettings>;
  } catch {
    return {};
  }
}

function applyLocalSettings(state: LibraryState): LibraryState {
  const settings = loadLocalSettings();
  return normalizeState({ ...state, settings: { ...state.settings, ...settings } });
}

function stateForDatabase(state: LibraryState): LibraryState {
  return { ...state, settings: initialState.settings };
}

function loadState() {
  return applyLocalSettings(createEmptyState());
}

async function loadDatabaseState() {
  const response = await fetch('/api/state', { cache: 'no-store' });
  if (!response.ok) throw new Error('Не удалось загрузить данные из базы.');
  const payload = await response.json() as { state: Partial<LibraryState> | null };
  return payload.state ? applyLocalSettings(normalizeState(payload.state)) : null;
}

async function loadDatabaseSlice(slice: StateSlice, params: StateSliceMeta = {}) {
  const query = new URLSearchParams({ slice });
  if (params.month) query.set('month', params.month);
  const response = await fetch(`/api/state-slice?${query.toString()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(await readApiError(response));
  return response.json() as Promise<{ state: Partial<LibraryState> | null; sliceMeta?: StateSliceMeta }>;
}

function mergeStateSlice(current: LibraryState, patch: Partial<LibraryState> | null, sliceMeta: StateSliceMeta = {}) {
  if (!patch) return current;
  const next = cloneState(current);
  const keys = Object.keys(patch) as Array<keyof LibraryState>;
  keys.forEach((key) => {
    if (key === 'financialPlans' && sliceMeta.month) {
      const incomingPlans = patch.financialPlans ?? [];
      next.financialPlans = [
        ...next.financialPlans.filter((plan) => plan.month !== sliceMeta.month),
        ...incomingPlans,
      ];
      return;
    }
    if (key === 'expenses' && sliceMeta.month) {
      const incomingExpenses = patch.expenses ?? [];
      next.expenses = [
        ...next.expenses.filter((expense) => !expense.date.startsWith(sliceMeta.month ?? '')),
        ...incomingExpenses,
      ];
      return;
    }
    (next as Record<string, unknown>)[key] = patch[key];
  });
  return applyLocalSettings(normalizeState(next));
}

async function saveDatabaseState(state: LibraryState) {
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: stateForDatabase(state) }),
  });
  if (!response.ok) throw new Error('Не удалось сохранить данные в базе.');
}

async function readApiError(response: Response) {
  const payload = await response.json().catch(() => ({}));
  return typeof payload.error === 'string' ? payload.error : 'Операция не выполнена.';
}

async function loginOnServer(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return { ok: false as const, error: await readApiError(response) };
  return await response.json() as { ok: true; user: User; route: string };
}

async function resetPasswordOnServer(email: string, password: string) {
  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return { ok: false as const, error: await readApiError(response) };
  return await response.json() as { ok: true };
}

async function sendMaxChecklistReport(input: {
  checklistId: string;
  checklistDate: string;
  assigneeName: string;
  assigneeRole: Role;
  slot: ChecklistReportSlot;
  report: ChecklistReport;
}) {
  const response = await fetch('/api/max/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const payload = await response.json() as { ok: boolean; sentAt: string | null; messageId?: string | null; error?: string };
  if (!payload.ok) throw new Error(payload.error || 'MAX report was not sent.');
  return payload as { ok: boolean; sentAt: string; messageId?: string | null };
}

async function scheduleMaxShiftReminders(input: { shiftId: string; adminName: string; studio: Studio; date: string }) {
  const response = await fetch('/api/max/shift-reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return await response.json() as { ok: boolean; scheduled: Array<{ slot: ChecklistReportSlot; scheduledFor: string }> };
}

const REQUIRED_REPORT_FIELDS: Array<keyof Pick<ChecklistReport, 'adminName' | 'calls' | 'reached' | 'bookings' | 'cash' | 'came' | 'bought'>> = [
  'adminName',
  'calls',
  'reached',
  'bookings',
  'cash',
  'came',
  'bought',
];

function isReportReady(report: Partial<ChecklistReport>) {
  return REQUIRED_REPORT_FIELDS.every((field) => String(report[field] ?? '').trim().length > 0);
}

function getMinutes(value?: string | null) {
  if (!value) return -1;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return -1;
  return date.getHours() * 60 + date.getMinutes();
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function isReportItemLabel(label: string, slot: ChecklistReportSlot) {
  const normalized = normalizeText(label);
  if ((slot === '14:00' || slot === '18:00') && normalized.includes(slot)) return true;
  return REPORT_ALIASES[slot].some((alias) => normalizeText(alias) === normalized);
}

function findReportItem(checklist: DailyChecklist, slot: ChecklistReportSlot) {
  const exact = checklist.items.find((entry) => isReportItemLabel(entry.label, slot));
  if (exact) return exact;
  if (slot === '22:00') {
    return checklist.items.find((entry) => {
      const normalized = normalizeText(entry.label);
      return normalized.includes('терминал') && normalized.includes('заряд');
    }) ?? checklist.items[checklist.items.length - 1] ?? null;
  }
  return null;
}

function findReportSlotByItem(checklist: DailyChecklist, itemId: string) {
  return CONTROL_REPORT_SLOTS.find((slot) => findReportItem(checklist, slot)?.id === itemId) ?? null;
}

function getReportStatus(checklist: DailyChecklist, slot: ChecklistReportSlot): ChecklistControlStatus {
  const item = findReportItem(checklist, slot);
  const report = checklist.reports.find((entry) => entry.slot === slot);
  const completedAt = report?.submittedAt || item?.completedAt || null;
  const minutes = getMinutes(completedAt);
  const submitted = Boolean(completedAt && (item?.completed || report?.submittedAt));
  const onTime = submitted && minutes > -1 && minutes <= REPORT_DEADLINES[slot];
  const telegramSentAt = report?.telegramSentAt || (report?.sentToTelegram ? completedAt : null);
  const telegramMinutes = getMinutes(telegramSentAt);
  const telegramSent = Boolean(telegramSentAt || report?.sentToTelegram);
  const telegramOnTime = telegramSent && telegramMinutes > -1 && telegramMinutes <= REPORT_DEADLINES[slot];
  const maxSentAt = report?.maxSentAt || (report?.sentToMax ? completedAt : null) || telegramSentAt;
  const maxMinutes = getMinutes(maxSentAt);
  const maxSent = Boolean(maxSentAt || report?.sentToMax || telegramSent);
  const maxOnTime = maxSent && maxMinutes > -1 && maxMinutes <= REPORT_DEADLINES[slot];

  return {
    done: onTime,
    submitted,
    onTime,
    label: item?.label ?? REPORT_ALIASES[slot][0],
    studio: report?.studio ?? DEFAULT_STUDIO,
    completedAt,
    telegramSent,
    telegramSentAt,
    telegramOnTime,
    maxSent,
    maxSentAt,
    maxOnTime,
    maxSendError: report?.maxSendError ?? null,
  };
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>(() => loadState());
  const [databaseReady, setDatabaseReady] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const checklistToggleQueueRef = useRef<Promise<void>>(Promise.resolve());
  const checklistToggleVersionRef = useRef(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(SESSION_USER_KEY);
  });

  const refreshState = async () => {
    setIsDataLoading(true);
    try {
      const databaseState = await loadDatabaseState();
      if (databaseState) {
        setDatabaseReady(true);
        setState(databaseState);
        setDataError(null);
        return;
      }
    } catch (error) {
      console.error(error);
      setDataError(error instanceof Error ? error.message : 'Не удалось загрузить данные.');
    } finally {
      setIsDataLoading(false);
    }

    setDatabaseReady(false);
    setState(loadState());
  };

  const refreshSlice = async (slice: StateSlice, params: StateSliceMeta = {}) => {
    setIsDataLoading(true);
    try {
      const payload = await loadDatabaseSlice(slice, params);
      setDatabaseReady(true);
      setState((current) => mergeStateSlice(current, payload.state, payload.sliceMeta ?? params));
      setDataError(null);
    } catch (error) {
      console.error(error);
      setDataError(error instanceof Error ? error.message : 'Не удалось загрузить данные вкладки.');
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    void refreshState();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentUserId) window.sessionStorage.setItem(SESSION_USER_KEY, currentUserId);
    else window.sessionStorage.removeItem(SESSION_USER_KEY);
  }, [currentUserId]);

  const currentUser = useMemo(
    () => state.users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, state.users],
  );

  const runMutation = async (
    action: string,
    payload: Record<string, unknown> = {},
    optimistic?: (draft: LibraryState) => void,
    options: MutationOptions = {},
  ) => {
    const showSaving = options.showSaving ?? true;
    if (showSaving) setIsSaving(true);
    setDataError(null);
    if (optimistic) {
      setState((current) => {
        const draft = cloneState(current);
        optimistic(draft);
        return normalizeState(draft);
      });
    }
    try {
      const response = await fetch('/api/mutations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload, actorId: currentUserId, returnState: !optimistic }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const result = await response.json() as { state: Partial<LibraryState> | null; skipRefresh?: boolean };
      if (result.state) {
        setDatabaseReady(true);
        setState(applyLocalSettings(normalizeState(result.state)));
      } else if (!result.skipRefresh) {
        await refreshState();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить данные.';
      console.error(error);
      setDataError(message);
      await refreshState();
    } finally {
      if (showSaving) setIsSaving(false);
    }
  };

  const mutateOnServer = (
    action: string,
    payload: Record<string, unknown> = {},
    optimistic?: (draft: LibraryState) => void,
    options?: MutationOptions,
  ) => {
    void runMutation(action, payload, optimistic, options);
  };

  const runChecklistToggleMutation = (
    payload: Record<string, unknown>,
    optimistic: (draft: LibraryState) => void,
  ) => {
    const version = checklistToggleVersionRef.current + 1;
    checklistToggleVersionRef.current = version;
    setDataError(null);
    setState((current) => {
      const draft = cloneState(current);
      optimistic(draft);
      return normalizeState(draft);
    });

    checklistToggleQueueRef.current = checklistToggleQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch('/api/mutations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'checklist.item.toggle', payload, actorId: currentUserId, returnState: false }),
        });
        if (!response.ok) throw new Error(await readApiError(response));
        const result = await response.json() as { state: Partial<LibraryState> | null };
        if (version === checklistToggleVersionRef.current && result.state) {
          setDatabaseReady(true);
          setState(applyLocalSettings(normalizeState(result.state)));
        }
      })
      .catch(async (error) => {
        const message = error instanceof Error ? error.message : 'Не удалось сохранить пункт чек-листа.';
        console.error(error);
        setDataError(message);
        if (version === checklistToggleVersionRef.current) await refreshState();
      });
  };

  const pushAudit = (
    draft: LibraryState,
    action: AuditAction,
    entityType: string,
    entityLabel: string,
    options: { entityId?: string | null; description?: string | null; actor?: User | null } = {},
  ) => {
    const actor = options.actor ?? currentUser;
    draft.auditLog = [
      {
        id: newId('audit'),
        action,
        entityType,
        entityId: options.entityId ?? null,
        entityLabel,
        description: options.description ?? null,
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? 'Система',
        actorRole: actor?.role ?? null,
        createdAt: new Date().toISOString(),
      },
      ...(draft.auditLog || []),
    ].slice(0, 500);
  };

  const update = (mutator: (draft: LibraryState) => void, persist = true) => {
    setState((current) => {
      const draft = cloneState(current);
      mutator(draft);
      const nextState = normalizeState(draft);
      return nextState;
    });
  };

  const buildAdminChecklistReports = () =>
    state.checklists
      .map((checklist) => {
        const assignee = state.users.find((user) => user.id === checklist.assignedTo);
        if (!assignee) return null;
        if (assignee.role !== 'ADMIN' && assignee.role !== 'SENIOR_ADMIN') return null;
        return {
          checklist,
          assignee,
          completedCount: checklist.items.filter((item) => item.completed).length,
          report14: getReportStatus(checklist, '14:00'),
          report18: getReportStatus(checklist, '18:00'),
          report22: getReportStatus(checklist, '22:00'),
        };
      })
      .filter(Boolean) as OwnerChecklistReport[];

  const value = useMemo<LibraryContextValue>(() => ({
    state,
    currentUser,
    isDataLoading,
    isSaving,
    dataError,
    async login(email, password) {
      const normalized = normalizeEmail(email);
      if (!normalized || !password.trim()) return { ok: false, error: 'Введите email и пароль.' };
      let result = await loginOnServer(normalized, password);
      if (!result.ok) {
        const databaseState = await loadDatabaseState();
        if (!databaseState) return result;
        result = await loginOnServer(normalized, password);
      }
      if (!result.ok) return result;
      const databaseState = await loadDatabaseState();
      if (databaseState) {
        const nextState = normalizeState(databaseState);
        pushAudit(nextState, 'auth.login', 'user', result.user.name, {
          entityId: result.user.id,
          description: 'Вход в приложение через серверную авторизацию.',
          actor: result.user,
        });
        setDatabaseReady(true);
        setState(nextState);
      }
      setCurrentUserId(result.user.id);
      return { ok: true, route: result.route ?? roleRoutes[result.user.role] };
    },
    async resetPassword(email, password) {
      const normalized = normalizeEmail(email);
      const nextPassword = password.trim();
      if (!normalized || !nextPassword) return { ok: false, error: 'Введите email и новый пароль.' };
      if (nextPassword.length < 6) return { ok: false, error: 'Пароль должен быть не короче 6 символов.' };
      const result = await resetPasswordOnServer(normalized, nextPassword);
      if (!result.ok) return result;
      const databaseState = await loadDatabaseState();
      if (databaseState) {
        const user = databaseState.users.find((item) => normalizeEmail(item.email) === normalized);
        pushAudit(databaseState, 'auth.password_reset', 'user', user?.name ?? normalized, {
          entityId: user?.id ?? null,
          description: 'Пароль изменён через форму восстановления.',
          actor: user ?? currentUser,
        });
        setDatabaseReady(true);
        setState(databaseState);
      }
      return { ok: true };
    },
    logout() {
      setCurrentUserId(null);
    },
    resetDemoData() {
      void fetch('/api/reset', { method: 'POST' }).then(() => refreshState());
      setCurrentUserId(null);
    },
    refreshState,
    refreshSlice,
    usersByRole(role) {
      return role ? state.users.filter((user) => user.role === role) : state.users;
    },
    checklistForUser(userId) {
      return state.checklists.find((checklist) => checklist.assignedTo === userId && checklistDateKey(checklist) === dateKey()) ?? null;
    },
    adminChecklistReports() {
      return buildAdminChecklistReports();
    },
    ownerChecklistReports() {
      return buildAdminChecklistReports();
    },
    createEmployee(input) {
      const now = new Date().toISOString();
      const user: User = {
        id: newId('user'),
        name: input.name.trim(),
        email: normalizeEmail(input.email),
        password: input.password,
        role: input.role,
        status: input.status ?? 'active',
        joinDate: dateKey(now),
        createdAt: now,
      };
      mutateOnServer('employee.create', user as unknown as Record<string, unknown>, (draft) => {
        draft.users.push(user);
      });
    },
    updateEmployee(id, input) {
      mutateOnServer('employee.update', { id, input }, (draft) => {
        const user = draft.users.find((item) => item.id === id);
        if (user) Object.assign(user, input);
      });
    },
    deleteEmployee(id) {
      const user = state.users.find((item) => item.id === id);
      if (!user || user.role === 'OWNER') return;
      mutateOnServer('employee.delete', { id }, (draft) => {
        draft.users = draft.users.filter((item) => item.id !== id);
        draft.checklists = draft.checklists.filter((item) => item.assignedTo !== id);
        draft.adminShifts = draft.adminShifts.filter((item) => item.userId !== id);
      });
    },
    addCallChecklistItem(label) {
      if (!label.trim()) return;
      mutateOnServer('callChecklist.add', { label: label.trim() });
    },
    updateCallChecklistItem(index, label) {
      if (!label.trim()) return;
      mutateOnServer('callChecklist.update', { index, label: label.trim() });
    },
    deleteCallChecklistItem(index) {
      mutateOnServer('callChecklist.delete', { index });
    },
    createTask(input) {
      const task: TaskTemplate = { id: newId('task'), role: 'ASSISTANT', status: 'pending', createdAt: new Date().toISOString(), ...input };
      mutateOnServer('task.create', task as unknown as Record<string, unknown>, (draft) => {
        draft.tasks.push(task);
      });
    },
    updateTask(id, input) {
      mutateOnServer('task.update', { id, input }, (draft) => {
        const task = draft.tasks.find((item) => item.id === id);
        if (task) Object.assign(task, input);
      });
    },
    toggleTask(id) {
      mutateOnServer('task.toggle', { id }, (draft) => {
        const task = draft.tasks.find((item) => item.id === id);
        if (task) task.status = task.status === 'completed' ? 'pending' : 'completed';
      });
    },
    createTemplate(input) {
      const template = {
        id: newId('template'),
        ...input,
        businessModel: normalizeBusinessModel(input.businessModel),
        purpose: input.purpose ?? '',
        createdById: input.createdById ?? currentUser?.id ?? null,
        createdAt: new Date().toISOString(),
      };
      mutateOnServer('template.create', template as unknown as Record<string, unknown>, (draft) => {
        draft.templates.unshift(template as ResponseTemplate);
      });
    },
    updateTemplate(id, input) {
      mutateOnServer('template.update', { id, input }, (draft) => {
        const template = draft.templates.find((item) => item.id === id);
        if (template) Object.assign(template, input);
      });
    },
    deleteTemplate(id) {
      mutateOnServer('template.delete', { id }, (draft) => {
        draft.templates = draft.templates.filter((item) => item.id !== id);
      });
    },
    createLink(input) {
      const link: HelpfulLink = {
        id: newId('link'),
        ...input,
        category: input.category ?? 'HELPFUL',
        description: input.description ?? '',
        createdAt: new Date().toISOString(),
      };
      mutateOnServer('link.create', link as unknown as Record<string, unknown>, (draft) => {
        draft.links.unshift(link);
      });
    },
    updateLink(id, input) {
      mutateOnServer('link.update', { id, input }, (draft) => {
        const link = draft.links.find((item) => item.id === id);
        if (link) Object.assign(link, input);
      });
    },
    deleteLink(id) {
      mutateOnServer('link.delete', { id }, (draft) => {
        draft.links = draft.links.filter((item) => item.id !== id);
      });
    },
    createDocumentTemplate(input) {
      const template: DocumentTemplate = { id: newId('document-template'), ...input, createdById: currentUser?.id ?? null, createdAt: new Date().toISOString() };
      mutateOnServer('documentTemplate.create', template as unknown as Record<string, unknown>, (draft) => {
        draft.documentTemplates.unshift(template);
      });
    },
    updateDocumentTemplate(id, input) {
      mutateOnServer('documentTemplate.update', { id, input }, (draft) => {
        const template = draft.documentTemplates.find((item) => item.id === id);
        if (template) Object.assign(template, input);
      });
    },
    deleteDocumentTemplate(id) {
      mutateOnServer('documentTemplate.delete', { id }, (draft) => {
        draft.documentTemplates = draft.documentTemplates.filter((item) => item.id !== id);
      });
    },
    createUsefulContact(input) {
      const contact: UsefulContact = { id: newId('contact'), ...input, createdAt: new Date().toISOString() };
      mutateOnServer('usefulContact.create', contact as unknown as Record<string, unknown>, (draft) => {
        draft.usefulContacts.unshift(contact);
      });
    },
    updateUsefulContact(id, input) {
      mutateOnServer('usefulContact.update', { id, input }, (draft) => {
        const contact = draft.usefulContacts.find((item) => item.id === id);
        if (contact) Object.assign(contact, input);
      });
    },
    deleteUsefulContact(id) {
      mutateOnServer('usefulContact.delete', { id }, (draft) => {
        draft.usefulContacts = draft.usefulContacts.filter((item) => item.id !== id);
      });
    },
    createKnowledge(input) {
      const entry: KnowledgeEntry = {
        id: newId('knowledge'),
        title: input.title,
        content: input.content,
        role: input.role,
        category: input.category,
        businessModel: normalizeBusinessModel(input.businessModel),
        hashtags: normalizeHashtags(input.hashtags ?? '') || null,
        isActual: input.isActual !== false,
        searchable: true,
        createdAt: new Date().toISOString(),
      };
      mutateOnServer('knowledge.create', entry as unknown as Record<string, unknown>, (draft) => {
        draft.knowledge.unshift(entry);
      });
    },
    updateKnowledge(id, input) {
      const normalizedInput = { ...input, businessModel: input.businessModel ? normalizeBusinessModel(input.businessModel) : undefined, hashtags: input.hashtags !== undefined ? normalizeHashtags(input.hashtags) : undefined };
      mutateOnServer('knowledge.update', { id, input: normalizedInput }, (draft) => {
        const entry = draft.knowledge.find((item) => item.id === id);
        if (entry) Object.assign(entry, normalizedInput);
      });
    },
    deleteKnowledge(id) {
      mutateOnServer('knowledge.delete', { id }, (draft) => {
        draft.knowledge = draft.knowledge.filter((item) => item.id !== id);
      });
    },
    createImportantInfo(title, content, hashtags) {
      const entry: KnowledgeEntry = {
        id: newId('knowledge'),
        title,
        content,
        role: 'ADMIN',
        category: 'IMPORTANT_INFO',
        businessModel: 'ALL',
        hashtags: normalizeHashtags(hashtags ?? '') || null,
        isActual: true,
        searchable: true,
        createdAt: new Date().toISOString(),
      };
      mutateOnServer('knowledge.create', entry as unknown as Record<string, unknown>, (draft) => {
        draft.knowledge.unshift(entry);
      });
    },
    updateImportantInfo(id, input) {
      const normalizedInput = { ...input, hashtags: input.hashtags !== undefined ? normalizeHashtags(input.hashtags) : undefined };
      mutateOnServer('knowledge.update', { id, input: normalizedInput }, (draft) => {
        const entry = draft.knowledge.find((item) => item.id === id);
        if (entry) Object.assign(entry, normalizedInput);
      });
    },
    deleteImportantInfo(id) {
      mutateOnServer('knowledge.delete', { id }, (draft) => {
        draft.knowledge = draft.knowledge.filter((item) => item.id !== id);
      });
    },
    toggleChecklistItem(checklistId, itemId, userId) {
      const completedBy = userId ?? currentUser?.id ?? null;
      runChecklistToggleMutation({ checklistId, itemId, userId: completedBy }, (draft) => {
        const item = draft.checklists.find((checklist) => checklist.id === checklistId)?.items.find((entry) => entry.id === itemId);
        if (!item) return;
        item.completed = !item.completed;
        item.completedAt = item.completed ? new Date().toISOString() : null;
        item.completedBy = item.completed ? completedBy ?? undefined : undefined;
      });
    },
    async confirmChecklistItems(checklistId, items, userId) {
      const updates = items.filter((item) => item.itemId);
      if (!updates.length) return;
      const completedBy = userId ?? currentUser?.id ?? null;
      const completedAt = new Date().toISOString();
      await runMutation('checklist.items.confirm', { checklistId, items: updates, userId: completedBy, completedAt }, (draft) => {
        const checklist = draft.checklists.find((entry) => entry.id === checklistId);
        if (!checklist) return;
        updates.forEach((update) => {
          const item = checklist.items.find((entry) => entry.id === update.itemId);
          if (!item) return;
          item.completed = update.completed;
          item.completedAt = update.completed ? completedAt : null;
          item.completedBy = update.completed ? completedBy ?? undefined : undefined;
        });
      });
    },
    addChecklistItem(checklistId, label) {
      const trimmed = label.trim();
      if (!trimmed) return;
      const checklist = state.checklists.find((entry) => entry.id === checklistId);
      const itemId = newId('checklist-item');
      mutateOnServer('checklist.item.add', { checklistId, label: trimmed, id: itemId, assignedTo: checklist?.assignedTo ?? null }, (draft) => {
        const target = draft.checklists.find((entry) => entry.id === checklistId);
        if (!target) return;
        target.items.push({
          id: itemId,
          label: trimmed,
          completed: false,
          completedAt: null,
          completedBy: undefined,
        });
      });
    },
    deleteChecklistItem(checklistId, itemId) {
      mutateOnServer('checklist.item.delete', { checklistId, itemId });
    },
    addRoleChecklistItem(roles, label) {
      if (!label.trim()) return;
      mutateOnServer('checklist.roleItem.add', { roles, label: label.trim() });
    },
    updateRoleChecklistItem(roles, itemIndex, label) {
      if (!label.trim()) return;
      mutateOnServer('checklist.roleItem.update', { roles, itemIndex, label: label.trim() });
    },
    deleteRoleChecklistItem(roles, itemIndex) {
      mutateOnServer('checklist.roleItem.delete', { roles, itemIndex });
    },
    async updateChecklistReport(checklistId, slot, input) {
      const checklist = state.checklists.find((item) => item.id === checklistId);
      const report = checklist?.reports.find((item) => item.slot === slot);
      const shift = checklist
        ? state.adminShifts.find((item) => item.userId === checklist.assignedTo && item.date === dateKey(checklist.date))
        : null;
      const nextReport = {
        ...(report ?? { slot, adminName: input.adminName ?? currentUser?.name ?? '', calls: '', reached: '', bookings: '', cash: '', came: '', bought: '', sentToTelegram: false }),
        ...input,
        studio: shift?.studio ?? input.studio ?? report?.studio ?? DEFAULT_STUDIO,
        adminName: input.adminName ?? shift?.adminName ?? report?.adminName ?? currentUser?.name ?? '',
        submittedAt: input.submittedAt ?? new Date().toISOString(),
      };
      if ((slot === '14:00' || slot === '18:00') && !isReportReady(nextReport)) {
        setDataError('Заполните все поля отчёта перед отправкой в MAX.');
        return;
      }
      try {
        if (slot === '14:00' || slot === '18:00') {
          const result = await sendMaxChecklistReport({ checklistId, checklistDate: checklist?.date ?? dateKey(), assigneeName: nextReport.adminName, assigneeRole: checklist?.role ?? 'ADMIN', slot, report: nextReport as ChecklistReport });
          Object.assign(nextReport, { sentToMax: true, maxSentAt: result.sentAt, maxMessageId: result.messageId ?? null, maxSendError: null, sentToTelegram: true, telegramSentAt: result.sentAt });
        }
      } catch (error) {
        Object.assign(nextReport, { sentToMax: false, maxSentAt: null, maxMessageId: null, maxSendError: error instanceof Error ? error.message : 'MAX report was not sent.', sentToTelegram: false, telegramSentAt: null });
      }
      await runMutation('checklist.report.update', { checklistId, slot, input: nextReport } as unknown as Record<string, unknown>);
    },
    activeAdminShift(userId) {
      const today = moscowDateKey();
      return state.adminShifts.find((shift) => shift.userId === userId && shift.date === today && !isAdminShiftClosed(shift)) ?? null;
    },
    async startAdminShift(input) {
      const shift = { id: newId('shift'), ...input, date: moscowDateKey(), startedAt: new Date().toISOString(), closedAt: null, remindersScheduledAt: null, reminderScheduleError: null };
      let scheduleResult: { scheduled?: unknown[] } | null = null;
      try {
        scheduleResult = await scheduleMaxShiftReminders({
          shiftId: shift.id,
          adminName: shift.adminName,
          studio: shift.studio,
          date: shift.date,
        });
      } catch (error) {
        shift.reminderScheduleError = error instanceof Error ? error.message : 'MAX reminders were not scheduled.';
      }
      if (scheduleResult) shift.remindersScheduledAt = new Date().toISOString();
      await runMutation('shift.start', shift as unknown as Record<string, unknown>, (draft) => {
        draft.adminShifts.unshift(shift);
      });
    },
    createRefund(input) {
      mutateOnServer('refund.create', input as unknown as Record<string, unknown>);
    },
    updateRefund(id, input) {
      mutateOnServer('refund.update', { id, input });
    },
    addFinancialPlanRow(month, title) {
      if (!title.trim()) return;
      const baseId = newId('financial-row');
      mutateOnServer('financial.row.add', { month, title: title.trim(), id: baseId }, (draft) => {
        for (let index = 0; index <= FINANCIAL_PLAN_FORWARD_MONTHS; index += 1) {
          const targetMonth = addFinancialPlanMonths(month, index);
          const plan = ensureFinancialPlan(draft, targetMonth);
          const id = `${targetMonth}:${baseId}`;
          if (!plan.rows.some((row) => row.id === id)) plan.rows.push({ id, title: title.trim(), payments: {} });
        }
      });
    },
    updateFinancialPlanRow(month, rowId, title) {
      mutateOnServer('financial.row.update', { month, rowId, title }, (draft) => {
        const base = rowId.replace(/^\d{4}-\d{2}:/, '');
        draft.financialPlans.forEach((plan) => {
          if (plan.month < month) return;
          plan.rows.forEach((row) => {
            if (row.id === rowId || row.id.endsWith(`:${base}`) || row.id === base) row.title = title;
          });
        });
      });
    },
    deleteFinancialPlanRow(month, rowId) {
      mutateOnServer('financial.row.delete', { month, rowId }, (draft) => {
        const base = rowId.replace(/^\d{4}-\d{2}:/, '');
        draft.financialPlans.forEach((plan) => {
          if (plan.month < month) return;
          plan.rows = plan.rows.filter((row) => row.id !== rowId && !row.id.endsWith(`:${base}`) && row.id !== base);
        });
      });
    },
    updateFinancialPlanCell(month, rowId, date, value) {
      mutateOnServer('financial.cell.update', { month, rowId, date, value }, (draft) => {
        const base = rowId.replace(/^\d{4}-\d{2}:/, '');
        draft.financialPlans.forEach((plan) => {
          if (plan.month < month) return;
          const row = plan.rows.find((item) => item.id === rowId || item.id.endsWith(`:${base}`) || item.id === base);
          if (!row) return;
          const targetDate = plan.month === month ? date : clampFinancialPlanDate(plan.month, date);
          if (String(value).trim()) row.payments[targetDate] = value;
          else delete row.payments[targetDate];
        });
      });
    },
    createExpenseCategory(name) {
      if (!name.trim()) return;
      const category = { id: newId('expense-category'), name: name.trim(), createdAt: new Date().toISOString() };
      mutateOnServer('expenseCategory.create', category, (draft) => {
        if (!draft.expenseCategories.some((item) => item.name === category.name)) draft.expenseCategories.push(category);
      });
    },
    deleteExpenseCategory(id) {
      mutateOnServer('expenseCategory.delete', { id }, (draft) => {
        draft.expenseCategories = draft.expenseCategories.filter((item) => item.id !== id);
      });
    },
    createExpense(input) {
      const expense = { id: newId('expense'), ...input, createdAt: new Date().toISOString() };
      mutateOnServer('expense.create', expense as unknown as Record<string, unknown>, (draft) => {
        draft.expenses.unshift(expense);
      });
    },
    updateExpense(id, input) {
      mutateOnServer('expense.update', { id, input }, (draft) => {
        const expense = draft.expenses.find((item) => item.id === id);
        if (expense) Object.assign(expense, input);
      });
    },
    deleteExpense(id) {
      mutateOnServer('expense.delete', { id }, (draft) => {
        draft.expenses = draft.expenses.filter((item) => item.id !== id);
      });
    },
    createTrainerEvaluation(input) {
      if (!input.trainerName.trim() || !input.direction.trim() || !input.sheetUrl.trim() || !input.evaluatedAt) return;
      const evaluation = { id: newId('trainer-evaluation'), ...input, trainerName: input.trainerName.trim(), direction: input.direction.trim(), sheetUrl: input.sheetUrl.trim(), score: Number(input.score) || 0, createdById: currentUser?.id ?? null, createdAt: new Date().toISOString() };
      mutateOnServer('trainerEvaluation.create', evaluation as unknown as Record<string, unknown>, (draft) => {
        draft.trainerEvaluations.unshift(evaluation);
      });
    },
    updateTrainerEvaluation(id, input) {
      mutateOnServer('trainerEvaluation.update', { id, input }, (draft) => {
        const evaluation = draft.trainerEvaluations.find((item) => item.id === id);
        if (evaluation) Object.assign(evaluation, input);
      });
    },
    deleteTrainerEvaluation(id) {
      mutateOnServer('trainerEvaluation.delete', { id }, (draft) => {
        draft.trainerEvaluations = draft.trainerEvaluations.filter((item) => item.id !== id);
      });
    },
    updateSettings(input) {
      update((draft) => {
        draft.settings = { ...draft.settings, ...input };
        if (typeof window !== 'undefined') window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(draft.settings));
      }, false);
      mutateOnServer('settings.update', { input });
    },
    toggleFavorite(entityType, entityId) {
      if (!currentUser) return;
      const userId = currentUser.id;
      mutateOnServer('favorite.toggle', { entityType, entityId, userId }, (draft) => {
        const index = draft.favorites.findIndex((favorite) => favorite.userId === userId && favorite.entityType === entityType && favorite.entityId === entityId);
        if (index >= 0) {
          draft.favorites.splice(index, 1);
          return;
        }
        draft.favorites.unshift({
          id: newId('favorite'),
          userId,
          entityType,
          entityId,
          createdAt: new Date().toISOString(),
        });
      }, { showSaving: false });
    },
    isFavorite(entityType, entityId, userId) {
      const targetUserId = userId ?? currentUser?.id ?? null;
      if (!targetUserId) return false;
      return state.favorites.some((favorite) => favorite.userId === targetUserId && favorite.entityType === entityType && favorite.entityId === entityId);
    },
    favoritesForCurrentUser() {
      if (!currentUser) return [];
      return state.favorites.filter((favorite) => favorite.userId === currentUser.id);
    },
    markKnowledgeAsRead(entityId) {
      if (!currentUser) return;
      const userId = currentUser.id;
      mutateOnServer('knowledge.read', { entityId, userId }, (draft) => {
        const exists = draft.readReceipts.some((receipt) => receipt.userId === userId && receipt.entityType === 'knowledge' && receipt.entityId === entityId);
        if (exists) return;
        draft.readReceipts.unshift({
          id: newId('read'),
          userId,
          entityType: 'knowledge',
          entityId,
          readAt: new Date().toISOString(),
        });
      }, { showSaving: false });
    },
    knowledgeReadReceipt(entityId, userId) {
      const targetUserId = userId ?? currentUser?.id ?? null;
      if (!targetUserId) return null;
      return state.readReceipts.find((receipt) => receipt.userId === targetUserId && receipt.entityType === 'knowledge' && receipt.entityId === entityId) ?? null;
    },
    knowledgeReadCount(entityId) {
      return state.readReceipts.filter((receipt) => receipt.entityType === 'knowledge' && receipt.entityId === entityId).length;
    },
  }), [currentUser, currentUserId, dataError, isDataLoading, isSaving, state]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used inside LibraryProvider');
  return context;
}

