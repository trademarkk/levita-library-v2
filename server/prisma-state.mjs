import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

const FINANCIAL_PLAN_FORWARD_MONTHS = 36;
const CHECKLIST_HISTORY_DAYS = Number(process.env.LEVTIA_CHECKLIST_HISTORY_DAYS || 90);
const AUDIT_LOG_LIMIT = Number(process.env.LEVTIA_AUDIT_LOG_LIMIT || 500);
const REFUND_LIMIT = Number(process.env.LEVTIA_REFUND_LIMIT || 500);
const SLICE_READ_CONCURRENCY = Math.max(1, Number(process.env.LEVTIA_SLICE_READ_CONCURRENCY || 2));
let contentMediaSchemaPromise = null;
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

const ASSISTANT_CHECKLIST_ITEMS = [
  'Проверить входящие сообщения',
  'Обновить статусы задач',
  'Подготовить рабочие материалы',
];
const TRAINER_CHECKLIST_ITEMS = [
  'Проверить готовность зала',
  'Проверить оборудование',
  'Заполнить заметки по тренировке',
];

const SERVER_ROLE_LABELS = {
  OWNER: 'Руководитель',
  ASSISTANT: 'Ассистент',
  SENIOR_ADMIN: 'Старший администратор',
  ADMIN: 'Администратор',
  SENIOR_TRAINER: 'Старший тренер',
  TRAINER: 'Тренер',
};

function serverRoleLabel(role) {
  return SERVER_ROLE_LABELS[role] || role || '';
}

function prismaPoolUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', process.env.PRISMA_CONNECTION_LIMIT || '3');
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
    if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function resolvePrismaDatabaseUrl() {
  const mode = String(process.env.LEVTIA_DATABASE_URL_MODE || 'auto').toLowerCase();
  if ((mode === 'auto' || mode === 'direct' || mode === 'session') && process.env.DIRECT_URL) {
    return process.env.DIRECT_URL;
  }
  return process.env.DATABASE_URL;
}

export function createPrisma() {
  const globalKey = '__levtiaPrismaClient';
  if (globalThis[globalKey]) return globalThis[globalKey];
  const databaseUrl = resolvePrismaDatabaseUrl();
  globalThis[globalKey] = new PrismaClient({
    datasources: databaseUrl ? { db: { url: prismaPoolUrl(databaseUrl) } } : undefined,
    log: process.env.PRISMA_QUERY_LOG === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
  return globalThis[globalKey];
}

export async function ensureContentMediaSchema(prisma) {
  if (!contentMediaSchemaPromise) {
    contentMediaSchemaPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        alter table public.knowledge_entries
          add column if not exists video_url text
      `);
      await prisma.$executeRawUnsafe(`
        create table if not exists public.content_attachments (
          id text primary key,
          knowledge_entry_id text not null references public.knowledge_entries(id) on delete cascade,
          storage_path text not null unique,
          file_name text not null,
          mime_type text not null,
          size_bytes integer not null check (size_bytes > 0),
          position integer not null default 0,
          created_at timestamptz not null default now()
        )
      `);
      await prisma.$executeRawUnsafe(`
        create index if not exists content_attachments_entry_position_idx
          on public.content_attachments (knowledge_entry_id, position, created_at)
      `);
      await prisma.$executeRawUnsafe(`
        alter table public.content_attachments enable row level security
      `);
    })().catch((error) => {
      contentMediaSchemaPromise = null;
      throw error;
    });
  }
  await contentMediaSchemaPromise;
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

function nullableDateOnly(value) {
  return value ? dateOnly(value) : null;
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

function dateDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - Math.max(0, Number(days) || 0));
  return date.toISOString().slice(0, 10);
}

function financialBaseId(rowId) {
  return String(rowId || '').replace(/^\d{4}-\d{2}:/, '');
}

function financialRowFilterSql(rowId) {
  const base = financialBaseId(rowId);
  if (!base) {
    const error = new Error('financial row id is required');
    error.statusCode = 400;
    throw error;
  }
  return { base, pattern: `%:${base}` };
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

function jsonRows(value) {
  return Array.isArray(value) ? value : [];
}

async function runLimited(tasks, limit = SLICE_READ_CONCURRENCY) {
  const results = new Array(tasks.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), tasks.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await tasks[index]();
    }
  }));
  return results;
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

function mapTrainerHiringCandidate(candidate) {
  return {
    id: candidate.id,
    fullName: candidate.full_name,
    status: candidate.status || 'active',
    videoIntroApproved: candidate.video_intro_approved,
    primaryDocumentsReceived: Boolean(candidate.primary_documents_received),
    ndaSigned: Boolean(candidate.nda_signed),
    ndaLink: candidate.nda_link,
    introZoomScheduled: Boolean(candidate.intro_zoom_scheduled),
    introZoomDate: nullableDateOnly(candidate.intro_zoom_date),
    introZoomTime: timeOnly(candidate.intro_zoom_time),
    secondCertificationPreparationZoomScheduled: Boolean(candidate.second_certification_preparation_zoom_scheduled),
    secondCertificationPreparationZoomDate: nullableDateOnly(candidate.second_certification_preparation_zoom_date),
    secondCertificationPreparationZoomTime: timeOnly(candidate.second_certification_preparation_zoom_time),
    secondCertificationScheduled: Boolean(candidate.second_certification_scheduled),
    secondCertificationDate: nullableDateOnly(candidate.second_certification_date),
    secondCertificationTime: timeOnly(candidate.second_certification_time),
    secondCertificationResult: candidate.second_certification_result || 'pending',
    secondCertificationRetakeDate: nullableDateOnly(candidate.second_certification_retake_date),
    trainingsVisitedAfterSecondCertification: Boolean(candidate.trainings_visited_after_second_certification),
    mediaCollected: Boolean(candidate.media_collected),
    thirdCertificationScheduled: Boolean(candidate.third_certification_scheduled),
    thirdCertificationDate: nullableDateOnly(candidate.third_certification_date),
    thirdCertificationTime: timeOnly(candidate.third_certification_time),
    thirdCertificationResult: candidate.third_certification_result || 'pending',
    thirdCertificationPreparationZoomDate: nullableDateOnly(candidate.third_certification_preparation_zoom_date),
    thirdCertificationPreparationZoomTime: timeOnly(candidate.third_certification_preparation_zoom_time),
    workingHoursAssigned: Boolean(candidate.working_hours_assigned),
    firstShiftDate: nullableDateOnly(candidate.first_shift_date),
    createdById: candidate.created_by_id,
    createdAt: iso(candidate.created_at),
    updatedAt: iso(candidate.updated_at),
    rejectedAt: iso(candidate.rejected_at),
  };
}

function mapContentAttachment(attachment) {
  return {
    id: attachment.id,
    knowledgeEntryId: attachment.knowledge_entry_id,
    storagePath: attachment.storage_path,
    fileName: attachment.file_name,
    mimeType: attachment.mime_type,
    sizeBytes: Number(attachment.size_bytes) || 0,
    position: Number(attachment.position) || 0,
    createdAt: iso(attachment.created_at),
    url: `/api/content-attachments/${encodeURIComponent(attachment.id)}`,
  };
}

function attachmentsByKnowledgeEntry(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const current = grouped.get(row.knowledge_entry_id) || [];
    current.push(mapContentAttachment(row));
    grouped.set(row.knowledge_entry_id, current);
  }
  return grouped;
}

function mapKnowledgeEntry(entry, groupedAttachments) {
  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    role: entry.role,
    category: entry.category,
    businessModel: entry.business_model,
    hashtags: entry.hashtags,
    isActual: entry.is_actual,
    searchable: entry.searchable,
    videoUrl: entry.video_url,
    attachments: groupedAttachments.get(entry.id) || [],
    createdAt: iso(entry.created_at),
  };
}

export async function readStateFromPrisma(prisma) {
  await ensureContentMediaSchema(prisma);
  const users = await selectTable(prisma, 'users', 'created_at asc');
  const tasks = await selectTable(prisma, 'tasks', 'created_at asc');
  const templates = await selectTable(prisma, 'response_templates', 'created_at asc');
  const links = await selectTable(prisma, 'helpful_links', 'created_at asc');
  const documentTemplates = await selectTable(prisma, 'document_templates', 'created_at asc');
  const usefulContacts = await selectTable(prisma, 'useful_contacts', 'created_at asc');
  const knowledge = await selectTable(prisma, 'knowledge_entries', 'created_at asc');
  const contentAttachments = await selectTable(prisma, 'content_attachments', 'knowledge_entry_id asc, position asc, created_at asc');
  const favorites = await selectTable(prisma, 'content_favorites', 'created_at asc');
  const readReceipts = await selectTable(prisma, 'content_read_receipts', 'read_at asc');
  const checklists = await selectTable(prisma, 'daily_checklists', 'checklist_date asc');
  const checklistItems = await selectTable(prisma, 'checklist_items', 'position asc');
  const checklistReports = await selectTable(prisma, 'checklist_reports', 'slot asc');
  const refunds = await selectTable(prisma, 'refunds', 'requested_at desc');
  const financialMonths = await selectTable(prisma, 'financial_plan_months', 'month asc');
  const financialRows = await selectTable(prisma, 'financial_plan_rows', 'position asc');
  const financialPayments = await selectTable(prisma, 'financial_plan_payments', 'payment_date asc');
  const calendarEvents = await selectTable(prisma, 'calendar_events', 'event_date asc, start_time asc');
  const expenseCategories = await selectTable(prisma, 'expense_categories', 'created_at asc');
  const expenses = await selectTable(prisma, 'expenses', 'expense_date desc');
  const trainerEvaluations = await selectTable(prisma, 'trainer_evaluation_sheets', 'evaluated_at desc');
  const trainerHiringCandidates = await selectTable(prisma, 'trainer_hiring_candidates', 'updated_at desc');
  const callReviews = await selectTable(prisma, 'call_reviews', 'reviewed_at desc');
  const callChecklistItems = await selectTable(prisma, 'call_checklist_items', 'position asc');
  const adminShifts = await selectTable(prisma, 'admin_shifts', 'started_at desc');
  const auditLog = await selectTable(prisma, 'audit_log', 'created_at desc');
  const settingsRows = await selectTable(prisma, 'app_settings');

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
  const groupedAttachments = attachmentsByKnowledgeEntry(contentAttachments);
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
      knowledge: knowledge.map((entry) => mapKnowledgeEntry(entry, groupedAttachments)),
      checklists: checklists.map((checklist) => ({ id: checklist.id, title: checklist.title, role: checklist.role, assignedTo: checklist.assigned_to, date: dateOnly(checklist.checklist_date), createdAt: iso(checklist.created_at), items: itemsByChecklist.get(checklist.id) || [], reports: reportsByChecklist.get(checklist.id) || [] })),
      refunds: refunds.map((refund) => ({ id: refund.id, clientName: refund.client_name, requestedAt: iso(refund.requested_at), amount: Number(refund.amount) || 0, reason: refund.reason, status: refund.status, comment: refund.comment, createdAt: iso(refund.created_at) })),
      financialPlans: financialMonths.map((month) => ({ month: month.month, rows: rowsByMonth.get(month.month) || [] })),
      calendarEvents: calendarEvents.map((event) => ({ id: event.id, title: event.title, date: dateOnly(event.event_date), startTime: timeOnly(event.start_time), endTime: timeOnly(event.end_time), description: event.description, sourceTaskId: event.source_task_id, googleEventId: event.google_event_id, googleRecurringEventId: event.google_recurring_event_id, googleHtmlLink: event.google_html_link, googleSyncStatus: event.google_sync_status, googleSyncError: event.google_sync_error, source: event.source, sourceName: event.source_name, recurrence: event.recurrence, createdAt: iso(event.created_at) })),
      expenseCategories: expenseCategories.map((category) => ({ id: category.id, name: category.name, createdAt: iso(category.created_at) })),
      expenses: expenses.map((expense) => ({ id: expense.id, date: dateOnly(expense.expense_date), amount: Number(expense.amount) || 0, account: expense.account, category: expense.category, studio: expense.studio, comment: expense.comment, createdAt: iso(expense.created_at) })),
      trainerEvaluations: trainerEvaluations.map((evaluation) => ({ id: evaluation.id, trainerName: evaluation.trainer_name, studio: evaluation.studio, direction: evaluation.direction, score: Number(evaluation.score) || 0, evaluatedAt: dateOnly(evaluation.evaluated_at), sheetUrl: evaluation.sheet_url, createdById: evaluation.created_by_id, createdAt: iso(evaluation.created_at) })),
      trainerHiringCandidates: trainerHiringCandidates.map(mapTrainerHiringCandidate),
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
  const rawMonth = String(params.month || '').slice(0, 7);
  const hasMonthFilter = /^\d{4}-\d{2}$/.test(rawMonth);
  const month = hasMonthFilter ? rawMonth : localDateOnly().slice(0, 7);
  const bounds = monthBounds(month);

  switch (slice) {
    case 'bootstrap': {
      const [row] = await prisma.$queryRaw`
        select
          (select coalesce(jsonb_agg(to_jsonb(u) order by u.created_at asc), '[]'::jsonb) from public.users u) as users,
          (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.app_settings s) as settings_rows
      `;
      const users = jsonRows(row?.users);
      const settingsRows = jsonRows(row?.settings_rows);
      const settings = settingsRows.find((row) => row.id === 'main')?.payload || { colorMode: 'dark', density: 'comfortable', animations: true, telegramReports: true };
      return { updatedAt: nowIso(), state: { users: users.map(mapUser), settings } };
    }
    case 'tasks': {
      const tasks = await selectTable(prisma, 'tasks', 'created_at asc');
      return { updatedAt: nowIso(), state: { tasks: tasks.map((task) => ({ id: task.id, title: task.title, description: task.description || '', period: task.period || '', role: task.role, priority: task.priority, status: task.status, deadline: dateOnly(task.deadline), addToCalendar: Boolean(task.add_to_calendar), calendarEventId: task.calendar_event_id, createdAt: iso(task.created_at) })) } };
    }
    case 'content': {
      await ensureContentMediaSchema(prisma);
      const [knowledge, contentAttachments, templates, links, documentTemplates, usefulContacts, favorites, readReceipts] = await runLimited([
        () => selectTable(prisma, 'knowledge_entries', 'created_at asc'),
        () => selectTable(prisma, 'content_attachments', 'knowledge_entry_id asc, position asc, created_at asc'),
        () => selectTable(prisma, 'response_templates', 'created_at asc'),
        () => selectTable(prisma, 'helpful_links', 'created_at asc'),
        () => selectTable(prisma, 'document_templates', 'created_at asc'),
        () => selectTable(prisma, 'useful_contacts', 'created_at asc'),
        () => selectTable(prisma, 'content_favorites', 'created_at asc'),
        () => selectTable(prisma, 'content_read_receipts', 'read_at asc'),
      ]);
      const groupedAttachments = attachmentsByKnowledgeEntry(contentAttachments);
      return {
        updatedAt: nowIso(),
        state: {
          knowledge: knowledge.map((entry) => mapKnowledgeEntry(entry, groupedAttachments)),
          templates: templates.map((template) => ({ id: template.id, title: template.title, body: template.body, role: template.role, businessModel: template.business_model, purpose: template.purpose, createdById: template.created_by_id, createdAt: iso(template.created_at) })),
          links: links.map((link) => ({ id: link.id, title: link.title, url: link.url, category: link.category, role: link.role, description: link.description, createdAt: iso(link.created_at) })),
          documentTemplates: documentTemplates.map((template) => ({ id: template.id, title: template.title, url: template.url, createdById: template.created_by_id, createdAt: iso(template.created_at) })),
          usefulContacts: usefulContacts.map((contact) => ({ id: contact.id, name: contact.name, phone: contact.phone, company: contact.company, specialty: contact.specialty, createdAt: iso(contact.created_at) })),
          favorites: favorites.map((favorite) => ({ id: favorite.id, userId: favorite.user_id, entityType: favorite.entity_type, entityId: favorite.entity_id, createdAt: iso(favorite.created_at) })),
          readReceipts: readReceipts.map((receipt) => ({ id: receipt.id, userId: receipt.user_id, entityType: 'knowledge', entityId: receipt.entity_id, readAt: iso(receipt.read_at) })),
        },
      };
    }
    case 'call-checklist': {
      const callChecklistItems = await selectTable(prisma, 'call_checklist_items', 'position asc, id asc');
      return {
        updatedAt: nowIso(),
        state: {
          callChecklist: callChecklistItems.map((item) => item.label),
        },
      };
    }
    case 'control': {
      const today = localDateOnly();
      const [users, checklists, checklistItems, checklistReports, adminShifts, refunds, tasks] = await runLimited([
        () => selectTable(prisma, 'users', 'created_at asc'),
        () => prisma.$queryRaw`select * from public.daily_checklists where checklist_date = ${today}::date order by checklist_date asc`,
        () => prisma.$queryRaw`select ci.* from public.checklist_items ci join public.daily_checklists dc on dc.id = ci.checklist_id where dc.checklist_date = ${today}::date order by ci.position asc`,
        () => prisma.$queryRaw`select cr.* from public.checklist_reports cr join public.daily_checklists dc on dc.id = cr.checklist_id where dc.checklist_date = ${today}::date order by cr.slot asc`,
        () => prisma.$queryRaw`select * from public.admin_shifts where shift_date = ${today}::date order by started_at desc`,
        () => prisma.$queryRaw`select * from public.refunds order by requested_at desc limit ${REFUND_LIMIT}`,
        () => prisma.$queryRaw`select * from public.tasks where status <> 'completed'::public.task_status order by created_at asc`,
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
    case 'shift-journal': {
      const [row] = await prisma.$queryRaw`
        select
          (select coalesce(jsonb_agg(to_jsonb(u) order by u.created_at asc), '[]'::jsonb) from public.users u) as users,
          (select coalesce(jsonb_agg(to_jsonb(s) order by s.started_at desc), '[]'::jsonb) from (select * from public.admin_shifts order by started_at desc limit 500) s) as admin_shifts
      `;
      const users = jsonRows(row?.users);
      const adminShifts = jsonRows(row?.admin_shifts);
      return {
        updatedAt: nowIso(),
        state: {
          users: users.map(mapUser),
          adminShifts: adminShifts.map((shift) => ({ id: shift.id, userId: shift.user_id, adminName: shift.admin_name, studio: shift.studio, date: dateOnly(shift.shift_date), startedAt: iso(shift.started_at), closedAt: iso(shift.closed_at), remindersScheduledAt: iso(shift.reminders_scheduled_at), reminderScheduleError: shift.reminder_schedule_error })),
        },
      };
    }
    case 'checklists': {
      const since = dateDaysAgo(CHECKLIST_HISTORY_DAYS);
      const [users, checklists, checklistItems, checklistReports, adminShifts, refunds, tasks] = await runLimited([
        () => selectTable(prisma, 'users', 'created_at asc'),
        () => prisma.$queryRaw`select * from public.daily_checklists where checklist_date >= ${since}::date order by checklist_date asc`,
        () => prisma.$queryRaw`select ci.* from public.checklist_items ci join public.daily_checklists dc on dc.id = ci.checklist_id where dc.checklist_date >= ${since}::date order by ci.position asc`,
        () => prisma.$queryRaw`select cr.* from public.checklist_reports cr join public.daily_checklists dc on dc.id = cr.checklist_id where dc.checklist_date >= ${since}::date order by cr.slot asc`,
        () => prisma.$queryRaw`select * from public.admin_shifts where shift_date >= ${since}::date order by started_at desc`,
        () => prisma.$queryRaw`select * from public.refunds order by requested_at desc limit ${REFUND_LIMIT}`,
        () => selectTable(prisma, 'tasks', 'created_at asc'),
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
      const [financialMonths, financialRows, financialPayments] = await runLimited([
        () => prisma.$queryRaw`select * from public.financial_plan_months where month = ${bounds.month} order by month asc`,
        () => prisma.$queryRaw`select * from public.financial_plan_rows where month = ${bounds.month} order by position asc`,
        () => prisma.$queryRaw`select * from public.financial_plan_payments where payment_date >= ${bounds.start}::date and payment_date <= ${bounds.end}::date order by payment_date asc`,
      ]);
      return { updatedAt: nowIso(), state: { financialPlans: mapFinancialPlans(financialMonths, financialRows, financialPayments) }, sliceMeta: { month: bounds.month } };
    }
    case 'expenses': {
      const [expenseCategories, expenses] = await runLimited([
        () => selectTable(prisma, 'expense_categories', 'created_at asc'),
        () => prisma.$queryRaw`select * from public.expenses where expense_date >= ${bounds.start}::date and expense_date <= ${bounds.end}::date order by expense_date desc`,
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
    case 'trainer-evaluations': {
      const trainerEvaluations = await prisma.$queryRaw`select * from public.trainer_evaluation_sheets order by evaluated_at desc, created_at desc limit 500`;
      return {
        updatedAt: nowIso(),
        state: {
          trainerEvaluations: trainerEvaluations.map((evaluation) => ({ id: evaluation.id, trainerName: evaluation.trainer_name, studio: evaluation.studio, direction: evaluation.direction, score: Number(evaluation.score) || 0, evaluatedAt: dateOnly(evaluation.evaluated_at), sheetUrl: evaluation.sheet_url, createdById: evaluation.created_by_id, createdAt: iso(evaluation.created_at) })),
        },
      };
    }
    case 'trainer-rating': {
      const trainerEvaluations = await prisma.$queryRaw`select * from public.trainer_evaluation_sheets where evaluated_at >= ${bounds.start}::date and evaluated_at <= ${bounds.end}::date order by evaluated_at desc, created_at desc`;
      return {
        updatedAt: nowIso(),
        state: {
          trainerEvaluations: trainerEvaluations.map((evaluation) => ({ id: evaluation.id, trainerName: evaluation.trainer_name, studio: evaluation.studio, direction: evaluation.direction, score: Number(evaluation.score) || 0, evaluatedAt: dateOnly(evaluation.evaluated_at), sheetUrl: evaluation.sheet_url, createdById: evaluation.created_by_id, createdAt: iso(evaluation.created_at) })),
        },
        sliceMeta: { month: bounds.month },
      };
    }
    case 'call-rating': {
      const callReviews = await prisma.$queryRaw`select * from public.call_reviews where reviewed_at >= ${bounds.start}::date and reviewed_at <= ${bounds.end}::date order by reviewed_at desc, updated_at desc`;
      return {
        updatedAt: nowIso(),
        state: {
          callReviews: callReviews.map((review) => ({ id: review.id, source: review.source || 'levita-calls', externalId: review.external_id, adminName: review.admin_name, studio: review.studio, score: Number(review.score) || 0, reviewedAt: dateOnly(review.reviewed_at), amoCrmDealUrl: review.amo_crm_deal_url, callUrl: review.call_url, originalFilename: review.original_filename, comment: review.comment, createdAt: iso(review.created_at), updatedAt: iso(review.updated_at) })),
        },
        sliceMeta: { month: bounds.month },
      };
    }
    case 'ratings': {
      const [row] = hasMonthFilter
        ? await prisma.$queryRaw`
          select
            (select coalesce(jsonb_agg(to_jsonb(e) order by e.evaluated_at desc), '[]'::jsonb) from public.trainer_evaluation_sheets e where e.evaluated_at >= ${bounds.start}::date and e.evaluated_at <= ${bounds.end}::date) as trainer_evaluations,
            (select coalesce(jsonb_agg(to_jsonb(r) order by r.reviewed_at desc), '[]'::jsonb) from public.call_reviews r where r.reviewed_at >= ${bounds.start}::date and r.reviewed_at <= ${bounds.end}::date) as call_reviews
        `
        : await prisma.$queryRaw`
          select
            (select coalesce(jsonb_agg(to_jsonb(e) order by e.evaluated_at desc), '[]'::jsonb) from public.trainer_evaluation_sheets e) as trainer_evaluations,
            (select coalesce(jsonb_agg(to_jsonb(r) order by r.reviewed_at desc), '[]'::jsonb) from public.call_reviews r) as call_reviews
        `;
      const trainerEvaluations = jsonRows(row?.trainer_evaluations);
      const callReviews = jsonRows(row?.call_reviews);
      return {
        updatedAt: nowIso(),
        state: {
          trainerEvaluations: trainerEvaluations.map((evaluation) => ({ id: evaluation.id, trainerName: evaluation.trainer_name, studio: evaluation.studio, direction: evaluation.direction, score: Number(evaluation.score) || 0, evaluatedAt: dateOnly(evaluation.evaluated_at), sheetUrl: evaluation.sheet_url, createdById: evaluation.created_by_id, createdAt: iso(evaluation.created_at) })),
          callReviews: callReviews.map((review) => ({ id: review.id, source: review.source || 'levita-calls', externalId: review.external_id, adminName: review.admin_name, studio: review.studio, score: Number(review.score) || 0, reviewedAt: dateOnly(review.reviewed_at), amoCrmDealUrl: review.amo_crm_deal_url, callUrl: review.call_url, originalFilename: review.original_filename, comment: review.comment, createdAt: iso(review.created_at), updatedAt: iso(review.updated_at) })),
        },
        sliceMeta: hasMonthFilter ? { month: bounds.month } : undefined,
      };
    }
    case 'trainer-hiring': {
      const trainerHiringCandidates = await selectTable(prisma, 'trainer_hiring_candidates', 'status asc, updated_at desc');
      return { updatedAt: nowIso(), state: { trainerHiringCandidates: trainerHiringCandidates.map(mapTrainerHiringCandidate) } };
    }
    case 'team': {
      const users = await selectTable(prisma, 'users', 'created_at asc');
      return { updatedAt: nowIso(), state: { users: users.map(mapUser) } };
    }
    case 'audit': {
      const auditLog = await prisma.$queryRaw`select * from public.audit_log order by created_at desc limit ${AUDIT_LOG_LIMIT}`;
      return { updatedAt: nowIso(), state: { auditLog: auditLog.map((entry) => ({ id: entry.id, action: entry.action, entityType: entry.entity_type, entityId: entry.entity_id, entityLabel: entry.entity_label, description: entry.description, actorId: entry.actor_id, actorName: entry.actor_name, actorRole: entry.actor_role, createdAt: iso(entry.created_at) })) } };
    }
    case 'refunds': {
      const refunds = await prisma.$queryRaw`select * from public.refunds order by requested_at desc limit ${REFUND_LIMIT}`;
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
  if (!['ADMIN', 'SENIOR_ADMIN', 'ASSISTANT', 'TRAINER', 'SENIOR_TRAINER'].includes(user.role)) return null;
  const today = dateOnly();
  const existing = await prisma.$queryRaw`select id from public.daily_checklists where assigned_to = ${user.id} and checklist_date = ${today}::date limit 1`;
  if (existing.length) return existing[0].id;
  const checklistId = newId('checklist');
  const isTrainer = user.role === 'TRAINER' || user.role === 'SENIOR_TRAINER';
  const isAssistant = user.role === 'ASSISTANT';
  await prisma.$executeRaw`
    insert into public.daily_checklists (id, title, role, assigned_to, checklist_date, created_at, updated_at)
    values (${checklistId}, ${user.role === 'TRAINER' || user.role === 'SENIOR_TRAINER' ? 'Чек-лист тренера' : 'Чек-лист администратора на смену'}, ${user.role}::public.levtia_role, ${user.id}, ${today}::date, now(), now())
  `;
  const items = user.role === 'TRAINER' || user.role === 'SENIOR_TRAINER' ? ['Проверить готовность зала', 'Проверить оборудование', 'Заполнить заметки по тренировке'] : ADMIN_CHECKLIST_ITEMS;
  if (isAssistant) {
    await prisma.$executeRaw`update public.daily_checklists set title = ${'Чек-лист дня'} where id = ${checklistId}`;
  }
  const checklistItems = isAssistant ? ASSISTANT_CHECKLIST_ITEMS : items;
  for (const [index, label] of checklistItems.entries()) {
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
  return checklistId;
}

const WORK_LINK_ROLES_BY_ACTOR = {
  OWNER: ['ASSISTANT', 'ADMIN', 'SENIOR_ADMIN', 'TRAINER', 'SENIOR_TRAINER'],
  ASSISTANT: ['ASSISTANT', 'ADMIN', 'SENIOR_ADMIN', 'TRAINER', 'SENIOR_TRAINER'],
  SENIOR_ADMIN: ['ADMIN', 'SENIOR_ADMIN'],
  SENIOR_TRAINER: ['TRAINER', 'SENIOR_TRAINER'],
};

function workLinkPermissionError() {
  const error = new Error('Недостаточно прав для управления рабочими ссылками этой роли.');
  error.statusCode = 403;
  return error;
}

async function assertWorkLinkMutationAllowed(prisma, actor, { linkId = null, targetRole = null } = {}) {
  const allowedRoles = WORK_LINK_ROLES_BY_ACTOR[actor?.role] || [];
  if (!allowedRoles.length) throw workLinkPermissionError();

  if (linkId) {
    const rows = await prisma.$queryRaw`select role from public.helpful_links where id = ${linkId} limit 1`;
    const existingRole = rows[0]?.role || null;
    if (!existingRole || !allowedRoles.includes(existingRole)) throw workLinkPermissionError();
  }

  if (targetRole && !allowedRoles.includes(targetRole)) throw workLinkPermissionError();
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
      if (payload.role !== 'ADMIN' && payload.role !== 'SENIOR_ADMIN') {
        await ensureChecklistForUser(prisma, { id, name: payload.name, role: payload.role });
      }
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
      if (rows[0] && rows[0].role !== 'ADMIN' && rows[0].role !== 'SENIOR_ADMIN') await ensureChecklistForUser(prisma, rows[0]);
      await audit(prisma, 'employee.update', 'user', payload.id, payload.input?.name || payload.id, actor, 'Обновлен сотрудник.');
      return;
    }
    case 'employee.delete': {
      const rows = await prisma.$queryRaw`select name, role from public.users where id = ${payload.id} limit 1`;
      const deletedUser = rows[0] || null;
      const label = deletedUser ? `${deletedUser.name} · ${serverRoleLabel(deletedUser.role)}` : payload.id;
      await audit(prisma, 'employee.delete', 'user', payload.id, label, actor, 'Удален сотрудник.');
      await prisma.$executeRaw`delete from public.users where id = ${payload.id}`;
      return;
    }
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
      await assertWorkLinkMutationAllowed(prisma, actor, { targetRole: payload.role });
      await prisma.$executeRaw`insert into public.helpful_links (id, title, url, description, role, category, created_at, updated_at) values (${payload.id || newId('link')}, ${payload.title}, ${payload.url}, ${payload.description || null}, ${payload.role}::public.levtia_role, ${payload.category || 'HELPFUL'}::public.link_category, now(), now())`;
      return;
    case 'link.update':
      await assertWorkLinkMutationAllowed(prisma, actor, { linkId: payload.id, targetRole: payload.input?.role || null });
      await prisma.$executeRaw`update public.helpful_links set title = coalesce(${payload.input?.title ?? null}, title), url = coalesce(${payload.input?.url ?? null}, url), description = coalesce(${payload.input?.description ?? null}, description), role = coalesce(${payload.input?.role ?? null}::public.levtia_role, role), category = coalesce(${payload.input?.category ?? null}::public.link_category, category), updated_at = now() where id = ${payload.id}`;
      return;
    case 'link.pin': {
      let userId = actor?.id || payload.userId || null;
      if (!userId) {
        const error = new Error('Pinned link user is required.');
        error.statusCode = 400;
        throw error;
      }
      await prisma.$executeRaw`delete from public.content_favorites where entity_type = 'link' and entity_id = ${payload.id}`;
      if (payload.pinned) {
        await prisma.$executeRaw`insert into public.content_favorites (id, user_id, entity_type, entity_id, created_at) values (${payload.favoriteId || newId('favorite')}, ${userId}, 'link', ${payload.id}, now()) on conflict (user_id, entity_type, entity_id) do nothing`;
      }
      return;
    }
    case 'link.delete':
      await assertWorkLinkMutationAllowed(prisma, actor, { linkId: payload.id });
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
      await ensureContentMediaSchema(prisma);
      await prisma.$executeRaw`insert into public.knowledge_entries (id, title, content, role, category, business_model, hashtags, is_actual, searchable, video_url, created_at, updated_at) values (${payload.id || newId('knowledge')}, ${payload.title}, ${payload.content}, ${payload.role}::public.levtia_role, ${payload.category}::public.knowledge_category, ${normalizeBusinessModel(payload.businessModel)}, ${payload.hashtags || null}, ${payload.isActual !== false}, true, ${payload.videoUrl || null}, now(), now())`;
      return;
    case 'knowledge.update':
      await ensureContentMediaSchema(prisma);
      await prisma.$executeRaw`update public.knowledge_entries set title = coalesce(${payload.input?.title ?? null}, title), content = coalesce(${payload.input?.content ?? null}, content), role = coalesce(${payload.input?.role ?? null}::public.levtia_role, role), category = coalesce(${payload.input?.category ?? null}::public.knowledge_category, category), business_model = coalesce(${payload.input?.businessModel ? normalizeBusinessModel(payload.input.businessModel) : null}, business_model), hashtags = coalesce(${payload.input?.hashtags ?? null}, hashtags), is_actual = coalesce(${payload.input?.isActual ?? null}, is_actual), video_url = case when ${Object.prototype.hasOwnProperty.call(payload.input || {}, 'videoUrl')} then ${payload.input?.videoUrl || null} else video_url end, updated_at = now() where id = ${payload.id}`;
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
      let checklistId = payload.checklistId;
      const existingChecklist = checklistId
        ? await prisma.$queryRaw`select id from public.daily_checklists where id = ${checklistId} limit 1`
        : [];
      if (!existingChecklist.length && payload.assignedTo) {
        const users = await prisma.$queryRaw`select id, name, role from public.users where id = ${payload.assignedTo} limit 1`;
        if (users[0]) checklistId = await ensureChecklistForUser(prisma, users[0]);
      }
      const resolvedChecklist = checklistId
        ? await prisma.$queryRaw`select id from public.daily_checklists where id = ${checklistId} limit 1`
        : [];
      if (!resolvedChecklist.length) {
        const error = new Error('Checklist was not found for item creation.');
        error.statusCode = 404;
        throw error;
      }
      const [{ count }] = await prisma.$queryRaw`select count(*)::int as count from public.checklist_items where checklist_id = ${checklistId}`;
      await prisma.$executeRaw`insert into public.checklist_items (id, checklist_id, label, completed, position) values (${payload.id || newId('checklist-item')}, ${checklistId}, ${payload.label}, false, ${count || 0})`;
      return;
    }
    case 'checklist.item.delete': {
      let deleted = await prisma.$executeRaw`delete from public.checklist_items where id = ${payload.itemId}`;
      if (!deleted && payload.checklistId && payload.label) {
        deleted = await prisma.$executeRaw`
          delete from public.checklist_items
          where id = (
            select id from public.checklist_items
            where checklist_id = ${payload.checklistId}
              and label = ${payload.label}
            order by position asc, id asc
            limit 1
          )
        `;
      }
      if (!deleted && payload.assignedTo) {
        const users = await prisma.$queryRaw`select id, name, role from public.users where id = ${payload.assignedTo} limit 1`;
        const checklistId = users[0] ? await ensureChecklistForUser(prisma, users[0]) : null;
        if (checklistId) {
          deleted = await prisma.$executeRaw`
            delete from public.checklist_items
            where id = (
              select id from public.checklist_items
              where checklist_id = ${checklistId}
                and (id = ${payload.itemId} or label = ${payload.label || ''})
              order by position asc, id asc
              limit 1
            )
          `;
        }
      }
      if (payload.checklistId || payload.assignedTo) {
        const targetChecklistId = payload.checklistId || null;
        if (targetChecklistId) {
          await prisma.$executeRaw`
            update public.checklist_items item
            set position = ordered.new_position
            from (
              select id, row_number() over (order by position asc, id asc) - 1 as new_position
              from public.checklist_items
              where checklist_id = ${targetChecklistId}
            ) ordered
            where item.id = ordered.id
          `;
        }
      }
      return;
    }
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
      const base = financialBaseId(baseId);
      const startMonth = /^\d{4}-\d{2}$/.test(String(payload.month || '')) ? String(payload.month) : localDateOnly().slice(0, 7);
      await prisma.$executeRaw`
        with generated_months as (
          select to_char((${startMonth} || '-01')::date + (step || ' months')::interval, 'YYYY-MM') as month
          from generate_series(0, ${FINANCIAL_PLAN_FORWARD_MONTHS}) as step
        ),
        upserted_months as (
          insert into public.financial_plan_months (month, updated_at)
          select month, now()
          from generated_months
          on conflict (month) do update set updated_at = excluded.updated_at
          returning month
        ),
        row_positions as (
          select generated_months.month, coalesce(max(financial_plan_rows.position), -1) + 1 as position
          from generated_months
          left join public.financial_plan_rows on financial_plan_rows.month = generated_months.month
          group by generated_months.month
        )
        insert into public.financial_plan_rows (id, month, title, position, created_at, updated_at)
        select row_positions.month || ':' || ${base}, row_positions.month, ${payload.title}, row_positions.position, now(), now()
        from row_positions
        on conflict (id) do nothing
      `;
      return;
    }
    case 'financial.row.update': {
      const { pattern } = financialRowFilterSql(payload.rowId);
      await prisma.$executeRaw`update public.financial_plan_rows set title = ${payload.title}, updated_at = now() where month >= ${payload.month} and (id = ${payload.rowId} or id like ${pattern})`;
      return;
    }
    case 'financial.row.delete': {
      const { pattern } = financialRowFilterSql(payload.rowId);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          delete from public.financial_plan_payments
          where row_id in (
            select id from public.financial_plan_rows
            where month >= ${payload.month}
              and (id = ${payload.rowId} or id like ${pattern})
          )
        `;
        await tx.$executeRaw`
          delete from public.financial_plan_rows
          where month >= ${payload.month}
            and (id = ${payload.rowId} or id like ${pattern})
        `;
      });
      return;
    }
    case 'financial.cell.update': {
      const { pattern } = financialRowFilterSql(payload.rowId);
      const rows = await prisma.$queryRaw`select id, month, title, position from public.financial_plan_rows where month >= ${payload.month} and (id = ${payload.rowId} or id like ${pattern}) order by month asc`;
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
    case 'trainerHiring.create':
      await prisma.$executeRaw`
        insert into public.trainer_hiring_candidates (
          id, full_name, status, video_intro_approved, primary_documents_received, nda_signed, nda_link,
          intro_zoom_scheduled, intro_zoom_date, intro_zoom_time,
          second_certification_preparation_zoom_scheduled, second_certification_preparation_zoom_date, second_certification_preparation_zoom_time,
          second_certification_scheduled, second_certification_date, second_certification_time,
          second_certification_result, second_certification_retake_date, trainings_visited_after_second_certification,
          media_collected, third_certification_preparation_zoom_date, third_certification_preparation_zoom_time,
          third_certification_scheduled, third_certification_date, third_certification_time, third_certification_result,
          working_hours_assigned, first_shift_date, created_by_id, created_at, updated_at, rejected_at
        )
        values (
          ${payload.id || newId('trainer-hiring')}, ${String(payload.fullName || '').trim()}, ${payload.status === 'rejected' ? 'rejected' : 'active'},
          ${payload.videoIntroApproved === undefined ? null : payload.videoIntroApproved}, ${Boolean(payload.primaryDocumentsReceived)},
          ${Boolean(payload.ndaSigned)}, ${payload.ndaLink || null}, ${Boolean(payload.introZoomScheduled)},
          ${payload.introZoomDate ? dateOnly(payload.introZoomDate) : null}::date, ${timeOnly(payload.introZoomTime)}::time,
          ${Boolean(payload.secondCertificationPreparationZoomScheduled)}, ${payload.secondCertificationPreparationZoomDate ? dateOnly(payload.secondCertificationPreparationZoomDate) : null}::date,
          ${timeOnly(payload.secondCertificationPreparationZoomTime)}::time,
          ${Boolean(payload.secondCertificationScheduled)}, ${payload.secondCertificationDate ? dateOnly(payload.secondCertificationDate) : null}::date,
          ${timeOnly(payload.secondCertificationTime)}::time,
          ${['passed', 'failed'].includes(payload.secondCertificationResult) ? payload.secondCertificationResult : 'pending'},
          ${payload.secondCertificationRetakeDate ? dateOnly(payload.secondCertificationRetakeDate) : null}::date,
          ${Boolean(payload.trainingsVisitedAfterSecondCertification)}, ${Boolean(payload.mediaCollected)},
          ${payload.thirdCertificationPreparationZoomDate ? dateOnly(payload.thirdCertificationPreparationZoomDate) : null}::date,
          ${timeOnly(payload.thirdCertificationPreparationZoomTime)}::time,
          ${Boolean(payload.thirdCertificationScheduled)}, ${payload.thirdCertificationDate ? dateOnly(payload.thirdCertificationDate) : null}::date,
          ${timeOnly(payload.thirdCertificationTime)}::time, ${['passed', 'failed'].includes(payload.thirdCertificationResult) ? payload.thirdCertificationResult : 'pending'},
          ${Boolean(payload.workingHoursAssigned)}, ${payload.firstShiftDate ? dateOnly(payload.firstShiftDate) : null}::date,
          ${actor?.id || payload.createdById || null}, now(), now(), ${payload.status === 'rejected' ? now : null}::timestamptz
        )
      `;
      await audit(prisma, 'trainerHiring.create', 'trainer_hiring_candidate', payload.id || '', payload.fullName || '', actor, 'Создан кандидат тренера.');
      return;
    case 'trainerHiring.update': {
      const input = payload.input || {};
      if (!String(input.fullName || '').trim()) {
        const error = new Error('Candidate full name is required.');
        error.statusCode = 400;
        throw error;
      }
      await prisma.$executeRaw`
        update public.trainer_hiring_candidates
        set full_name = ${String(input.fullName || '').trim()},
            status = ${input.status === 'rejected' ? 'rejected' : 'active'},
            video_intro_approved = ${input.videoIntroApproved === undefined ? null : input.videoIntroApproved},
            primary_documents_received = ${Boolean(input.primaryDocumentsReceived)},
            nda_signed = ${Boolean(input.ndaSigned)},
            nda_link = ${input.ndaLink || null},
            intro_zoom_scheduled = ${Boolean(input.introZoomScheduled)},
            intro_zoom_date = ${input.introZoomDate ? dateOnly(input.introZoomDate) : null}::date,
            intro_zoom_time = ${timeOnly(input.introZoomTime)}::time,
            second_certification_preparation_zoom_scheduled = ${Boolean(input.secondCertificationPreparationZoomScheduled)},
            second_certification_preparation_zoom_date = ${input.secondCertificationPreparationZoomDate ? dateOnly(input.secondCertificationPreparationZoomDate) : null}::date,
            second_certification_preparation_zoom_time = ${timeOnly(input.secondCertificationPreparationZoomTime)}::time,
            second_certification_scheduled = ${Boolean(input.secondCertificationScheduled)},
            second_certification_date = ${input.secondCertificationDate ? dateOnly(input.secondCertificationDate) : null}::date,
            second_certification_time = ${timeOnly(input.secondCertificationTime)}::time,
            second_certification_result = ${['passed', 'failed'].includes(input.secondCertificationResult) ? input.secondCertificationResult : 'pending'},
            second_certification_retake_date = ${input.secondCertificationRetakeDate ? dateOnly(input.secondCertificationRetakeDate) : null}::date,
            trainings_visited_after_second_certification = ${Boolean(input.trainingsVisitedAfterSecondCertification)},
            media_collected = ${Boolean(input.mediaCollected)},
            third_certification_preparation_zoom_date = ${input.thirdCertificationPreparationZoomDate ? dateOnly(input.thirdCertificationPreparationZoomDate) : null}::date,
            third_certification_preparation_zoom_time = ${timeOnly(input.thirdCertificationPreparationZoomTime)}::time,
            third_certification_scheduled = ${Boolean(input.thirdCertificationScheduled)},
            third_certification_date = ${input.thirdCertificationDate ? dateOnly(input.thirdCertificationDate) : null}::date,
            third_certification_time = ${timeOnly(input.thirdCertificationTime)}::time,
            third_certification_result = ${['passed', 'failed'].includes(input.thirdCertificationResult) ? input.thirdCertificationResult : 'pending'},
            working_hours_assigned = ${Boolean(input.workingHoursAssigned)},
            first_shift_date = ${input.firstShiftDate ? dateOnly(input.firstShiftDate) : null}::date,
            rejected_at = case when ${input.status === 'rejected'} then coalesce(rejected_at, now()) else null end,
            updated_at = now()
        where id = ${payload.id}
      `;
      await audit(prisma, 'trainerHiring.update', 'trainer_hiring_candidate', payload.id, input.fullName || payload.id, actor, 'Обновлена карточка кандидата тренера.');
      return;
    }
    case 'trainerHiring.reject':
      await prisma.$executeRaw`
        update public.trainer_hiring_candidates
        set status = 'rejected',
            rejected_at = coalesce(${payload.rejectedAt || null}::timestamptz, now()),
            updated_at = now()
        where id = ${payload.id}
      `;
      await audit(prisma, 'trainerHiring.reject', 'trainer_hiring_candidate', payload.id, payload.id, actor, 'Кандидату тренера отказано.');
      return;
    case 'settings.update':
      await prisma.$executeRaw`insert into public.app_settings (id, payload, updated_at) values ('main', ${jsonValue(payload.input || {})}, now()) on conflict (id) do update set payload = public.app_settings.payload || excluded.payload, updated_at = now()`;
      return;
    case 'favorite.toggle': {
      let userId = actor?.id || null;
      if (!userId && payload.actorRole) {
        const users = await prisma.$queryRaw`
          select id
          from public.users
          where role = ${payload.actorRole}::public.levtia_role
            and status <> 'blocked'::public.employee_status
          order by created_at asc
          limit 1
        `;
        userId = users[0]?.id || null;
      }
      if (!userId) {
        const error = new Error('Favorite user is required.');
        error.statusCode = 400;
        throw error;
      }
      const existing = await prisma.$queryRaw`select id from public.content_favorites where user_id = ${userId} and entity_type = ${payload.entityType} and entity_id = ${payload.entityId}`;
      if (existing.length) await prisma.$executeRaw`delete from public.content_favorites where id = ${existing[0].id}`;
      else await prisma.$executeRaw`insert into public.content_favorites (id, user_id, entity_type, entity_id, created_at) values (${payload.id || newId('favorite')}, ${userId}, ${payload.entityType}, ${payload.entityId}, now()) on conflict (user_id, entity_type, entity_id) do nothing`;
      return;
    }
    case 'knowledge.read':
      await prisma.$executeRaw`insert into public.content_read_receipts (id, user_id, entity_type, entity_id, read_at) values (${newId('read-receipt')}, ${actor?.id}, 'knowledge', ${payload.entityId}, now()) on conflict (user_id, entity_type, entity_id) do update set read_at = now()`;
      return;
    case 'callChecklist.add': {
      const [{ count }] = await prisma.$queryRaw`select count(*)::int as count from public.call_checklist_items`;
      await prisma.$executeRaw`insert into public.call_checklist_items (id, label, position, updated_at) values (${newId('call-checklist')}, ${payload.label}, ${count || 0}, now())`;
      return;
    }
    case 'callChecklist.update':
      await prisma.$executeRaw`
        update public.call_checklist_items
        set label = ${payload.label}, updated_at = now()
        where id = (
          select id from public.call_checklist_items
          order by position asc, id asc
          offset ${payload.index || 0}
          limit 1
        )
      `;
      return;
    case 'callChecklist.delete':
      await prisma.$executeRaw`
        delete from public.call_checklist_items
        where id = coalesce(
          (
            select id from public.call_checklist_items
            order by position asc, id asc
            offset ${payload.index || 0}
            limit 1
          ),
          (
            select id from public.call_checklist_items
            where label = ${payload.label || null}
            order by position asc, id asc
            limit 1
          )
        )
      `;
      await prisma.$executeRaw`
        update public.call_checklist_items item
        set position = ordered.new_position, updated_at = now()
        from (
          select id, row_number() over (order by position asc, id asc) - 1 as new_position
          from public.call_checklist_items
        ) ordered
        where item.id = ordered.id
      `;
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
