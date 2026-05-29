import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { adminChecklistItems, initialState } from './seed';
import { normalizeHashtags, roleRoutes } from './labels';
import type {
  AppSettings,
  AdminShift,
  AuditAction,
  BusinessModelScope,
  CalendarEvent,
  CalendarEventRecurrence,
  ChecklistControlStatus,
  ChecklistReport,
  ChecklistReportSlot,
  DailyChecklist,
  DocumentTemplate,
  ExpenseAccount,
  ExpenseStudio,
  EmployeeStatus,
  FinancialPlanMonth,
  FinancialPlanRow,
  HelpfulLink,
  KnowledgeCategory,
  KnowledgeEntry,
  LibraryState,
  OwnerChecklistReport,
  RefundCase,
  RefundStatus,
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

type GoogleCalendarStatus = {
  configured: boolean;
  connected: boolean;
  reconnectRequired?: boolean;
  calendarId: string;
  redirectUri: string;
  includeAllCalendars?: boolean;
  includeTasks?: boolean;
  timeZone?: string;
};

type GoogleCalendarImportedEvent = {
  googleEventId: string;
  googleRecurringEventId?: string | null;
  googleHtmlLink?: string | null;
  title: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
  source?: 'google-calendar' | 'google-task';
  sourceName?: string | null;
  updated?: string | null;
};

type CalendarEventInput = {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  recurrence?: CalendarEventRecurrence | null;
};

type LibraryContextValue = {
  state: LibraryState;
  currentUser: User | null;
  googleCalendarStatus: GoogleCalendarStatus | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string; route?: string }>;
  resetPassword: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  resetDemoData: () => void;
  refreshState: () => Promise<void>;
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
  createTask: (input: Pick<TaskTemplate, 'title' | 'period' | 'description' | 'priority'> & Partial<Pick<TaskTemplate, 'deadline' | 'addToCalendar'>>) => void;
  updateTask: (id: string, input: Partial<Pick<TaskTemplate, 'title' | 'period' | 'description' | 'priority' | 'status' | 'deadline' | 'addToCalendar'>>) => void;
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
  addChecklistItem: (checklistId: string, label: string) => void;
  deleteChecklistItem: (checklistId: string, itemId: string) => void;
  updateChecklistReport: (checklistId: string, slot: ChecklistReportSlot, input: Partial<Omit<ChecklistReport, 'slot'>>) => Promise<void>;
  activeAdminShift: (userId: string) => AdminShift | null;
  startAdminShift: (input: { userId: string; adminName: string; studio: Studio }) => Promise<void>;
  createRefund: (input: Omit<RefundCase, 'id' | 'createdAt' | 'requestedAt'> & { requestedAt?: string }) => void;
  updateRefund: (id: string, input: { amount?: number; reason?: string; status?: RefundStatus; comment?: string; clientName?: string }) => void;
  addFinancialPlanRow: (month: string, title: string) => void;
  updateFinancialPlanRow: (month: string, rowId: string, title: string) => void;
  deleteFinancialPlanRow: (month: string, rowId: string) => void;
  updateFinancialPlanCell: (month: string, rowId: string, date: string, value: string) => void;
  createCalendarEvent: (input: CalendarEventInput) => void;
  updateCalendarEvent: (id: string, input: Partial<CalendarEventInput>) => void;
  deleteCalendarEvent: (id: string) => void;
  refreshGoogleCalendarStatus: () => Promise<void>;
  connectGoogleCalendar: () => void;
  importGoogleCalendarEvents: (timeMin: string, timeMax: string) => Promise<void>;
  syncCalendarEventToGoogle: (id: string) => Promise<void>;
  createExpenseCategory: (name: string) => void;
  deleteExpenseCategory: (id: string) => void;
  createExpense: (input: CreateExpenseInput) => void;
  updateExpense: (id: string, input: Partial<CreateExpenseInput>) => void;
  deleteExpense: (id: string) => void;
  createTrainerEvaluation: (input: TrainerEvaluationInput) => void;
  updateTrainerEvaluation: (id: string, input: Partial<TrainerEvaluationInput>) => void;
  deleteTrainerEvaluation: (id: string) => void;
  updateSettings: (input: Partial<AppSettings>) => void;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function cloneState(state: LibraryState): LibraryState {
  return JSON.parse(JSON.stringify(state)) as LibraryState;
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

function normalizeRecurrence(input?: CalendarEventRecurrence | null): CalendarEventRecurrence | null {
  if (!input || input.frequency !== 'weekly') return null;
  const weekdays = Array.from(new Set((input.weekdays || [])
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
    .sort((left, right) => left - right);
  if (!weekdays.length) return null;
  return {
    frequency: 'weekly',
    interval: Math.max(1, Number(input.interval) || 1),
    weekdays,
    until: input.until || null,
  };
}

function isGoogleTaskEventId(googleEventId?: string | null) {
  return Boolean(googleEventId?.startsWith('task:') || googleEventId?.startsWith('task-recurring:'));
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
  const finalLabels = isAdminRole ? CANONICAL_ADMIN_CHECKLIST_ITEMS : ['Проверить входящие сообщения', 'Обновить статусы задач', 'Подготовить рабочие материалы'];
  const labels = isAdminRole ? adminChecklistItems : ['Проверить входящие сообщения', 'Обновить статусы задач', 'Подготовить рабочие материалы'];

  return {
    id: newId('checklist'),
    title: isAdminRole ? 'Чек-лист администратора на смену' : 'Чек-лист дня',
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
  const base = cloneState(initialState);
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
    reminderScheduleError: shift.reminderScheduleError ?? null,
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
    const needsChecklist = user.role === 'ADMIN' || user.role === 'SENIOR_ADMIN' || user.role === 'ASSISTANT';
    const hasChecklist = checklists.some((checklist) => checklist.assignedTo === user.id && checklistDateKey(checklist) === today);
    if (needsChecklist && !hasChecklist) checklists.unshift(createDailyChecklist(user));
  });

  return {
    ...base,
    ...raw,
    users,
    checklists,
    tasks: (raw.tasks || base.tasks).map((task) => ({ ...task, ownerUserId: undefined })),
    templates: (raw.templates || base.templates).map((template) => ({ ...template, ownerUserId: undefined, businessModel: normalizeBusinessModel(template.businessModel) })),
    links: (raw.links || base.links).map((link) => ({ ...link, ownerUserId: undefined })),
    documentTemplates: raw.documentTemplates || base.documentTemplates,
    usefulContacts: raw.usefulContacts || base.usefulContacts,
    knowledge: (raw.knowledge || base.knowledge).map((entry) => ({ ...entry, businessModel: normalizeBusinessModel(entry.businessModel) })),
    financialPlans: normalizeFinancialPlans(raw.financialPlans || base.financialPlans),
    calendarEvents: (raw.calendarEvents || base.calendarEvents).map((event) => ({
      ...event,
      startTime: event.startTime ?? null,
      endTime: event.endTime ?? null,
      description: event.description ?? null,
      sourceTaskId: event.sourceTaskId ?? null,
      googleEventId: event.googleEventId ?? null,
      googleRecurringEventId: event.googleRecurringEventId ?? null,
      googleHtmlLink: event.googleHtmlLink ?? null,
      googleSyncError: event.googleSyncError ?? null,
      source: event.source ?? 'local',
      sourceName: event.sourceName ?? null,
      recurrence: normalizeRecurrence(event.recurrence),
    })),
    expenseCategories: raw.expenseCategories || base.expenseCategories,
    expenses: raw.expenses || base.expenses,
    trainerEvaluations: (raw.trainerEvaluations || base.trainerEvaluations).map((evaluation) => ({
      ...evaluation,
      score: Number(evaluation.score) || 0,
      evaluatedAt: /^\d{4}-\d{2}-\d{2}$/.test(evaluation.evaluatedAt) ? evaluation.evaluatedAt : dateKey(evaluation.evaluatedAt) || dateKey(),
      createdById: evaluation.createdById ?? null,
    })),
    adminShifts,
    auditLog: (raw.auditLog || base.auditLog || []).slice(0, 500),
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
  return applyLocalSettings(normalizeState(cloneState(initialState)));
}

async function loadDatabaseState() {
  const response = await fetch('/api/state', { cache: 'no-store' });
  if (!response.ok) throw new Error('Не удалось загрузить данные из базы.');
  const payload = await response.json() as { state: Partial<LibraryState> | null };
  return payload.state ? applyLocalSettings(normalizeState(payload.state)) : null;
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

async function saveGoogleCalendarEvent(event: CalendarEvent) {
  if (event.source === 'google-task' || isGoogleTaskEventId(event.googleEventId)) {
    throw new Error('Задачи Google импортируются только для просмотра.');
  }
  const payload = JSON.stringify({
    title: event.title,
    date: event.date,
    startTime: event.startTime || '',
    endTime: event.endTime || '',
    description: event.description ?? '',
    recurrence: event.recurrence ?? null,
  });
  const submit = (endpoint: string, method: 'POST' | 'PATCH') => fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });

  const endpoint = event.googleEventId ? `/api/google/events/${encodeURIComponent(event.googleEventId)}` : '/api/google/events';
  let response = await submit(endpoint, event.googleEventId ? 'PATCH' : 'POST');
  if (response.status === 404 && event.googleEventId) {
    response = await submit('/api/google/events', 'POST');
  }
  if (!response.ok) throw new Error(await readApiError(response));
  return await response.json() as { googleEventId: string; googleHtmlLink?: string };
}

async function removeGoogleCalendarEvent(googleEventId: string) {
  const response = await fetch(`/api/google/events/${encodeURIComponent(googleEventId)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await readApiError(response));
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
  return await response.json() as { ok: boolean; sentAt: string; messageId?: string | null };
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

async function fetchGoogleCalendarEvents(timeMin: string, timeMax: string) {
  const params = new URLSearchParams({ timeMin, timeMax });
  const response = await fetch(`/api/google/events?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(await readApiError(response));
  return await response.json() as { events: GoogleCalendarImportedEvent[] };
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
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<GoogleCalendarStatus | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(SESSION_USER_KEY);
  });

  const refreshState = async () => {
    const databaseState = await loadDatabaseState();
    if (databaseState) {
      setState(databaseState);
      return;
    }

    const seedState = loadState();
    await saveDatabaseState(seedState);
    setState(seedState);
  };

  useEffect(() => {
    void refreshState();
    void refreshGoogleCalendarStatus();
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
      if (persist) void saveDatabaseState(nextState);
      return nextState;
    });
  };

  const refreshGoogleCalendarStatus = async () => {
    const response = await fetch('/api/google/status', { cache: 'no-store' });
    if (!response.ok) {
      setGoogleCalendarStatus(null);
      return;
    }
    setGoogleCalendarStatus(await response.json() as GoogleCalendarStatus);
  };

  const syncGoogleEvent = async (event: CalendarEvent) => {
    if (event.source === 'google-task' || isGoogleTaskEventId(event.googleEventId)) return;
    update((draft) => {
      const stored = draft.calendarEvents.find((item) => item.id === event.id);
      if (stored) {
        stored.googleSyncStatus = 'pending';
        stored.googleSyncError = null;
      }
    });

    try {
      const result = await saveGoogleCalendarEvent(event);
      update((draft) => {
        const stored = draft.calendarEvents.find((item) => item.id === event.id);
        if (!stored) return;
        stored.googleEventId = result.googleEventId;
        stored.googleHtmlLink = result.googleHtmlLink ?? null;
        stored.googleSyncStatus = 'synced';
        stored.googleSyncError = null;
      });
      void refreshGoogleCalendarStatus();
    } catch (error) {
      update((draft) => {
        const stored = draft.calendarEvents.find((item) => item.id === event.id);
        if (!stored) return;
        const message = error instanceof Error ? error.message : 'Не удалось синхронизировать событие.';
        stored.googleSyncStatus = message.includes('не подключен') || message.includes('не настроен') ? 'not_connected' : 'error';
        stored.googleSyncError = message;
      });
    }
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
    googleCalendarStatus,
    async login(email, password) {
      const normalized = normalizeEmail(email);
      if (!normalized || !password.trim()) return { ok: false, error: 'Введите email и пароль.' };
      let result = await loginOnServer(normalized, password);
      if (!result.ok) {
        const databaseState = await loadDatabaseState();
        if (!databaseState) await saveDatabaseState(state);
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
        setState(nextState);
        void saveDatabaseState(nextState);
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
        setState(databaseState);
        void saveDatabaseState(databaseState);
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
    refreshGoogleCalendarStatus,
    connectGoogleCalendar() {
      window.location.href = '/api/google/connect';
    },
    async importGoogleCalendarEvents(timeMin, timeMax) {
      const result = await fetchGoogleCalendarEvents(timeMin, timeMax);
      update((draft) => {
        for (const googleEvent of result.events) {
          if (googleEvent.googleRecurringEventId && draft.calendarEvents.some((event) => event.googleEventId === googleEvent.googleRecurringEventId && event.recurrence)) {
            continue;
          }
          const existing = draft.calendarEvents.find((event) => event.googleEventId === googleEvent.googleEventId);
          if (existing) {
            existing.title = googleEvent.title;
            existing.date = googleEvent.date;
            existing.startTime = googleEvent.startTime ?? null;
            existing.endTime = googleEvent.endTime ?? null;
            existing.description = googleEvent.description ?? null;
            existing.googleHtmlLink = googleEvent.googleHtmlLink ?? null;
            existing.googleRecurringEventId = googleEvent.googleRecurringEventId ?? null;
            existing.googleSyncStatus = 'synced';
            existing.googleSyncError = null;
            existing.source = googleEvent.source ?? 'google-calendar';
            existing.sourceName = googleEvent.sourceName ?? null;
            continue;
          }
          draft.calendarEvents.unshift({
            id: newId('calendar-event'),
            title: googleEvent.title,
            date: googleEvent.date,
            startTime: googleEvent.startTime ?? null,
            endTime: googleEvent.endTime ?? null,
            description: googleEvent.description ?? null,
            sourceTaskId: null,
            googleEventId: googleEvent.googleEventId,
            googleRecurringEventId: googleEvent.googleRecurringEventId ?? null,
            googleHtmlLink: googleEvent.googleHtmlLink ?? null,
            googleSyncStatus: 'synced',
            googleSyncError: null,
            source: googleEvent.source ?? 'google-calendar',
            sourceName: googleEvent.sourceName ?? null,
            recurrence: null,
            createdAt: googleEvent.updated ?? new Date().toISOString(),
          });
        }
      });
      void refreshGoogleCalendarStatus();
    },
    async syncCalendarEventToGoogle(id) {
      const event = state.calendarEvents.find((item) => item.id === id);
      if (event) await syncGoogleEvent(event);
    },
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
    activeAdminShift(userId) {
      return state.adminShifts.find((shift) => shift.userId === userId && shift.date === dateKey()) ?? null;
    },
    async startAdminShift(input) {
      const date = dateKey();
      const existing = state.adminShifts.find((shift) => shift.userId === input.userId && shift.date === date);
      const shift: AdminShift = {
        id: existing?.id ?? newId('shift'),
        userId: input.userId,
        adminName: input.adminName,
        studio: input.studio,
        date,
        startedAt: existing?.startedAt ?? new Date().toISOString(),
        remindersScheduledAt: null,
        reminderScheduleError: null,
      };
      update((draft) => {
        draft.adminShifts = [
          shift,
          ...draft.adminShifts.filter((item) => !(item.userId === input.userId && item.date === date)),
        ];
        pushAudit(draft, 'shift.start', 'adminShift', `${input.adminName} · ${date}`, {
          entityId: shift.id,
          description: `Смена открыта. Студия: ${input.studio === 'MACHUGI' ? 'Мачуги' : 'Ставропольская'}.`,
        });
      });
      try {
        await scheduleMaxShiftReminders({ shiftId: shift.id, adminName: shift.adminName, studio: shift.studio, date });
        update((draft) => {
          const stored = draft.adminShifts.find((item) => item.id === shift.id);
          if (!stored) return;
          stored.remindersScheduledAt = new Date().toISOString();
          stored.reminderScheduleError = null;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось поставить напоминания MAX.';
        update((draft) => {
          const stored = draft.adminShifts.find((item) => item.id === shift.id);
          if (!stored) return;
          stored.reminderScheduleError = message;
          stored.remindersScheduledAt = null;
        });
      }
    },
    createEmployee(input) {
      update((draft) => {
        const user: User = {
          id: newId('user'),
          name: input.name,
          email: normalizeEmail(input.email),
          password: input.password,
          role: input.role,
          status: input.status ?? 'active',
          joinDate: 'май 2026',
          createdAt: new Date().toISOString(),
        };
        draft.users.unshift(user);
        if (user.role === 'ADMIN' || user.role === 'SENIOR_ADMIN' || user.role === 'ASSISTANT') {
          draft.checklists.unshift(createDailyChecklist(user));
        }
        pushAudit(draft, 'employee.create', 'user', user.name, {
          entityId: user.id,
          description: `Создан сотрудник с ролью ${user.role}.`,
        });
      });
    },
    updateEmployee(id, input) {
      update((draft) => {
        const user = draft.users.find((item) => item.id === id);
        if (!user) return;
        Object.assign(user, input, input.email ? { email: normalizeEmail(input.email) } : {});
        pushAudit(draft, 'employee.update', 'user', user.name, {
          entityId: user.id,
          description: 'Карточка сотрудника обновлена.',
        });
      });
    },
    deleteEmployee(id) {
      update((draft) => {
        const user = draft.users.find((item) => item.id === id);
        if (!user || user.role === 'OWNER') return;
        draft.users = draft.users.filter((item) => item.id !== id);
        draft.checklists = draft.checklists.filter((item) => item.assignedTo !== id);
        pushAudit(draft, 'employee.delete', 'user', user.name, {
          entityId: user.id,
          description: 'Сотрудник удалён из команды.',
        });
      });
    },
    addCallChecklistItem(label) {
      if (!label.trim()) return;
      update((draft) => {
        draft.callChecklist.push(label.trim());
      });
    },
    updateCallChecklistItem(index, label) {
      if (!label.trim()) return;
      update((draft) => {
        if (draft.callChecklist[index] !== undefined) draft.callChecklist[index] = label.trim();
      });
    },
    deleteCallChecklistItem(index) {
      update((draft) => {
        draft.callChecklist = draft.callChecklist.filter((_, itemIndex) => itemIndex !== index);
      });
    },
    createTask(input) {
      const taskId = newId('task');
      const calendarEventId = input.addToCalendar && input.deadline ? newId('calendar-event') : null;
      const calendarEvent: CalendarEvent | null = calendarEventId && input.deadline
        ? {
            id: calendarEventId,
            title: input.title,
            date: input.deadline,
            startTime: null,
            endTime: null,
            description: input.description || null,
            sourceTaskId: taskId,
            googleSyncStatus: 'pending',
            googleSyncError: null,
            source: 'local',
            recurrence: null,
            createdAt: new Date().toISOString(),
          }
        : null;
      update((draft) => {
        draft.tasks.unshift({ id: taskId, role: 'ASSISTANT', status: 'pending', createdAt: new Date().toISOString(), calendarEventId, ...input });
        if (calendarEvent) draft.calendarEvents.unshift(calendarEvent);
        pushAudit(draft, 'content.create', 'task', input.title, {
          entityId: taskId,
          description: 'Создана важная задача.',
        });
      });
      if (calendarEvent) void syncGoogleEvent(calendarEvent);
    },
    updateTask(id, input) {
      let eventToSync: CalendarEvent | null = null;
      update((draft) => {
        const task = draft.tasks.find((item) => item.id === id);
        if (!task) return;
        Object.assign(task, input);
        pushAudit(draft, 'content.update', 'task', task.title, {
          entityId: task.id,
          description: 'Обновлена важная задача.',
        });
        if (task.addToCalendar && task.deadline) {
          if (task.calendarEventId) {
            const event = draft.calendarEvents.find((item) => item.id === task.calendarEventId);
            if (event) {
              Object.assign(event, { title: task.title, date: task.deadline, description: task.description || null });
              eventToSync = { ...event };
            }
          } else {
            const calendarEventId = newId('calendar-event');
            task.calendarEventId = calendarEventId;
            const event: CalendarEvent = { id: calendarEventId, title: task.title, date: task.deadline, startTime: null, endTime: null, description: task.description || null, sourceTaskId: task.id, googleSyncStatus: 'pending', googleSyncError: null, source: 'local', recurrence: null, createdAt: new Date().toISOString() };
            draft.calendarEvents.unshift(event);
            eventToSync = event;
          }
        }
      });
      if (eventToSync) void syncGoogleEvent(eventToSync);
    },
    toggleTask(id) {
      update((draft) => {
        const task = draft.tasks.find((item) => item.id === id);
        if (!task) return;
        task.status = task.status === 'completed' ? 'pending' : 'completed';
      });
    },
    createTemplate(input) {
      update((draft) => {
        const id = newId('template');
        draft.templates.unshift({ id, createdAt: new Date().toISOString(), createdById: input.createdById ?? currentUser?.id ?? 'system', purpose: input.purpose || null, title: input.title, body: input.body, role: input.role, businessModel: normalizeBusinessModel(input.businessModel) });
        pushAudit(draft, 'content.create', 'template', input.title, { entityId: id, description: 'Создан шаблон сообщения.' });
      });
    },
    updateTemplate(id, input) {
      update((draft) => {
        const template = draft.templates.find((item) => item.id === id);
        if (template) {
          Object.assign(template, input);
          pushAudit(draft, 'content.update', 'template', template.title, { entityId: template.id, description: 'Обновлён шаблон сообщения.' });
        }
      });
    },
    deleteTemplate(id) {
      update((draft) => {
        const template = draft.templates.find((item) => item.id === id);
        draft.templates = draft.templates.filter((template) => template.id !== id);
        if (template) pushAudit(draft, 'content.delete', 'template', template.title, { entityId: template.id, description: 'Удалён шаблон сообщения.' });
      });
    },
    createLink(input) {
      update((draft) => {
        const id = newId('link');
        draft.links.unshift({ id, title: input.title, url: input.url, category: input.category ?? 'HELPFUL', role: input.role, description: input.description || null, createdAt: new Date().toISOString() });
        pushAudit(draft, 'content.create', 'link', input.title, { entityId: id, description: 'Создана рабочая ссылка.' });
      });
    },
    updateLink(id, input) {
      update((draft) => {
        const link = draft.links.find((item) => item.id === id);
        if (link) {
          Object.assign(link, input);
          pushAudit(draft, 'content.update', 'link', link.title, { entityId: link.id, description: 'Обновлена рабочая ссылка.' });
        }
      });
    },
    deleteLink(id) {
      update((draft) => {
        const link = draft.links.find((item) => item.id === id);
        draft.links = draft.links.filter((link) => link.id !== id);
        if (link) pushAudit(draft, 'content.delete', 'link', link.title, { entityId: link.id, description: 'Удалена рабочая ссылка.' });
      });
    },
    createDocumentTemplate(input) {
      update((draft) => {
        draft.documentTemplates.unshift({ id: newId('document-template'), title: input.title, url: input.url, createdAt: new Date().toISOString(), createdById: currentUser?.id ?? null });
      });
    },
    updateDocumentTemplate(id, input) {
      update((draft) => {
        const template = draft.documentTemplates.find((item) => item.id === id);
        if (template) Object.assign(template, input);
      });
    },
    deleteDocumentTemplate(id) {
      update((draft) => {
        draft.documentTemplates = draft.documentTemplates.filter((template) => template.id !== id);
      });
    },
    createUsefulContact(input) {
      update((draft) => {
        draft.usefulContacts.unshift({ id: newId('contact'), createdAt: new Date().toISOString(), ...input });
      });
    },
    updateUsefulContact(id, input) {
      update((draft) => {
        const contact = draft.usefulContacts.find((item) => item.id === id);
        if (contact) Object.assign(contact, input);
      });
    },
    deleteUsefulContact(id) {
      update((draft) => {
        draft.usefulContacts = draft.usefulContacts.filter((contact) => contact.id !== id);
      });
    },
    createKnowledge(input) {
      update((draft) => {
        const id = newId('knowledge');
        draft.knowledge.unshift({ id, title: input.title, content: input.content, role: input.role, category: input.category, businessModel: normalizeBusinessModel(input.businessModel), hashtags: normalizeHashtags(input.hashtags ?? '') || null, isActual: input.isActual ?? true, searchable: true, createdAt: new Date().toISOString() });
        pushAudit(draft, 'content.create', 'knowledge', input.title, { entityId: id, description: 'Создана карточка контента.' });
      });
    },
    updateKnowledge(id, input) {
      update((draft) => {
        const entry = draft.knowledge.find((item) => item.id === id);
        if (!entry) return;
        Object.assign(entry, input, input.hashtags !== undefined ? { hashtags: normalizeHashtags(input.hashtags) } : {});
        pushAudit(draft, 'content.update', 'knowledge', entry.title, { entityId: entry.id, description: 'Обновлена карточка контента.' });
      });
    },
    deleteKnowledge(id) {
      update((draft) => {
        const entry = draft.knowledge.find((item) => item.id === id);
        draft.knowledge = draft.knowledge.filter((item) => item.id !== id);
        if (entry) pushAudit(draft, 'content.delete', 'knowledge', entry.title, { entityId: entry.id, description: 'Удалена карточка контента.' });
      });
    },
    createImportantInfo(title, content, hashtags) {
      update((draft) => {
        draft.knowledge.unshift({ id: newId('knowledge'), title, content, role: 'ADMIN', category: 'IMPORTANT_INFO', businessModel: 'ALL', hashtags: normalizeHashtags(hashtags ?? '') || null, searchable: true, createdAt: new Date().toISOString() });
      });
    },
    updateImportantInfo(id, input) {
      update((draft) => {
        const entry = draft.knowledge.find((item) => item.id === id);
        if (!entry) return;
        Object.assign(entry, input, input.hashtags !== undefined ? { hashtags: normalizeHashtags(input.hashtags) } : {});
      });
    },
    deleteImportantInfo(id) {
      update((draft) => {
        draft.knowledge = draft.knowledge.filter((item) => item.id !== id);
      });
    },
    toggleChecklistItem(checklistId, itemId, userId) {
      update((draft) => {
        const checklist = draft.checklists.find((item) => item.id === checklistId);
        const item = checklist?.items.find((entry) => entry.id === itemId);
        if (!checklist || !item) return;
        item.completed = !item.completed;
        item.completedAt = item.completed ? new Date().toISOString() : null;
        item.completedBy = item.completed ? userId ?? currentUser?.id ?? null : null;
        const slot = findReportSlotByItem(checklist, item.id);
        if (!slot) return;
        if (!ACTIVE_REPORT_SLOTS.includes(slot)) return;
        let report = checklist.reports.find((entry) => entry.slot === slot);
        if (!report) {
          report = blankReport(slot, draft.users.find((user) => user.id === checklist.assignedTo)?.name ?? '');
          checklist.reports.push(report);
        }
        report.submittedAt = item.completedAt;
        report.sentToTelegram = false;
        report.telegramSentAt = null;
        report.sentToMax = false;
        report.maxSentAt = null;
        report.maxSendError = null;
        report.maxMessageId = null;
        const assignee = draft.users.find((user) => user.id === checklist.assignedTo);
        pushAudit(draft, 'checklist.item_toggle', 'checklist', checklist.title, {
          entityId: checklist.id,
          description: `${item.completed ? 'Отмечен' : 'Снят'} пункт "${item.label}" для ${assignee?.name ?? checklist.assignedTo}.`,
        });
      });
    },
    addChecklistItem(checklistId, label) {
      if (!label.trim()) return;
      update((draft) => {
        const checklist = draft.checklists.find((item) => item.id === checklistId);
        checklist?.items.push({ id: newId('checklist-item'), label, completed: false, completedAt: null, completedBy: null });
      });
    },
    deleteChecklistItem(checklistId, itemId) {
      update((draft) => {
        const checklist = draft.checklists.find((item) => item.id === checklistId);
        if (checklist) checklist.items = checklist.items.filter((item) => item.id !== itemId);
      });
    },
    async updateChecklistReport(checklistId, slot, input) {
      if (!ACTIVE_REPORT_SLOTS.includes(slot)) return;
      const submittedAt = new Date().toISOString();
      const currentChecklist = state.checklists.find((item) => item.id === checklistId);
      const currentReport = currentChecklist?.reports.find((item) => item.slot === slot);
      const assignee = currentChecklist ? state.users.find((user) => user.id === currentChecklist.assignedTo) : null;
      const reportForMax = {
        ...blankReport(slot, assignee?.name ?? ''),
        ...currentReport,
        ...input,
        slot,
        studio: input.studio ?? currentReport?.studio ?? DEFAULT_STUDIO,
        submittedAt,
        sentToTelegram: false,
        telegramSentAt: null,
        sentToMax: false,
        maxSentAt: null,
        maxSendError: null,
        maxMessageId: null,
      };
      update((draft) => {
        const checklist = draft.checklists.find((item) => item.id === checklistId);
        if (!checklist) return;
        const report = checklist.reports.find((item) => item.slot === slot);
        if (!report) return;
        Object.assign(report, input, {
          submittedAt,
          studio: input.studio ?? report.studio ?? DEFAULT_STUDIO,
          sentToTelegram: false,
          telegramSentAt: null,
          sentToMax: false,
          maxSentAt: null,
          maxSendError: null,
          maxMessageId: null,
        });
        const checklistItem = findReportItem(checklist, slot);
        if (checklistItem) {
          checklistItem.completed = true;
          checklistItem.completedAt = submittedAt;
          checklistItem.completedBy = currentUser?.id ?? checklist.assignedTo;
        }
        pushAudit(draft, 'checklist.report_update', 'checklistReport', `Отчёт ${slot}`, {
          entityId: checklist.id,
          description: `Сохранён отчёт ${slot} для ${assignee?.name ?? checklist.assignedTo}.`,
        });
      });
      if (!currentChecklist || !assignee) return;
      try {
        const result = await sendMaxChecklistReport({
          checklistId,
          checklistDate: currentChecklist.date,
          assigneeName: assignee.name,
          assigneeRole: assignee.role,
          slot,
          report: reportForMax,
        });
        update((draft) => {
          const checklist = draft.checklists.find((item) => item.id === checklistId);
          const report = checklist?.reports.find((item) => item.slot === slot);
          if (!report) return;
          report.sentToMax = true;
          report.maxSentAt = result.sentAt;
          report.maxMessageId = result.messageId ?? null;
          report.maxSendError = null;
          report.sentToTelegram = true;
          report.telegramSentAt = result.sentAt;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось отправить отчёт в MAX.';
        update((draft) => {
          const checklist = draft.checklists.find((item) => item.id === checklistId);
          const report = checklist?.reports.find((item) => item.slot === slot);
          if (!report) return;
          report.sentToMax = false;
          report.maxSentAt = null;
          report.maxMessageId = null;
          report.maxSendError = message;
          report.sentToTelegram = false;
          report.telegramSentAt = null;
        });
      }
    },
    createRefund(input) {
      update((draft) => {
        draft.refunds.unshift({ id: newId('refund'), createdAt: new Date().toISOString(), requestedAt: input.requestedAt ?? new Date().toISOString(), clientName: input.clientName, amount: input.amount, reason: input.reason, status: input.status, comment: input.comment ?? null });
      });
    },
    updateRefund(id, input) {
      update((draft) => {
        const refund = draft.refunds.find((item) => item.id === id);
        if (refund) Object.assign(refund, input);
      });
    },
    addFinancialPlanRow(month, title) {
      if (!title.trim()) return;
      update((draft) => {
        const id = newId('financial-row');
        const sourceRow: FinancialPlanRow = { id, title: title.trim(), payments: {} };
        for (let index = 0; index <= FINANCIAL_PLAN_FORWARD_MONTHS; index += 1) {
          const targetMonth = addFinancialPlanMonths(month, index);
          ensureFinancialPlanRow(ensureFinancialPlan(draft, targetMonth), sourceRow);
        }
        pushAudit(draft, 'finance.update', 'financialPlan', title, { entityId: id, description: `Добавлен платёж в финансовый план ${month}.` });
      });
    },
    updateFinancialPlanRow(month, rowId, title) {
      update((draft) => {
        const rows = draft.financialPlans
          .filter((item) => item.month >= month)
          .flatMap((item) => item.rows.filter((row) => row.id === rowId));
        rows.forEach((row) => {
          row.title = title;
        });
        const row = rows[0];
        if (row) {
          row.title = title;
          pushAudit(draft, 'finance.update', 'financialPlan', row.title, { entityId: row.id, description: `Платёж обновлён в финансовом плане ${month}.` });
        }
      });
    },
    deleteFinancialPlanRow(month, rowId) {
      update((draft) => {
        const plan = draft.financialPlans.find((item) => item.month === month);
        if (plan) {
          const row = plan.rows.find((item) => item.id === rowId);
          draft.financialPlans.forEach((item) => {
            if (item.month >= month) item.rows = item.rows.filter((row) => row.id !== rowId);
          });
          plan.rows = plan.rows.filter((row) => row.id !== rowId);
          if (row) pushAudit(draft, 'finance.update', 'financialPlan', row.title, { entityId: row.id, description: `Платёж удалён из финансового плана ${month}.` });
        }
      });
    },
    updateFinancialPlanCell(month, rowId, date, value) {
      update((draft) => {
        const plan = ensureFinancialPlan(draft, month);
        const row = plan.rows.find((item) => item.id === rowId);
        if (!row) return;
        for (let index = 0; index <= FINANCIAL_PLAN_FORWARD_MONTHS; index += 1) {
          const targetMonth = addFinancialPlanMonths(month, index);
          const targetPlan = ensureFinancialPlan(draft, targetMonth);
          const targetRow = ensureFinancialPlanRow(targetPlan, row);
          const targetDate = index === 0 ? date : clampFinancialPlanDate(targetMonth, date);
          if (value.trim()) targetRow.payments[targetDate] = value;
          else delete targetRow.payments[targetDate];
        }
        pushAudit(draft, 'finance.update', 'financialPlan', row.title, { entityId: row.id, description: `Обновлена ячейка ${date} в финансовом плане ${month}.` });
      });
    },
    createCalendarEvent(input) {
      const event: CalendarEvent = {
        id: newId('calendar-event'),
        title: input.title,
        date: input.date,
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        description: input.description || null,
        sourceTaskId: null,
        googleSyncStatus: 'pending',
        googleSyncError: null,
        source: 'local',
        recurrence: normalizeRecurrence(input.recurrence),
        createdAt: new Date().toISOString(),
      };
      update((draft) => {
        draft.calendarEvents.unshift(event);
        pushAudit(draft, 'calendar.update', 'calendarEvent', event.title, { entityId: event.id, description: 'Создано событие календаря.' });
      });
      void syncGoogleEvent(event);
    },
    updateCalendarEvent(id, input) {
      let eventToSync: CalendarEvent | null = null;
      update((draft) => {
        const event = draft.calendarEvents.find((item) => item.id === id);
        if (event) {
          Object.assign(event, input, input.recurrence !== undefined ? { recurrence: normalizeRecurrence(input.recurrence) } : {});
          eventToSync = { ...event };
          pushAudit(draft, 'calendar.update', 'calendarEvent', event.title, { entityId: event.id, description: 'Обновлено событие календаря.' });
        }
      });
      if (eventToSync) void syncGoogleEvent(eventToSync);
    },
    deleteCalendarEvent(id) {
      const googleEventId = state.calendarEvents.find((event) => event.id === id)?.googleEventId;
      update((draft) => {
        const event = draft.calendarEvents.find((event) => event.id === id);
        draft.calendarEvents = draft.calendarEvents.filter((event) => event.id !== id);
        draft.tasks.forEach((task) => {
          if (task.calendarEventId === id) {
            task.calendarEventId = null;
            task.addToCalendar = false;
          }
        });
        if (event) pushAudit(draft, 'calendar.update', 'calendarEvent', event.title, { entityId: event.id, description: 'Удалено событие календаря.' });
      });
      if (googleEventId && !isGoogleTaskEventId(googleEventId)) void removeGoogleCalendarEvent(googleEventId).catch(() => undefined);
    },
    createExpenseCategory(name) {
      if (!name.trim()) return;
      update((draft) => {
        if (draft.expenseCategories.some((category) => category.name.toLowerCase() === name.trim().toLowerCase())) return;
        draft.expenseCategories.push({ id: newId('expense-category'), name: name.trim(), createdAt: new Date().toISOString() });
      });
    },
    deleteExpenseCategory(id) {
      update((draft) => {
        draft.expenseCategories = draft.expenseCategories.filter((category) => category.id !== id);
      });
    },
    createExpense(input) {
      update((draft) => {
        const id = newId('expense');
        draft.expenses.unshift({ id, date: input.date, amount: input.amount, account: input.account, category: input.category, studio: input.studio, comment: input.comment || null, createdAt: new Date().toISOString() });
        pushAudit(draft, 'finance.update', 'expense', input.category, { entityId: id, description: `Добавлен расход ${input.amount.toLocaleString('ru-RU')} ₽.` });
      });
    },
    updateExpense(id, input) {
      update((draft) => {
        const expense = draft.expenses.find((item) => item.id === id);
        if (expense) {
          Object.assign(expense, input);
          pushAudit(draft, 'finance.update', 'expense', expense.category, { entityId: expense.id, description: 'Обновлён расход.' });
        }
      });
    },
    deleteExpense(id) {
      update((draft) => {
        const expense = draft.expenses.find((item) => item.id === id);
        draft.expenses = draft.expenses.filter((expense) => expense.id !== id);
        if (expense) pushAudit(draft, 'finance.update', 'expense', expense.category, { entityId: expense.id, description: 'Удалён расход.' });
      });
    },
    createTrainerEvaluation(input) {
      if (!input.trainerName.trim() || !input.direction.trim() || !input.sheetUrl.trim() || !input.evaluatedAt) return;
      update((draft) => {
        draft.trainerEvaluations.unshift({
          id: newId('trainer-evaluation'),
          trainerName: input.trainerName.trim(),
          studio: input.studio,
          direction: input.direction.trim(),
          score: Number(input.score) || 0,
          evaluatedAt: input.evaluatedAt,
          sheetUrl: input.sheetUrl.trim(),
          createdAt: new Date().toISOString(),
          createdById: currentUser?.id ?? null,
        });
      });
    },
    updateTrainerEvaluation(id, input) {
      update((draft) => {
        const evaluation = draft.trainerEvaluations.find((item) => item.id === id);
        if (!evaluation) return;
        Object.assign(evaluation, input);
        evaluation.trainerName = evaluation.trainerName.trim();
        evaluation.direction = evaluation.direction.trim();
        evaluation.sheetUrl = evaluation.sheetUrl.trim();
        evaluation.score = Number(evaluation.score) || 0;
      });
    },
    deleteTrainerEvaluation(id) {
      update((draft) => {
        draft.trainerEvaluations = draft.trainerEvaluations.filter((evaluation) => evaluation.id !== id);
      });
    },
    updateSettings(input) {
      update((draft) => {
        draft.settings = { ...draft.settings, ...input };
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(draft.settings));
        }
      }, false);
    },
  }), [currentUser, googleCalendarStatus, state]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used inside LibraryProvider');
  return context;
}
