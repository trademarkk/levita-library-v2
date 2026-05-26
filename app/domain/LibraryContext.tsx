import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { adminChecklistItems, initialState } from './seed';
import { normalizeHashtags, roleRoutes } from './labels';
import type {
  AppSettings,
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
  HelpfulLink,
  KnowledgeCategory,
  KnowledgeEntry,
  LibraryState,
  OwnerChecklistReport,
  RefundCase,
  RefundStatus,
  Role,
  TaskTemplate,
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
  createTemplate: (input: { title: string; body: string; role: Role; purpose?: string; createdById?: string }) => void;
  updateTemplate: (id: string, input: Partial<{ title: string; body: string; role: Role; purpose: string }>) => void;
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
  createKnowledge: (input: { title: string; content: string; role: Role; category: KnowledgeCategory; hashtags?: string; isActual?: boolean }) => void;
  updateKnowledge: (id: string, input: Partial<Pick<KnowledgeEntry, 'title' | 'content' | 'hashtags' | 'role' | 'category' | 'isActual'>>) => void;
  deleteKnowledge: (id: string) => void;
  createImportantInfo: (title: string, content: string, hashtags?: string) => void;
  updateImportantInfo: (id: string, input: Partial<Pick<KnowledgeEntry, 'title' | 'content' | 'hashtags'>>) => void;
  deleteImportantInfo: (id: string) => void;
  toggleChecklistItem: (checklistId: string, itemId: string, userId?: string) => void;
  addChecklistItem: (checklistId: string, label: string) => void;
  deleteChecklistItem: (checklistId: string, itemId: string) => void;
  updateChecklistReport: (checklistId: string, slot: ChecklistReportSlot, input: Partial<Omit<ChecklistReport, 'slot'>>) => void;
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
  updateSettings: (input: Partial<AppSettings>) => void;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function cloneState(state: LibraryState): LibraryState {
  return JSON.parse(JSON.stringify(state)) as LibraryState;
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function startOfTodayIso() {
  return dateKey();
}

function dateKey(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  return { slot, adminName, calls: '', reached: '', bookings: '', cash: '', came: '', bought: '', submittedAt: null, sentToTelegram: false, telegramSentAt: null };
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
    reports: isAdminRole ? [blankReport('14:00', user.name), blankReport('18:00', user.name), blankReport('22:00', user.name)] : [],
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
  return {
    ...report,
    submittedAt,
    sentToTelegram: Boolean(submittedAt && (report.sentToTelegram || telegramSentAt)),
    telegramSentAt: submittedAt ? telegramSentAt : null,
  };
}

function mergeChecklistReports(left: ChecklistReport[], right: ChecklistReport[]) {
  return (['14:00', '18:00', '22:00'] as ChecklistReportSlot[]).map((slot) => {
    const primary = left.find((report) => report.slot === slot);
    const incoming = right.find((report) => report.slot === slot);
    const report = { ...blankReport(slot, primary?.adminName || incoming?.adminName || ''), ...primary, ...incoming };
    const submittedAt = latestIso(primary?.submittedAt, incoming?.submittedAt);
    const telegramSentAt = latestIso(primary?.telegramSentAt, incoming?.telegramSentAt);
    return normalizeChecklistReportForToday({
      ...report,
      submittedAt,
      sentToTelegram: Boolean((primary?.sentToTelegram || incoming?.sentToTelegram) && submittedAt),
      telegramSentAt,
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
  };
}

function mergeChecklistReportsForDate(left: ChecklistReport[], right: ChecklistReport[], targetDate: string) {
  return (['14:00', '18:00', '22:00'] as ChecklistReportSlot[]).map((slot) => {
    const primary = left.find((report) => report.slot === slot);
    const incoming = right.find((report) => report.slot === slot);
    const report = { ...blankReport(slot, primary?.adminName || incoming?.adminName || ''), ...primary, ...incoming };
    const submittedAt = latestIso(primary?.submittedAt, incoming?.submittedAt);
    const telegramSentAt = latestIso(primary?.telegramSentAt, incoming?.telegramSentAt);
    return normalizeChecklistReportForDate({
      ...report,
      submittedAt,
      sentToTelegram: Boolean((primary?.sentToTelegram || incoming?.sentToTelegram) && submittedAt),
      telegramSentAt,
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
    password: user.password || 'demo',
    status: user.status === 'on-leave' ? 'blocked' : user.status || 'active',
    createdAt: user.createdAt || new Date().toISOString(),
    joinDate: user.joinDate || 'май 2026',
  })) as User[];

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
          ? (['14:00', '18:00', '22:00'] as ChecklistReportSlot[]).map((slot) => {
              const existing = checklist.reports?.find((report) => report.slot === slot);
              const report = { ...blankReport(slot, assignee?.name ?? ''), ...existing };
              return {
                ...normalizeChecklistReportForDate({
                  ...report,
                  telegramSentAt: report.telegramSentAt ?? (report.sentToTelegram ? report.submittedAt ?? null : null),
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
    templates: (raw.templates || base.templates).map((template) => ({ ...template, ownerUserId: undefined })),
    links: (raw.links || base.links).map((link) => ({ ...link, ownerUserId: undefined })),
    documentTemplates: raw.documentTemplates || base.documentTemplates,
    usefulContacts: raw.usefulContacts || base.usefulContacts,
    financialPlans: raw.financialPlans || base.financialPlans,
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
  return (['14:00', '18:00', '22:00'] as ChecklistReportSlot[]).find((slot) => findReportItem(checklist, slot)?.id === itemId) ?? null;
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

  return {
    done: onTime,
    submitted,
    onTime,
    label: item?.label ?? REPORT_ALIASES[slot][0],
    completedAt,
    telegramSent,
    telegramSentAt,
    telegramOnTime,
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
      const databaseState = await loadDatabaseState();
      const authState = databaseState ?? state;
      if (databaseState) setState(databaseState);
      const normalized = normalizeEmail(email);
      if (!normalized || !password.trim()) return { ok: false, error: 'Введите email и пароль.' };
      let user = authState.users.find((item) => normalizeEmail(item.email) === normalized);
      const seedUser = initialState.users.find((item) => normalizeEmail(item.email) === normalized);
      if (!user && seedUser) {
        if (seedUser.password !== password) return { ok: false, error: 'Неверный пароль.' };
        user = seedUser;
        const nextState = normalizeState({
          ...authState,
          users: [seedUser, ...authState.users.filter((item) => item.id !== seedUser.id)],
          checklists: [
            ...initialState.checklists.filter((checklist) => checklist.assignedTo === seedUser.id),
            ...authState.checklists.filter((checklist) => checklist.assignedTo !== seedUser.id),
          ],
        });
        setState(nextState);
        void saveDatabaseState(nextState);
      }
      if (!user) return { ok: false, error: 'Пользователь с таким email не найден.' };
      if (user.status === 'blocked') return { ok: false, error: 'Доступ сотрудника заблокирован.' };
      if (user.password && user.password !== password) return { ok: false, error: 'Неверный пароль.' };
      setCurrentUserId(user.id);
      return { ok: true, route: roleRoutes[user.role] };
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
      });
    },
    updateEmployee(id, input) {
      update((draft) => {
        const user = draft.users.find((item) => item.id === id);
        if (!user) return;
        Object.assign(user, input, input.email ? { email: normalizeEmail(input.email) } : {});
      });
    },
    deleteEmployee(id) {
      update((draft) => {
        const user = draft.users.find((item) => item.id === id);
        if (!user || user.role === 'OWNER') return;
        draft.users = draft.users.filter((item) => item.id !== id);
        draft.checklists = draft.checklists.filter((item) => item.assignedTo !== id);
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
      });
      if (calendarEvent) void syncGoogleEvent(calendarEvent);
    },
    updateTask(id, input) {
      let eventToSync: CalendarEvent | null = null;
      update((draft) => {
        const task = draft.tasks.find((item) => item.id === id);
        if (!task) return;
        Object.assign(task, input);
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
        draft.templates.unshift({ id: newId('template'), createdAt: new Date().toISOString(), createdById: input.createdById ?? currentUser?.id ?? 'system', purpose: input.purpose || null, title: input.title, body: input.body, role: input.role });
      });
    },
    updateTemplate(id, input) {
      update((draft) => {
        const template = draft.templates.find((item) => item.id === id);
        if (template) Object.assign(template, input);
      });
    },
    deleteTemplate(id) {
      update((draft) => {
        draft.templates = draft.templates.filter((template) => template.id !== id);
      });
    },
    createLink(input) {
      update((draft) => {
        draft.links.unshift({ id: newId('link'), title: input.title, url: input.url, category: input.category ?? 'HELPFUL', role: input.role, description: input.description || null, createdAt: new Date().toISOString() });
      });
    },
    updateLink(id, input) {
      update((draft) => {
        const link = draft.links.find((item) => item.id === id);
        if (link) Object.assign(link, input);
      });
    },
    deleteLink(id) {
      update((draft) => {
        draft.links = draft.links.filter((link) => link.id !== id);
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
        draft.knowledge.unshift({ id: newId('knowledge'), title: input.title, content: input.content, role: input.role, category: input.category, hashtags: normalizeHashtags(input.hashtags ?? '') || null, isActual: input.isActual ?? true, searchable: true, createdAt: new Date().toISOString() });
      });
    },
    updateKnowledge(id, input) {
      update((draft) => {
        const entry = draft.knowledge.find((item) => item.id === id);
        if (!entry) return;
        Object.assign(entry, input, input.hashtags !== undefined ? { hashtags: normalizeHashtags(input.hashtags) } : {});
      });
    },
    deleteKnowledge(id) {
      update((draft) => {
        draft.knowledge = draft.knowledge.filter((item) => item.id !== id);
      });
    },
    createImportantInfo(title, content, hashtags) {
      update((draft) => {
        draft.knowledge.unshift({ id: newId('knowledge'), title, content, role: 'ADMIN', category: 'IMPORTANT_INFO', hashtags: normalizeHashtags(hashtags ?? '') || null, searchable: true, createdAt: new Date().toISOString() });
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
        let report = checklist.reports.find((entry) => entry.slot === slot);
        if (!report) {
          report = blankReport(slot, draft.users.find((user) => user.id === checklist.assignedTo)?.name ?? '');
          checklist.reports.push(report);
        }
        report.submittedAt = item.completedAt;
        report.sentToTelegram = Boolean(item.completed && draft.settings.telegramReports);
        report.telegramSentAt = item.completed && draft.settings.telegramReports ? item.completedAt : null;
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
    updateChecklistReport(checklistId, slot, input) {
      update((draft) => {
        const checklist = draft.checklists.find((item) => item.id === checklistId);
        if (!checklist) return;
        const report = checklist.reports.find((item) => item.slot === slot);
        if (!report) return;
        const submittedAt = new Date().toISOString();
        Object.assign(report, input, {
          submittedAt,
          sentToTelegram: draft.settings.telegramReports,
          telegramSentAt: draft.settings.telegramReports ? submittedAt : null,
        });
        const checklistItem = findReportItem(checklist, slot);
        if (checklistItem) {
          checklistItem.completed = true;
          checklistItem.completedAt = submittedAt;
          checklistItem.completedBy = currentUser?.id ?? checklist.assignedTo;
        }
      });
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
        let plan = draft.financialPlans.find((item) => item.month === month);
        if (!plan) {
          plan = { month, rows: [] };
          draft.financialPlans.push(plan);
        }
        plan.rows.push({ id: newId('financial-row'), title, payments: {} });
      });
    },
    updateFinancialPlanRow(month, rowId, title) {
      update((draft) => {
        const row = draft.financialPlans.find((item) => item.month === month)?.rows.find((item) => item.id === rowId);
        if (row) row.title = title;
      });
    },
    deleteFinancialPlanRow(month, rowId) {
      update((draft) => {
        const plan = draft.financialPlans.find((item) => item.month === month);
        if (plan) plan.rows = plan.rows.filter((row) => row.id !== rowId);
      });
    },
    updateFinancialPlanCell(month, rowId, date, value) {
      update((draft) => {
        let plan = draft.financialPlans.find((item) => item.month === month);
        if (!plan) {
          plan = { month, rows: [] };
          draft.financialPlans.push(plan);
        }
        const row = plan.rows.find((item) => item.id === rowId);
        if (!row) return;
        if (value.trim()) row.payments[date] = value;
        else delete row.payments[date];
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
        }
      });
      if (eventToSync) void syncGoogleEvent(eventToSync);
    },
    deleteCalendarEvent(id) {
      const googleEventId = state.calendarEvents.find((event) => event.id === id)?.googleEventId;
      update((draft) => {
        draft.calendarEvents = draft.calendarEvents.filter((event) => event.id !== id);
        draft.tasks.forEach((task) => {
          if (task.calendarEventId === id) {
            task.calendarEventId = null;
            task.addToCalendar = false;
          }
        });
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
        draft.expenses.unshift({ id: newId('expense'), date: input.date, amount: input.amount, account: input.account, category: input.category, studio: input.studio, comment: input.comment || null, createdAt: new Date().toISOString() });
      });
    },
    updateExpense(id, input) {
      update((draft) => {
        const expense = draft.expenses.find((item) => item.id === id);
        if (expense) Object.assign(expense, input);
      });
    },
    deleteExpense(id) {
      update((draft) => {
        draft.expenses = draft.expenses.filter((expense) => expense.id !== id);
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
