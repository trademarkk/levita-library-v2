import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

const FINANCIAL_PLAN_FORWARD_MONTHS = 36;
const ADMIN_CHECKLIST_ITEMS = [
  'Проверить чистоту студии: зеркала, углы и поверхности',
  'Отправить кружок об открытии студии до 09:30',
  'Скинуть план в чат до 10:00',
  'Проверить актуальность расписания и замен',
  'Проверить входящие сообщения и пропущенные звонки',
  'Отчет по звонкам и кассе в 14:00',
  'Проверить оплату пробных и абонементов',
  'Проверить заявки и записи на сегодня',
  'Отчет по звонкам в 18:00',
  'Проверить чистоту зала после вечерних занятий',
  'Поставить терминал и телефон на зарядку',
];

export function createPrisma() {
  return new PrismaClient({
    log: process.env.PRISMA_QUERY_LOG === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

function moscowDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}

export async function closeDuePrismaAdminShifts(prisma, nowDate = new Date()) {
  await prisma.$executeRawUnsafe('alter table public.admin_shifts add column if not exists closed_at timestamptz');
  const now = nowDate.toISOString();
  const current = moscowDateParts(nowDate);
  if (current.hour < 23) {
    return { ok: true, skipped: true, reason: 'before-23-msk', closed: 0, date: current.date };
  }
  const result = await prisma.$executeRaw`
    update public.admin_shifts
    set closed_at = ${now}::timestamptz,
        updated_at = now()
    where closed_at is null
      and shift_date <= ${current.date}::date
  `;
  return { ok: true, skipped: false, closed: Number(result) || 0, date: current.date, closedAt: now };
}

function newId(prefix) {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function localDateOnly(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateOnly(value) {
  if (!value) return localDateOnly();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return localDateOnly(date);
}

function timeOnly(value) {
  return value ? String(value).slice(0, 5) : null;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeBusinessModel(value) {
  return ['SUBSCRIPTION', 'MEMBERSHIP', 'ALL'].includes(value) ? value : 'ALL';
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 210_000, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$210000$${salt}$${hash}`;
}

function addMonths(month, offset) {
  const [year, monthIndex] = String(month).split('-').map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(month) {
  const [year, monthIndex] = String(month).split('-').map(Number);
  return new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
}

function clampDate(targetMonth, sourceDate) {
  const day = Number(String(sourceDate).slice(-2));
  const safeDay = Math.min(Math.max(day || 1, 1), daysInMonth(targetMonth));
  return `${targetMonth}-${String(safeDay).padStart(2, '0')}`;
}

function monthBounds(month) {
  const safeMonth = /^\d{4}-\d{2}$/.test(String(month || '')) ? String(month) : localDateOnly().slice(0, 7);
  const [year, monthIndex] = safeMonth.split('-').map(Number);
  const start = `${safeMonth}-01`;
  const endDate = new Date(Date.UTC(year, monthIndex, 0));
  const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}`;
  return { month: safeMonth, start, end };
}

function financialBaseId(rowId) {
  return String(rowId || '').replace(/^\d{4}-\d{2}:/, '');
}

function storageFinancialRowId(month, rowId) {
  const base = financialBaseId(rowId);
  return String(rowId || '').startsWith(`${month}:`) ? rowId : `${month}:${base}`;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function jsonValue(value) {
  return value === undefined ? Prisma.JsonNull : value;
}

async function selectTable(prisma, table, order = '') {
  const suffix = order ? ` order by ${order}` : '';
  return prisma.$queryRawUnsafe(`select * from public.${table}${suffix}`);
}

function mapUser(row) {
  const createdAt = row.created_at?.toISOString?.() || row.created_at;
  const joinDate = !row.join_date || String(row.join_date).includes('?')
    ? new Intl.DateTimeFormat('ru-RU', { month: 'short', year: 'numeric' }).format(new Date(createdAt || Date.now())).replace('.', '')
    : row.join_date;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash || undefined,
    password: row.legacy_password || undefined,
    role: row.role,
    status: row.status,
    joinDate,
    createdAt,
  };
}

function iso(value) {
  return value?.toISOString?.() || value || null;
}

function mapChecklistRows(checklists, checklistItems, checklistReports) {
  const itemsByChecklist = new Map();
  for (const item of checklistItems) {
    const list = itemsByChecklist.get(item.checklist_id) || [];
    list.push({ id: item.id, label: item.label, completed: Boolean(item.completed), completedAt: iso(item.completed_at), completedBy: item.completed_by });
    itemsByChecklist.set(item.checklist_id, list);
  }

  const reportsByChecklist = new Map();
  for (const report of checklistReports) {
    const list = reportsByChecklist.get(report.checklist_id) || [];
    list.push({
      slot: report.slot,
      studio: report.studio || 'STAVROPOLSKAYA',
      adminName: report.admin_name,
      calls: report.calls || '',
      reached: report.reached || '',
      bookings: report.bookings || '',
      cash: report.cash || '',
      came: report.came || '',
      bought: report.bought || '',
      submittedAt: iso(report.submitted_at),
      sentToTelegram: Boolean(report.sent_to_telegram),
      telegramSentAt: iso(report.telegram_sent_at),
      sentToMax: Boolean(report.sent_to_max),
      maxSentAt: iso(report.max_sent_at),
      maxSendError: report.max_send_error,
      maxMessageId: report.max_message_id,
    });
    reportsByChecklist.set(report.checklist_id, list);
  }

  return checklists.map((checklist) => ({
    id: checklist.id,
    title: checklist.title,
    role: checklist.role,
    assignedTo: checklist.assigned_to,
    date: dateOnly(checklist.checklist_date),
    createdAt: iso(checklist.created_at),
    items: itemsByChecklist.get(checklist.id) || [],
    reports: reportsByChecklist.get(checklist.id) || [],
  }));
}

function mapFinancialPlans(financialMonths, financialRows, financialPayments) {
  const paymentsByRow = new Map();
  for (const payment of financialPayments) {
    const payments = paymentsByRow.get(payment.row_id) || {};
    payments[dateOnly(payment.payment_date)] = payment.value || '';
    paymentsByRow.set(payment.row_id, payments);
  }

  const rowsByMonth = new Map();
  for (const row of financialRows) {
    const list = rowsByMonth.get(row.month) || [];
    list.push({ id: row.id, title: row.title, payments: paymentsByRow.get(row.id) || {} });
    rowsByMonth.set(row.month, list);
  }

  return financialMonths.map((month) => ({ month: month.month, rows: rowsByMonth.get(month.month) || [] }));
}

export async function readStateFromPrisma(prisma) {
  const [
    users, tasks, templates, links, documentTemplates, usefulContacts, knowledge, favorites, readReceipts,
    checklists, checklistItems, checklistReports, refunds, financialMonths, financialRows, financialPayments,
    calendarEvents, expenseCategories, expenses, trainerEvaluations, callReviews, callChecklistItems,
    adminShifts, auditLog, settingsRows,
  ] = await Promise.all([
    selectTable(prisma, 'users', 'created_at asc'),
    selectTable(prisma, 'tasks', 'created_at asc'),
    selectTable(prisma, 'response_templates', 'created_at asc'),
    selectTable(prisma, 'helpful_links', 'created_at asc'),
    selectTable(prisma, 'document_templates', 'created_at asc'),
    selectTable(prisma, 'useful_contacts', 'created_at asc'),
    selectTable(prisma, 'knowledge_entries', 'created_at asc'),
    selectTable(prisma, 'content_favorites', 'created_at asc'),
    selectTable(prisma, 'content_read_receipts', 'read_at asc'),
    selectTable(prisma, 'daily_checklists', 'checklist_date asc'),
    selectTable(prisma, 'checklist_items', 'position asc'),
    selectTable(prisma, 'checklist_reports', 'slot asc'),
    selectTable(prisma, 'refunds', 'requested_at desc'),
    selectTable(prisma, 'financial_plan_months', 'month asc'),
    selectTable(prisma, 'financial_plan_rows', 'position asc'),
    selectTable(prisma, 'financial_plan_payments', 'payment_date asc'),
    selectTable(prisma, 'calendar_events', 'event_date asc, start_time asc'),
    selectTable(prisma, 'expense_categories', 'created_at asc'),
    selectTable(prisma, 'expenses', 'expense_date desc'),
    selectTable(prisma, 'trainer_evaluation_sheets', 'evaluated_at desc'),
    selectTable(prisma, 'call_reviews', 'reviewed_at desc'),
    selectTable(prisma, 'call_checklist_items', 'position asc'),
    selectTable(prisma, 'admin_shifts', 'started_at desc'),
    selectTable(prisma, 'audit_log', 'created_at desc'),
    selectTable(prisma, 'app_settings'),
  ]);

  if (!users.length && !knowledge.length && !checklists.length) return null;

  const itemsByChecklist = new Map();
  for (const item of checklistItems) {
    const list = itemsByChecklist.get(item.checklist_id) || [];
    list.push({ id: item.id, label: item.label, completed: Boolean(item.completed), completedAt: iso(item.completed_at), completedBy: item.completed_by });
    itemsByChecklist.set(item.checklist_id, list);
  }

  const reportsByChecklist = new Map();
  for (const report of checklistReports) {
    const list = reportsByChecklist.get(report.checklist_id) || [];
    list.push({
      slot: report.slot,
      studio: report.studio || 'STAVROPOLSKAYA',
      adminName: report.admin_name,
      calls: report.calls || '',
      reached: report.reached || '',
      bookings: report.bookings || '',
      cash: report.cash || '',
      came: report.came || '',
      bought: report.bought || '',
      submittedAt: iso(report.submitted_at),
      sentToTelegram: Boolean(report.sent_to_telegram),
      telegramSentAt: iso(report.telegram_sent_at),
      sentToMax: Boolean(report.sent_to_max),
      maxSentAt: iso(report.max_sent_at),
      maxSendError: report.max_send_error,
      maxMessageId: report.max_message_id,
    });
    reportsByChecklist.set(report.checklist_id, list);
  }

  const paymentsByRow = new Map();
  for (const payment of financialPayments) {
    const payments = paymentsByRow.get(payment.row_id) || {};
    payments[dateOnly(payment.payment_date)] = payment.value || '';
    paymentsByRow.set(payment.row_id, payments);
  }

  const rowsByMonth = new Map();
  for (const row of financialRows) {
    const list = rowsByMonth.get(row.month) || [];
    list.push({ id: row.id, title: row.title, payments: paymentsByRow.get(row.id) || {} });
    rowsByMonth.set(row.month, list);
  }

  const settings = settingsRows.find((row) => row.id === 'main')?.payload || { colorMode: 'dark', density: 'comfortable', animations: true, telegramReports: true };
  const updatedAt = [...users, ...tasks, ...knowledge, ...checklists, ...calendarEvents, ...callReviews]
    .map((row) => row.updated_at || row.created_at)
    .filter(Boolean)
    .sort()
    .at(-1) || new Date();

  return {
    updatedAt: iso(updatedAt),
    state: {
      schemaVersion: 4,
      users: users.map(mapUser),
      tasks: tasks.map((task) => ({ id: task.id, title: task.title, description: task.description || '', period: task.period || '', role: task.role, priority: task.priority, status: task.status, deadline: dateOnly(task.deadline), addToCalendar: Boolean(task.add_to_calendar), calendarEventId: task.calendar_event_id, createdAt: iso(task.created_at) })),
      templates: templates.map((template) => ({ id: template.id, title: template.title, body: template.body, role: template.role, businessModel: template.business_model, purpose: template.purpose, createdById: template.created_by_id, createdAt: iso(template.created_at) })),
      links: links.map((link) => ({ id: link.id, title: link.title, url: link.url, category: link.category, role: link.role, description: link.description, createdAt: iso(link.created_at) })),
      documentTemplates: documentTemplates.map((template) => ({ id: template.id, title: template.title, url: template.url, createdById: template.created_by_id, createdAt: iso(template.created_at) })),
      usefulContacts: usefulContacts.map((contact) => ({ id: contact.id, name: contact.name, phone: contact.phone, company: contact.company, specialty: contact.specialty, createdAt: iso(contact.created_at) })),
      knowledge: knowledge.map((entry) => ({ id: entry.id, title: entry.title, content: entry.content, role: entry.role, category: entry.category, businessModel: entry.business_model, hashtags: entry.hashtags, isActual: entry.is_actual, searchable: entry.searchable, createdAt: iso(entry.created_at) })),
      checklists: checklists.map((checklist) => ({ id: checklist.id, title: checklist.title, role: checklist.role, assignedTo: checklist.assigned_to, date: dateOnly(checklist.checklist_date), createdAt: iso(checklist.created_at), items: itemsByChecklist.get(checklist.id) || [], reports: reportsByChecklist.get(checklist.id) || [] })),
      refunds: refunds.map((refund) => ({ id: refund.id, clientName: refund.client_name, requestedAt: iso(refund.requested_at), amount: Number(refund.amount) || 0, reason: refund.reason, status: refund.status, comment: refund.comment, createdAt: iso(refund.created_at) })),
      financialPlans: financialMonths.map((month) => ({ month: month.month, rows: rowsByMonth.get(month.month) || [] })),
      calendarEvents: calendarEvents.map((event) => ({ id: event.id, title: event.title, date: dateOnly(event.event_date), startTime: timeOnly(event.start_time), endTime: timeOnly(event.end_time), description: event.description, sourceTaskId: event.source_task_id, googleEventId: event.google_event_id, googleRecurringEventId: event.google_recurring_event_id, googleHtmlLink: event.google_html_link, googleSyncStatus: event.google_sync_status, googleSyncError: event.google_sync_error, source: event.source, sourceName: event.source_name, recurrence: event.recurrence, createdAt: iso(event.created_at) })),
      expenseCategories: expenseCategories.map((category) => ({ id: category.id, name: category.name, createdAt: iso(category.created_at) })),
      expenses: expenses.map((expense) => ({ id: expense.id, date: dateOnly(expense.expense_date), amount: Number(expense.amount) || 0, account: expense.account, category: expense.category, studio: expense.studio, comment: expense.comment, createdAt: iso(expense.created_at) })),
      trainerEvaluations: trainerEvaluations.map((evaluation) => ({ id: evaluation.id, trainerName: evaluation.trainer_name, studio: evaluation.studio, direction: evaluation.direction, score: Number(evaluation.score) || 0, evaluatedAt: dateOnly(evaluation.evaluated_at), sheetUrl: evaluation.sheet_url, createdById: evaluation.created_by_id, createdAt: iso(evaluation.created_at) })),
      callReviews: callReviews.map((review) => ({ id: review.id, source: review.source || 'levita-calls', externalId: review.external_id, adminName: review.admin_name, studio: review.studio, score: Number(review.score) || 0, reviewedAt: dateOnly(review.reviewed_at), amoCrmDealUrl: review.amo_crm_deal_url, callUrl: review.call_url, originalFilename: review.original_filename, comment: review.comment, createdAt: iso(review.created_at), updatedAt: iso(review.updated_at) })),
      favorites: favorites.map((favorite) => ({ id: favorite.id, userId: favorite.user_id, entityType: favorite.entity_type, entityId: favorite.entity_id, createdAt: iso(favorite.created_at) })),
      readReceipts: readReceipts.map((receipt) => ({ id: receipt.id, userId: receipt.user_id, entityType: 'knowledge', entityId: receipt.entity_id, readAt: iso(receipt.read_at) })),
      callChecklist: callChecklistItems.map((item) => item.label),
      adminShifts: adminShifts.map((shift) => ({ id: shift.id, userId: shift.user_id, adminName: shift.admin_name, studio: shift.studio, date: dateOnly(shift.shift_date), startedAt: iso(shift.started_at), closedAt: iso(shift.closed_at), remindersScheduledAt: iso(shift.reminders_scheduled_at), reminderScheduleError: shift.reminder_schedule_error })),
      auditLog: auditLog.map((entry) => ({ id: entry.id, action: entry.action, entityType: entry.entity_type, entityId: entry.entity_id, entityLabel: entry.entity_label, description: entry.description, actorId: entry.actor_id, actorName: entry.actor_name, actorRole: entry.actor_role, createdAt: iso(entry.created_at) })),
      settings,
    },
  };
}

export async function readStateSliceFromPrisma(prisma, slice, params = {}) {
  const month = params.month || localDateOnly().slice(0, 7);
  const bounds = monthBounds(month);

  switch (slice) {
    case 'bootstrap': {
      const [users, settingsRows] = await Promise.all([
        selectTable(prisma, 'users', 'created_at asc'),
        selectTable(prisma, 'app_settings'),
      ]);
      const settings = settingsRows.find((row) => row.id === 'main')?.payload || { colorMode: 'dark', density: 'comfortable', animations: true, telegramReports: true };
      return { updatedAt: nowIso(), state: { users: users.map(mapUser), settings } };
    }
    case 'tasks': {
      const tasks = await selectTable(prisma, 'tasks', 'created_at asc');
      return { updatedAt: nowIso(), state: { tasks: tasks.map((task) => ({ id: task.id, title: task.title, description: task.description || '', period: task.period || '', role: task.role, priority: task.priority, status: task.status, deadline: dateOnly(task.deadline), addToCalendar: Boolean(task.add_to_calendar), calendarEventId: task.calendar_event_id, createdAt: iso(task.created_at) })) } };
    }
    case 'content': {
      const [knowledge, templates, links, documentTemplates, usefulContacts, favorites, readReceipts] = await Promise.all([
        selectTable(prisma, 'knowledge_entries', 'created_at asc'),
        selectTable(prisma, 'response_templates', 'created_at asc'),
        selectTable(prisma, 'helpful_links', 'created_at asc'),
        selectTable(prisma, 'document_templates', 'created_at asc'),
        selectTable(prisma, 'useful_contacts', 'created_at asc'),
        selectTable(prisma, 'content_favorites', 'created_at asc'),
        selectTable(prisma, 'content_read_receipts', 'read_at asc'),
      ]);
      return {
        updatedAt: nowIso(),
        state: {
          knowledge: knowledge.map((entry) => ({ id: entry.id, title: entry.title, content: entry.content, role: entry.role, category: entry.category, businessModel: entry.business_model, hashtags: entry.hashtags, isActual: entry.is_actual, searchable: entry.searchable, createdAt: iso(entry.created_at) })),
          templates: templates.map((template) => ({ id: template.id, title: template.title, body: template.body, role: template.role, businessModel: template.business_model, purpose: template.purpose, createdById: template.created_by_id, createdAt: iso(template.created_at) })),
          links: links.map((link) => ({ id: link.id, title: link.title, url: link.url, category: link.category, role: link.role, description: link.description, createdAt: iso(link.created_at) })),
          documentTemplates: documentTemplates.map((template) => ({ id: template.id, title: template.title, url: template.url, createdById: template.created_by_id, createdAt: iso(template.created_at) })),
          usefulContacts: usefulContacts.map((contact) => ({ id: contact.id, name: contact.name, phone: contact.phone, company: contact.company, specialty: contact.specialty, createdAt: iso(contact.created_at) })),
          favorites: favorites.map((favorite) => ({ id: favorite.id, userId: favorite.user_id, entityType: favorite.entity_type, entityId: favorite.entity_id, createdAt: iso(favorite.created_at) })),
          readReceipts: readReceipts.map((receipt) => ({ id: receipt.id, userId: receipt.user_id, entityType: 'knowledge', entityId: receipt.entity_id, readAt: iso(receipt.read_at) })),
        },
      };
    }
    case 'checklists':
    case 'control': {
      const [users, checklists, checklistItems, checklistReports, adminShifts, refunds, tasks] = await Promise.all([
        selectTable(prisma, 'users', 'created_at asc'),
        selectTable(prisma, 'daily_checklists', 'checklist_date asc'),
        selectTable(prisma, 'checklist_items', 'position asc'),
        selectTable(prisma, 'checklist_reports', 'slot asc'),
        selectTable(prisma, 'admin_shifts', 'started_at desc'),
        selectTable(prisma, 'refunds', 'requested_at desc'),
        selectTable(prisma, 'tasks', 'created_at asc'),
      ]);
      return {
        updatedAt: nowIso(),
        state: {
          users: users.map(mapUser),
          checklists: mapChecklistRows(checklists, checklistItems, checklistReports),
          adminShifts: adminShifts.map((shift) => ({ id: shift.id, userId: shift.user_id, adminName: shift.admin_name, studio: shift.studio, date: dateOnly(shift.shift_date), startedAt: iso(shift.started_at), closedAt: iso(shift.closed_at), remindersScheduledAt: iso(shift.reminders_scheduled_at), reminderScheduleError: shift.reminder_schedule_error })),
          refunds: refunds.map((refund) => ({ id: refund.id, clientName: refund.client_name, requestedAt: iso(refund.requested_at), amount: Number(refund.amount) || 0, reason: refund.reason, status: refund.status, comment: refund.comment, createdAt: iso(refund.created_at) })),
          tasks: tasks.map((task) => ({ id: task.id, title: task.title, description: task.description || '', period: task.period || '', role: task.role, priority: task.priority, status: task.status, deadline: dateOnly(task.deadline), addToCalendar: Boolean(task.add_to_calendar), calendarEventId: task.calendar_event_id, createdAt: iso(task.created_at) })),
        },
      };
    }
    case 'financial-plan': {
      const [financialMonths, financialRows, financialPayments] = await Promise.all([
        prisma.$queryRaw`select * from public.financial_plan_months where month = ${bounds.month} order by month asc`,
        prisma.$queryRaw`select * from public.financial_plan_rows where month = ${bounds.month} order by position asc`,
        prisma.$queryRaw`select * from public.financial_plan_payments where payment_date >= ${bounds.start}::date and payment_date <= ${bounds.end}::date order by payment_date asc`,
      ]);
      return { updatedAt: nowIso(), state: { financialPlans: mapFinancialPlans(financialMonths, financialRows, financialPayments) }, sliceMeta: { month: bounds.month } };
    }
    case 'expenses': {
      const [expenseCategories, expenses] = await Promise.all([
        selectTable(prisma, 'expense_categories', 'created_at asc'),
        prisma.$queryRaw`select * from public.expenses where expense_date >= ${bounds.start}::date and expense_date <= ${bounds.end}::date order by expense_date desc`,
      ]);
      return {
        updatedAt: nowIso(),
        state: {
          expenseCategories: expenseCategories.map((category) => ({ id: category.id, name: category.name, createdAt: iso(category.created_at) })),
          expenses: expenses.map((expense) => ({ id: expense.id, date: dateOnly(expense.expense_date), amount: Number(expense.amount) || 0, account: expense.account, category: expense.category, studio: expense.studio, comment: expense.comment, createdAt: iso(expense.created_at) })),
        },
        sliceMeta: { month: bounds.month },
      };
    }
    case 'ratings': {
      const [trainerEvaluations, callReviews] = await Promise.all([
        prisma.$queryRaw`select * from public.trainer_evaluation_sheets where evaluated_at >= ${bounds.start}::date and evaluated_at <= ${bounds.end}::date order by evaluated_at desc`,
        prisma.$queryRaw`select * from public.call_reviews where reviewed_at >= ${bounds.start}::date and reviewed_at <= ${bounds.end}::date order by reviewed_at desc`,
      ]);
      return {
        updatedAt: nowIso(),
        state: {
          trainerEvaluations: trainerEvaluations.map((evaluation) => ({ id: evaluation.id, trainerName: evaluation.trainer_name, studio: evaluation.studio, direction: evaluation.direction, score: Number(evaluation.score) || 0, evaluatedAt: dateOnly(evaluation.evaluated_at), sheetUrl: evaluation.sheet_url, createdById: evaluation.created_by_id, createdAt: iso(evaluation.created_at) })),
          callReviews: callReviews.map((review) => ({ id: review.id, source: review.source || 'levita-calls', externalId: review.external_id, adminName: review.admin_name, studio: review.studio, score: Number(review.score) || 0, reviewedAt: dateOnly(review.reviewed_at), amoCrmDealUrl: review.amo_crm_deal_url, callUrl: review.call_url, originalFilename: review.original_filename, comment: review.comment, createdAt: iso(review.created_at), updatedAt: iso(review.updated_at) })),
        },
        sliceMeta: { month: bounds.month },
      };
    }
    case 'team': {
      const users = await selectTable(prisma, 'users', 'created_at asc');
      return { updatedAt: nowIso(), state: { users: users.map(mapUser) } };
    }
    case 'audit': {
      const auditLog = await selectTable(prisma, 'audit_log', 'created_at desc');
      return { updatedAt: nowIso(), state: { auditLog: auditLog.map((entry) => ({ id: entry.id, action: entry.action, entityType: entry.entity_type, entityId: entry.entity_id, entityLabel: entry.entity_label, description: entry.description, actorId: entry.actor_id, actorName: entry.actor_name, actorRole: entry.actor_role, createdAt: iso(entry.created_at) })) } };
    }
    case 'refunds': {
      const refunds = await selectTable(prisma, 'refunds', 'requested_at desc');
      return { updatedAt: nowIso(), state: { refunds: refunds.map((refund) => ({ id: refund.id, clientName: refund.client_name, requestedAt: iso(refund.requested_at), amount: Number(refund.amount) || 0, reason: refund.reason, status: refund.status, comment: refund.comment, createdAt: iso(refund.created_at) })) } };
    }
    default: {
      const error = new Error(`Unknown state slice: ${slice}`);
      error.statusCode = 400;
      throw error;
    }
  }
}

async function audit(prisma, action, entityType, entityId, entityLabel, actor = null, description = null) {
  await prisma.$executeRaw`
    insert into public.audit_log (id, action, entity_type, entity_id, entity_label, description, actor_id, actor_name, actor_role, created_at)
    values (${newId('audit')}, ${action}, ${entityType}, ${entityId}, ${entityLabel}, ${description}, ${actor?.id || null}, ${actor?.name || 'Система'}, ${actor?.role || null}::public.levtia_role, now())
  `;
}

async function ensureChecklistForUser(prisma, user) {
  if (!['ADMIN', 'SENIOR_ADMIN', 'TRAINER', 'SENIOR_TRAINER'].includes(user.role)) return;
  const today = dateOnly();
  const existing = await prisma.$queryRaw`select id from public.daily_checklists where assigned_to = ${user.id} and checklist_date = ${today}::date limit 1`;
  if (existing.length) return;
  const checklistId = newId('checklist');
  await prisma.$executeRaw`
    insert into public.daily_checklists (id, title, role, assigned_to, checklist_date, created_at, updated_at)
    values (${checklistId}, ${user.role === 'TRAINER' || user.role === 'SENIOR_TRAINER' ? 'Чек-лист тренера' : 'Чек-лист администратора на смену'}, ${user.role}::public.levtia_role, ${user.id}, ${today}::date, now(), now())
  `;
  const items = user.role === 'TRAINER' || user.role === 'SENIOR_TRAINER' ? ['Проверить готовность зала', 'Проверить оборудование', 'Заполнить заметки по тренировке'] : ADMIN_CHECKLIST_ITEMS;
  for (const [index, label] of items.entries()) {
    await prisma.$executeRaw`
      insert into public.checklist_items (id, checklist_id, label, completed, position)
      values (${newId('checklist-item')}, ${checklistId}, ${label}, false, ${index})
    `;
  }
  if (user.role === 'ADMIN' || user.role === 'SENIOR_ADMIN') {
    for (const slot of ['14:00', '18:00']) {
      await prisma.$executeRaw`
        insert into public.checklist_reports (id, checklist_id, slot, studio, admin_name, sent_to_telegram, sent_to_max)
        values (${`${checklistId}:${slot}`}, ${checklistId}, ${slot}::public.checklist_report_slot, 'STAVROPOLSKAYA', ${user.name}, false, false)
        on conflict (checklist_id, slot) do nothing
      `;
    }
  }
}

export async function applyPrismaMutation(prisma, action, payload = {}, actor = null) {
  const now = nowIso();
  switch (action) {
    case 'employee.create': {
      const id = payload.id || newId('user');
      const passwordHash = payload.password ? hashPassword(payload.password) : null;
      await prisma.$executeRaw`
        insert into public.users (id, name, email, password_hash, role, status, join_date, created_at, updated_at)
        values (${id}, ${payload.name}, ${normalizeEmail(payload.email)}, ${passwordHash}, ${payload.role}::public.levtia_role, ${payload.status || 'active'}::public.employee_status, ${payload.joinDate || ''}, now(), now())
      `;
      await ensureChecklistForUser(prisma, { id, name: payload.name, role: payload.role });
      await audit(prisma, 'employee.create', 'user', id, payload.name, actor, 'Создан сотрудник.');
      return;
    }
    case 'employee.update': {
      const passwordHash = payload.input?.password ? hashPassword(payload.input.password) : null;
      await prisma.$executeRaw`
        update public.users
        set name = coalesce(${payload.input?.name || null}, name),
            email = coalesce(${payload.input?.email ? normalizeEmail(payload.input.email) : null}, email),
            password_hash = coalesce(${passwordHash}, password_hash),
            role = coalesce(${payload.input?.role || null}::public.levtia_role, role),
            status = coalesce(${payload.input?.status || null}::public.employee_status, status),
            updated_at = now()
        where id = ${payload.id}
      `;
      const rows = await prisma.$queryRaw`select id, name, role from public.users where id = ${payload.id}`;
      if (rows[0]) await ensureChecklistForUser(prisma, rows[0]);
      await audit(prisma, 'employee.update', 'user', payload.id, payload.input?.name || payload.id, actor, 'Обновлен сотрудник.');
      return;
    }
    case 'employee.delete':
      await audit(prisma, 'employee.delete', 'user', payload.id, payload.id, actor, 'Удален сотрудник.');
      await prisma.$executeRaw`delete from public.users where id = ${payload.id}`;
      return;
    case 'task.create': {
      const id = payload.id || newId('task');
      let calendarEventId = null;
      await prisma.$transaction(async (tx) => {
        if (payload.addToCalendar && payload.deadline) {
          calendarEventId = payload.calendarEventId || newId('calendar-event');
        }
        await tx.$executeRaw`
          insert into public.tasks (id, title, description, period, role, priority, status, deadline, add_to_calendar, calendar_event_id, created_at, updated_at)
          values (${id}, ${payload.title}, ${payload.description || ''}, ${payload.period || ''}, ${payload.role || 'ASSISTANT'}::public.levtia_role, ${payload.priority || 'medium'}::public.task_priority, ${payload.status || 'pending'}::public.task_status, ${payload.deadline ? dateOnly(payload.deadline) : null}::date, ${Boolean(payload.addToCalendar)}, ${calendarEventId}, now(), now())
        `;
        if (payload.addToCalendar && payload.deadline) {
          await tx.$executeRaw`
            insert into public.calendar_events (id, title, event_date, description, source_task_id, google_sync_status, source, created_at, updated_at)
            values (${calendarEventId}, ${payload.title}, ${dateOnly(payload.deadline)}::date, ${payload.description || null}, ${id}, 'pending', 'local', now(), now())
          `;
        }
      });
      return;
    }
    case 'task.update': {
      const input = payload.input || {};
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          update public.tasks
          set title = coalesce(${input.title ?? null}, title),
              description = coalesce(${input.description ?? null}, description),
              period = coalesce(${input.period ?? null}, period),
              priority = coalesce(${input.priority ?? null}::public.task_priority, priority),
              status = coalesce(${input.status ?? null}::public.task_status, status),
              deadline = coalesce(${input.deadline ? dateOnly(input.deadline) : null}::date, deadline),
              add_to_calendar = coalesce(${input.addToCalendar ?? null}, add_to_calendar),
              updated_at = now()
          where id = ${payload.id}
        `;
        const rows = await tx.$queryRaw`select id, title, description, deadline, add_to_calendar, calendar_event_id from public.tasks where id = ${payload.id} limit 1`;
        const task = rows[0];
        if (!task) return;
        if (task.add_to_calendar && task.deadline) {
          const eventId = task.calendar_event_id || newId('calendar-event');
          await tx.$executeRaw`
            insert into public.calendar_events (id, title, event_date, description, source_task_id, google_sync_status, source, created_at, updated_at)
            values (${eventId}, ${task.title}, ${dateOnly(task.deadline)}::date, ${task.description || null}, ${task.id}, 'pending', 'local', now(), now())
            on conflict (id) do update set title = excluded.title, event_date = excluded.event_date, description = excluded.description, source_task_id = excluded.source_task_id, google_sync_status = 'pending', updated_at = now()
          `;
          await tx.$executeRaw`update public.tasks set calendar_event_id = ${eventId} where id = ${task.id}`;
        } else if (task.calendar_event_id) {
          await tx.$executeRaw`delete from public.calendar_events where id = ${task.calendar_event_id}`;
          await tx.$executeRaw`update public.tasks set calendar_event_id = null where id = ${task.id}`;
        }
      });
      return;
    }
    case 'task.toggle': {
      await prisma.$executeRaw`
        update public.tasks
        set status = case when status = 'completed' then 'pending'::public.task_status else 'completed'::public.task_status end,
            updated_at = now()
        where id = ${payload.id}
      `;
      return;
    }
    case 'template.create':
      await prisma.$executeRaw`insert into public.response_templates (id, title, body, role, business_model, purpose, created_by_id, created_at, updated_at) values (${payload.id || newId('template')}, ${payload.title}, ${payload.body}, ${payload.role}::public.levtia_role, ${normalizeBusinessModel(payload.businessModel)}, ${payload.purpose || null}, ${payload.createdById || actor?.id || null}, now(), now())`;
      return;
    case 'template.update':
      await prisma.$executeRaw`update public.response_templates set title = coalesce(${payload.input?.title ?? null}, title), body = coalesce(${payload.input?.body ?? null}, body), role = coalesce(${payload.input?.role ?? null}::public.levtia_role, role), business_model = coalesce(${payload.input?.businessModel ? normalizeBusinessModel(payload.input.businessModel) : null}, business_model), purpose = coalesce(${payload.input?.purpose ?? null}, purpose), updated_at = now() where id = ${payload.id}`;
      return;
    case 'template.delete':
      await prisma.$executeRaw`delete from public.content_favorites where entity_type = 'template' and entity_id = ${payload.id}`;
      await prisma.$executeRaw`delete from public.response_templates where id = ${payload.id}`;
      return;
    case 'link.create':
      await prisma.$executeRaw`insert into public.helpful_links (id, title, url, description, role, category, created_at, updated_at) values (${payload.id || newId('link')}, ${payload.title}, ${payload.url}, ${payload.description || null}, ${payload.role}::public.levtia_role, ${payload.category || 'HELPFUL'}::public.link_category, now(), now())`;
      return;
    case 'link.update':
      await prisma.$executeRaw`update public.helpful_links set title = coalesce(${payload.input?.title ?? null}, title), url = coalesce(${payload.input?.url ?? null}, url), description = coalesce(${payload.input?.description ?? null}, description), role = coalesce(${payload.input?.role ?? null}::public.levtia_role, role), category = coalesce(${payload.input?.category ?? null}::public.link_category, category), updated_at = now() where id = ${payload.id}`;
      return;
    case 'link.delete':
      await prisma.$executeRaw`delete from public.content_favorites where entity_type = 'link' and entity_id = ${payload.id}`;
      await prisma.$executeRaw`delete from public.helpful_links where id = ${payload.id}`;
      return;
    case 'documentTemplate.create':
      await prisma.$executeRaw`insert into public.document_templates (id, title, url, created_by_id, created_at, updated_at) values (${payload.id || newId('document-template')}, ${payload.title}, ${payload.url}, ${actor?.id || payload.createdById || null}, now(), now())`;
      return;
    case 'documentTemplate.update':
      await prisma.$executeRaw`update public.document_templates set title = coalesce(${payload.input?.title ?? null}, title), url = coalesce(${payload.input?.url ?? null}, url), updated_at = now() where id = ${payload.id}`;
      return;
    case 'documentTemplate.delete':
      await prisma.$executeRaw`delete from public.content_favorites where entity_type = 'documentTemplate' and entity_id = ${payload.id}`;
      await prisma.$executeRaw`delete from public.document_templates where id = ${payload.id}`;
      return;
    case 'usefulContact.create':
      await prisma.$executeRaw`insert into public.useful_contacts (id, name, phone, company, specialty, created_at, updated_at) values (${payload.id || newId('contact')}, ${payload.name}, ${payload.phone}, ${payload.company}, ${payload.specialty}, now(), now())`;
      return;
    case 'usefulContact.update':
      await prisma.$executeRaw`update public.useful_contacts set name = coalesce(${payload.input?.name ?? null}, name), phone = coalesce(${payload.input?.phone ?? null}, phone), company = coalesce(${payload.input?.company ?? null}, company), specialty = coalesce(${payload.input?.specialty ?? null}, specialty), updated_at = now() where id = ${payload.id}`;
      return;
    case 'usefulContact.delete':
      await prisma.$executeRaw`delete from public.content_favorites where entity_type = 'usefulContact' and entity_id = ${payload.id}`;
      await prisma.$executeRaw`delete from public.useful_contacts where id = ${payload.id}`;
      return;
    case 'knowledge.create':
      await prisma.$executeRaw`insert into public.knowledge_entries (id, title, content, role, category, business_model, hashtags, is_actual, searchable, created_at, updated_at) values (${payload.id || newId('knowledge')}, ${payload.title}, ${payload.content}, ${payload.role}::public.levtia_role, ${payload.category}::public.knowledge_category, ${normalizeBusinessModel(payload.businessModel)}, ${payload.hashtags || null}, ${payload.isActual !== false}, true, now(), now())`;
      return;
    case 'knowledge.update':
      await prisma.$executeRaw`update public.knowledge_entries set title = coalesce(${payload.input?.title ?? null}, title), content = coalesce(${payload.input?.content ?? null}, content), role = coalesce(${payload.input?.role ?? null}::public.levtia_role, role), category = coalesce(${payload.input?.category ?? null}::public.knowledge_category, category), business_model = coalesce(${payload.input?.businessModel ? normalizeBusinessModel(payload.input.businessModel) : null}, business_model), hashtags = coalesce(${payload.input?.hashtags ?? null}, hashtags), is_actual = coalesce(${payload.input?.isActual ?? null}, is_actual), updated_at = now() where id = ${payload.id}`;
      return;
    case 'knowledge.delete':
      await prisma.$executeRaw`delete from public.content_favorites where entity_type = 'knowledge' and entity_id = ${payload.id}`;
      await prisma.$executeRaw`delete from public.content_read_receipts where entity_type = 'knowledge' and entity_id = ${payload.id}`;
      await prisma.$executeRaw`delete from public.knowledge_entries where id = ${payload.id}`;
      return;
    case 'checklist.item.toggle': {
      const rows = await prisma.$queryRaw`select completed from public.checklist_items where id = ${payload.itemId} and checklist_id = ${payload.checklistId}`;
      const completed = !Boolean(rows[0]?.completed);
      await prisma.$executeRaw`update public.checklist_items set completed = ${completed}, completed_at = ${completed ? now : null}::timestamptz, completed_by = ${completed ? payload.userId || actor?.id || null : null} where id = ${payload.itemId} and checklist_id = ${payload.checklistId}`;
      return;
    }
    case 'checklist.items.confirm': {
      const completedAt = payload.completedAt || now;
      for (const item of payload.items || []) {
        await prisma.$executeRaw`
          update public.checklist_items
          set completed = ${Boolean(item.completed)},
              completed_at = ${item.completed ? completedAt : null}::timestamptz,
              completed_by = ${item.completed ? payload.userId || actor?.id || null : null}
          where id = ${item.itemId} and checklist_id = ${payload.checklistId}
        `;
      }
      return;
    }
    case 'checklist.item.add': {
      const [{ count }] = await prisma.$queryRaw`select count(*)::int as count from public.checklist_items where checklist_id = ${payload.checklistId}`;
      await prisma.$executeRaw`insert into public.checklist_items (id, checklist_id, label, completed, position) values (${payload.id || newId('checklist-item')}, ${payload.checklistId}, ${payload.label}, false, ${count || 0})`;
      return;
    }
    case 'checklist.item.delete':
      await prisma.$executeRaw`delete from public.checklist_items where checklist_id = ${payload.checklistId} and id = ${payload.itemId}`;
      return;
    case 'checklist.roleItem.add': {
      for (const role of payload.roles || []) {
        const lists = await prisma.$queryRaw`select id from public.daily_checklists where role = ${role}::public.levtia_role`;
        for (const list of lists) {
          const [{ count }] = await prisma.$queryRaw`select count(*)::int as count from public.checklist_items where checklist_id = ${list.id}`;
          await prisma.$executeRaw`insert into public.checklist_items (id, checklist_id, label, completed, position) values (${newId('checklist-item')}, ${list.id}, ${payload.label}, false, ${count || 0})`;
        }
      }
      return;
    }
    case 'checklist.roleItem.update':
      for (const role of payload.roles || []) {
        await prisma.$executeRaw`update public.checklist_items set label = ${payload.label} where id in (select ci.id from public.checklist_items ci join public.daily_checklists dc on dc.id = ci.checklist_id where dc.role = ${role}::public.levtia_role and ci.position = ${payload.itemIndex})`;
      }
      return;
    case 'checklist.roleItem.delete':
      for (const role of payload.roles || []) {
        await prisma.$executeRaw`delete from public.checklist_items where id in (select ci.id from public.checklist_items ci join public.daily_checklists dc on dc.id = ci.checklist_id where dc.role = ${role}::public.levtia_role and ci.position = ${payload.itemIndex})`;
      }
      return;
    case 'checklist.report.update': {
      const input = payload.input || {};
      await prisma.$executeRaw`
        insert into public.checklist_reports (id, checklist_id, slot, studio, admin_name, calls, reached, bookings, cash, came, bought, submitted_at, sent_to_telegram, telegram_sent_at, sent_to_max, max_sent_at, max_send_error, max_message_id)
        values (${`${payload.checklistId}:${payload.slot}`}, ${payload.checklistId}, ${payload.slot}::public.checklist_report_slot, ${input.studio || 'STAVROPOLSKAYA'}, ${input.adminName || ''}, ${input.calls || ''}, ${input.reached || ''}, ${input.bookings || ''}, ${input.cash || ''}, ${input.came || ''}, ${input.bought || ''}, ${input.submittedAt || null}::timestamptz, ${Boolean(input.sentToTelegram)}, ${input.telegramSentAt || null}::timestamptz, ${Boolean(input.sentToMax)}, ${input.maxSentAt || null}::timestamptz, ${input.maxSendError || null}, ${input.maxMessageId || null})
        on conflict (checklist_id, slot) do update set studio = excluded.studio, admin_name = excluded.admin_name, calls = excluded.calls, reached = excluded.reached, bookings = excluded.bookings, cash = excluded.cash, came = excluded.came, bought = excluded.bought, submitted_at = excluded.submitted_at, sent_to_telegram = excluded.sent_to_telegram, telegram_sent_at = excluded.telegram_sent_at, sent_to_max = excluded.sent_to_max, max_sent_at = excluded.max_sent_at, max_send_error = excluded.max_send_error, max_message_id = excluded.max_message_id
      `;
      return;
    }
    case 'refund.create':
      await prisma.$executeRaw`insert into public.refunds (id, client_name, requested_at, amount, reason, status, comment, created_at, updated_at) values (${payload.id || newId('refund')}, ${payload.clientName}, ${payload.requestedAt || now}::timestamptz, ${toNumber(payload.amount)}, ${payload.reason}, ${payload.status || 'NEW'}::public.refund_status, ${payload.comment || null}, now(), now())`;
      return;
    case 'refund.update':
      await prisma.$executeRaw`update public.refunds set client_name = coalesce(${payload.input?.clientName ?? null}, client_name), amount = coalesce(${payload.input?.amount ?? null}, amount), reason = coalesce(${payload.input?.reason ?? null}, reason), status = coalesce(${payload.input?.status ?? null}::public.refund_status, status), comment = coalesce(${payload.input?.comment ?? null}, comment), updated_at = now() where id = ${payload.id}`;
      return;
    case 'financial.row.add': {
      const baseId = payload.id || newId('financial-row');
      for (let index = 0; index <= FINANCIAL_PLAN_FORWARD_MONTHS; index += 1) {
        const month = addMonths(payload.month, index);
        const id = storageFinancialRowId(month, baseId);
        await prisma.$executeRaw`insert into public.financial_plan_months (month, updated_at) values (${month}, now()) on conflict (month) do update set updated_at = excluded.updated_at`;
        const [{ count }] = await prisma.$queryRaw`select count(*)::int as count from public.financial_plan_rows where month = ${month}`;
        await prisma.$executeRaw`insert into public.financial_plan_rows (id, month, title, position, created_at, updated_at) values (${id}, ${month}, ${payload.title}, ${count || 0}, now(), now()) on conflict (id) do nothing`;
      }
      return;
    }
    case 'financial.row.update': {
      const base = financialBaseId(payload.rowId);
      await prisma.$executeRaw`update public.financial_plan_rows set title = ${payload.title}, updated_at = now() where month >= ${payload.month} and (id = ${payload.rowId} or id like ${`%:${base}`})`;
      return;
    }
    case 'financial.row.delete': {
      const base = financialBaseId(payload.rowId);
      await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw`select id from public.financial_plan_rows where month >= ${payload.month} and (id = ${payload.rowId} or id like ${`%:${base}`})`;
        for (const row of rows) {
          await tx.$executeRaw`delete from public.financial_plan_payments where row_id = ${row.id}`;
        }
        await tx.$executeRaw`delete from public.financial_plan_rows where month >= ${payload.month} and (id = ${payload.rowId} or id like ${`%:${base}`})`;
      });
      return;
    }
    case 'financial.cell.update': {
      const base = financialBaseId(payload.rowId);
      const rows = await prisma.$queryRaw`select id, month, title, position from public.financial_plan_rows where month >= ${payload.month} and (id = ${payload.rowId} or id like ${`%:${base}`}) order by month asc`;
      for (const row of rows) {
        const targetDate = row.month === payload.month ? dateOnly(payload.date) : clampDate(row.month, payload.date);
        if (String(payload.value || '').trim()) {
          await prisma.$executeRaw`
            insert into public.financial_plan_payments (row_id, payment_date, value, updated_at)
            select ${row.id}, ${targetDate}::date, ${String(payload.value)}, now()
            where exists (select 1 from public.financial_plan_rows where id = ${row.id})
            on conflict (row_id, payment_date) do update set value = excluded.value, updated_at = now()
          `;
        } else {
          await prisma.$executeRaw`delete from public.financial_plan_payments where row_id = ${row.id} and payment_date = ${targetDate}::date`;
        }
      }
      return;
    }
    case 'calendar.create':
      await prisma.$executeRaw`insert into public.calendar_events (id, title, event_date, start_time, end_time, description, source_task_id, google_event_id, google_html_link, google_sync_status, google_sync_error, source, recurrence, created_at, updated_at) values (${payload.id || newId('calendar-event')}, ${payload.title}, ${dateOnly(payload.date)}::date, ${timeOnly(payload.startTime)}::time, ${timeOnly(payload.endTime)}::time, ${payload.description || null}, ${payload.sourceTaskId || null}, ${payload.googleEventId || null}, ${payload.googleHtmlLink || null}, ${payload.googleSyncStatus || 'pending'}, ${payload.googleSyncError || null}, ${payload.source || 'local'}, ${jsonValue(payload.recurrence)}, now(), now())`;
      return;
    case 'calendar.import':
      for (const event of payload.events || []) {
        const id = event.id || newId('calendar-event');
        await prisma.$executeRaw`
          insert into public.calendar_events (id, title, event_date, start_time, end_time, description, source_task_id, google_event_id, google_recurring_event_id, google_html_link, google_sync_status, google_sync_error, source, source_name, recurrence, created_at, updated_at)
          values (${id}, ${event.title}, ${dateOnly(event.date)}::date, ${timeOnly(event.startTime)}::time, ${timeOnly(event.endTime)}::time, ${event.description || null}, null, ${event.googleEventId}, ${event.googleRecurringEventId || null}, ${event.googleHtmlLink || null}, 'synced', null, ${event.source || 'google-calendar'}, ${event.sourceName || null}, null, ${event.updated || nowIso()}::timestamptz, now())
          on conflict (id) do update set title = excluded.title, event_date = excluded.event_date, start_time = excluded.start_time, end_time = excluded.end_time, description = excluded.description, google_event_id = excluded.google_event_id, google_recurring_event_id = excluded.google_recurring_event_id, google_html_link = excluded.google_html_link, google_sync_status = excluded.google_sync_status, google_sync_error = null, source = excluded.source, source_name = excluded.source_name, updated_at = now()
        `;
      }
      return;
    case 'calendar.update':
      await prisma.$executeRaw`update public.calendar_events set title = coalesce(${payload.input?.title ?? null}, title), event_date = coalesce(${payload.input?.date ? dateOnly(payload.input.date) : null}::date, event_date), start_time = ${payload.input?.startTime === undefined ? Prisma.sql`start_time` : Prisma.sql`${timeOnly(payload.input.startTime)}::time`}, end_time = ${payload.input?.endTime === undefined ? Prisma.sql`end_time` : Prisma.sql`${timeOnly(payload.input.endTime)}::time`}, description = ${payload.input?.description === undefined ? Prisma.sql`description` : Prisma.sql`${payload.input.description || null}`}, google_event_id = coalesce(${payload.input?.googleEventId ?? null}, google_event_id), google_html_link = coalesce(${payload.input?.googleHtmlLink ?? null}, google_html_link), google_sync_status = coalesce(${payload.input?.googleSyncStatus ?? null}, google_sync_status), google_sync_error = ${payload.input?.googleSyncError ?? null}, recurrence = ${payload.input?.recurrence === undefined ? Prisma.sql`recurrence` : Prisma.sql`${jsonValue(payload.input.recurrence)}`}, updated_at = now() where id = ${payload.id}`;
      return;
    case 'calendar.delete':
      await prisma.$executeRaw`update public.tasks set calendar_event_id = null, add_to_calendar = false where calendar_event_id = ${payload.id}`;
      await prisma.$executeRaw`delete from public.calendar_events where id = ${payload.id}`;
      return;
    case 'expenseCategory.create':
      await prisma.$executeRaw`insert into public.expense_categories (id, name, created_at) values (${payload.id || newId('expense-category')}, ${payload.name}, now()) on conflict (name) do nothing`;
      return;
    case 'expenseCategory.delete':
      await prisma.$executeRaw`delete from public.expense_categories where id = ${payload.id}`;
      return;
    case 'expense.create':
      await prisma.$executeRaw`insert into public.expenses (id, expense_date, amount, account, category, studio, comment, created_at, updated_at) values (${payload.id || newId('expense')}, ${dateOnly(payload.date)}::date, ${toNumber(payload.amount)}, ${payload.account}::public.expense_account, ${payload.category}, ${payload.studio}::public.expense_studio, ${payload.comment || null}, now(), now())`;
      return;
    case 'expense.update':
      await prisma.$executeRaw`update public.expenses set expense_date = coalesce(${payload.input?.date ? dateOnly(payload.input.date) : null}::date, expense_date), amount = coalesce(${payload.input?.amount ?? null}, amount), account = coalesce(${payload.input?.account ?? null}::public.expense_account, account), category = coalesce(${payload.input?.category ?? null}, category), studio = coalesce(${payload.input?.studio ?? null}::public.expense_studio, studio), comment = coalesce(${payload.input?.comment ?? null}, comment), updated_at = now() where id = ${payload.id}`;
      return;
    case 'expense.delete':
      await prisma.$executeRaw`delete from public.expenses where id = ${payload.id}`;
      return;
    case 'trainerEvaluation.create':
      await prisma.$executeRaw`insert into public.trainer_evaluation_sheets (id, trainer_name, studio, direction, score, evaluated_at, sheet_url, created_by_id, created_at, updated_at) values (${payload.id || newId('trainer-evaluation')}, ${payload.trainerName}, ${payload.studio}::public.expense_studio, ${payload.direction}, ${toNumber(payload.score)}, ${dateOnly(payload.evaluatedAt)}::date, ${payload.sheetUrl}, ${actor?.id || payload.createdById || null}, now(), now())`;
      return;
    case 'trainerEvaluation.update':
      await prisma.$executeRaw`update public.trainer_evaluation_sheets set trainer_name = coalesce(${payload.input?.trainerName ?? null}, trainer_name), studio = coalesce(${payload.input?.studio ?? null}::public.expense_studio, studio), direction = coalesce(${payload.input?.direction ?? null}, direction), score = coalesce(${payload.input?.score ?? null}, score), evaluated_at = coalesce(${payload.input?.evaluatedAt ? dateOnly(payload.input.evaluatedAt) : null}::date, evaluated_at), sheet_url = coalesce(${payload.input?.sheetUrl ?? null}, sheet_url), updated_at = now() where id = ${payload.id}`;
      return;
    case 'trainerEvaluation.delete':
      await prisma.$executeRaw`delete from public.trainer_evaluation_sheets where id = ${payload.id}`;
      return;
    case 'settings.update':
      await prisma.$executeRaw`insert into public.app_settings (id, payload, updated_at) values ('main', ${jsonValue(payload.input || {})}, now()) on conflict (id) do update set payload = public.app_settings.payload || excluded.payload, updated_at = now()`;
      return;
    case 'favorite.toggle': {
      const existing = await prisma.$queryRaw`select id from public.content_favorites where user_id = ${payload.userId || actor?.id} and entity_type = ${payload.entityType} and entity_id = ${payload.entityId}`;
      if (existing.length) await prisma.$executeRaw`delete from public.content_favorites where id = ${existing[0].id}`;
      else await prisma.$executeRaw`insert into public.content_favorites (id, user_id, entity_type, entity_id, created_at) values (${newId('favorite')}, ${payload.userId || actor?.id}, ${payload.entityType}, ${payload.entityId}, now())`;
      return;
    }
    case 'knowledge.read':
      await prisma.$executeRaw`insert into public.content_read_receipts (id, user_id, entity_type, entity_id, read_at) values (${newId('read-receipt')}, ${payload.userId || actor?.id}, 'knowledge', ${payload.entityId}, now()) on conflict (user_id, entity_type, entity_id) do update set read_at = now()`;
      return;
    case 'callChecklist.add': {
      const [{ count }] = await prisma.$queryRaw`select count(*)::int as count from public.call_checklist_items`;
      await prisma.$executeRaw`insert into public.call_checklist_items (id, label, position, updated_at) values (${newId('call-checklist')}, ${payload.label}, ${count || 0}, now())`;
      return;
    }
    case 'callChecklist.update':
      await prisma.$executeRaw`update public.call_checklist_items set label = ${payload.label}, updated_at = now() where position = ${payload.index}`;
      return;
    case 'callChecklist.delete':
      await prisma.$executeRaw`delete from public.call_checklist_items where position = ${payload.index}`;
      return;
    case 'shift.start': {
      const users = await prisma.$queryRaw`select id, name, role from public.users where id = ${payload.userId} limit 1`;
      const user = users[0] || { id: payload.userId, name: payload.adminName, role: 'ADMIN' };
      await ensureChecklistForUser(prisma, user);
      await prisma.$executeRaw`insert into public.admin_shifts (id, user_id, admin_name, studio, shift_date, started_at, reminders_scheduled_at, reminder_schedule_error, created_at, updated_at) values (${payload.id || newId('shift')}, ${payload.userId}, ${payload.adminName}, ${payload.studio}::text, ${dateOnly(payload.date)}::date, ${payload.startedAt || now}::timestamptz, ${payload.remindersScheduledAt || null}::timestamptz, ${payload.reminderScheduleError || null}, now(), now()) on conflict (user_id, shift_date) do update set admin_name = excluded.admin_name, studio = excluded.studio, started_at = excluded.started_at, reminders_scheduled_at = excluded.reminders_scheduled_at, reminder_schedule_error = excluded.reminder_schedule_error, updated_at = now()`;
      return;
    }
    case 'callReview.upsert':
      await prisma.$executeRaw`insert into public.call_reviews (id, source, external_id, admin_name, studio, score, reviewed_at, amo_crm_deal_url, call_url, original_filename, comment, created_at, updated_at) values (${payload.id || newId('call-review')}, 'levita-calls', ${payload.externalId}, ${payload.adminName}, ${payload.studio}::public.expense_studio, ${toNumber(payload.score)}, ${dateOnly(payload.reviewedAt)}::date, ${payload.amoCrmDealUrl || null}, ${payload.callUrl || null}, ${payload.originalFilename || null}, ${payload.comment || null}, now(), now()) on conflict (source, external_id) do update set admin_name = excluded.admin_name, studio = excluded.studio, score = excluded.score, reviewed_at = excluded.reviewed_at, amo_crm_deal_url = excluded.amo_crm_deal_url, call_url = excluded.call_url, original_filename = excluded.original_filename, comment = excluded.comment, updated_at = now()`;
      return;
    case 'callReview.delete':
      await prisma.$executeRaw`delete from public.call_reviews where source = 'levita-calls' and external_id = ${payload.externalId}`;
      return;
    default: {
      const error = new Error(`Unknown Prisma mutation: ${action}`);
      error.statusCode = 400;
      throw error;
    }
  }
}
