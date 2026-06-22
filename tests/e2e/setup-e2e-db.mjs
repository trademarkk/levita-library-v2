import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dbPath = process.env.LEVTIA_SQLITE_PATH
  ? (isAbsolute(process.env.LEVTIA_SQLITE_PATH) ? process.env.LEVTIA_SQLITE_PATH : resolve(rootDir, process.env.LEVTIA_SQLITE_PATH))
  : resolve(rootDir, 'data', 'e2e-levtia-library.sqlite');

const now = new Date().toISOString();
const today = now.slice(0, 10);
const month = today.slice(0, 7);

function id(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function createReport(slot, adminName) {
  return {
    slot,
    studio: 'STAVROPOLSKAYA',
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

function createChecklist({ checklistId, userId, role, title, adminName, items }) {
  const isAdmin = role === 'ADMIN' || role === 'SENIOR_ADMIN';
  return {
    id: checklistId,
    title,
    role,
    assignedTo: userId,
    date: `${today}T00:00:00.000+03:00`,
    createdAt: now,
    reports: isAdmin ? [createReport('14:00', adminName), createReport('18:00', adminName)] : [],
    items: items.map((label, index) => ({
      id: `${checklistId}-item-${index + 1}`,
      label,
      completed: false,
      completedAt: null,
      completedBy: null,
    })),
  };
}

const users = [
  { id: 'user-owner', name: 'Артём Руководитель', email: 'owner@levita.ru', password: 'owner123', role: 'OWNER', status: 'active', joinDate: 'янв 2024', createdAt: now },
  { id: 'user-assistant', name: 'Полина Ассистент', email: 'assistant@levita.ru', password: 'assistant123', role: 'ASSISTANT', status: 'active', joinDate: 'янв 2025', createdAt: now },
  { id: 'user-senior-admin', name: 'Полина Старший Админ', email: 'senior-admin@levita.ru', password: 'senior123', role: 'SENIOR_ADMIN', status: 'active', joinDate: 'мар 2024', createdAt: now },
  { id: 'user-admin', name: 'Елена Администратор', email: 'admin@levita.ru', password: 'admin123', role: 'ADMIN', status: 'active', joinDate: 'сен 2025', createdAt: now },
  { id: 'user-senior-trainer', name: 'Алина Старший Тренер', email: 'senior-trainer@levita.ru', password: 'trainer123', role: 'SENIOR_TRAINER', status: 'active', joinDate: 'апр 2024', createdAt: now },
  { id: 'user-trainer', name: 'Мила Тренер', email: 'trainer@levita.ru', password: 'trainer123', role: 'TRAINER', status: 'active', joinDate: 'июн 2025', createdAt: now },
];

const state = {
  schemaVersion: 2,
  users,
  tasks: [
    { id: 'task-1', title: 'Проверить срочные сообщения', description: 'Собрать задачи, требующие ответа сегодня.', period: 'ежедневно', role: 'ASSISTANT', priority: 'high', status: 'pending', deadline: today, createdAt: now },
    { id: 'task-2', title: 'Обновить кандидатов', description: 'Проверить статусы кандидатов тренеров.', period: 'еженедельно', role: 'ASSISTANT', priority: 'medium', status: 'completed', deadline: today, createdAt: now },
  ],
  templates: [
    { id: 'template-assistant-1', title: 'Ответ кандидату', body: 'Здравствуйте! Спасибо за отклик. Подскажите, актуален ли поиск работы?', role: 'ASSISTANT', businessModel: 'ALL', purpose: 'кандидаты', createdById: 'user-owner', createdAt: now },
    { id: 'template-admin-1', title: 'Подтверждение записи', body: 'Подтверждаем вашу запись на пробное занятие.', role: 'ADMIN', businessModel: 'ALL', purpose: 'клиенты', createdById: 'user-senior-admin', createdAt: now },
  ],
  links: [
    { id: 'link-assistant-1', title: 'Таблица ассистента', url: 'https://example.com/candidates', category: 'WORK_TABLE', role: 'ASSISTANT', description: 'Рабочая таблица ассистента.', createdAt: now },
    { id: 'link-admin-1', title: 'Рабочая таблица админов', url: 'https://example.com/admins', category: 'WORK_TABLE', role: 'ADMIN', description: 'Общая таблица администраторов.', createdAt: now },
    { id: 'link-trainer-1', title: 'Таблица тренеров', url: 'https://example.com/trainers', category: 'WORK_TABLE', role: 'TRAINER', description: 'Общая таблица тренеров.', createdAt: now },
  ],
  documentTemplates: [
    { id: 'document-template-1', title: 'Анкета кандидата', url: 'https://drive.google.com/example', createdAt: now, createdById: 'user-assistant' },
  ],
  usefulContacts: [
    { id: 'contact-1', name: 'Ирина Соколова', phone: '+7 900 000-00-00', company: 'Event People', specialty: 'Организация мероприятий', createdAt: now },
  ],
  knowledge: [
    { id: 'knowledge-assistant-responsibility', title: 'Обязанность ассистента', content: 'Вести кандидатов, шаблоны документов и ежедневные задачи.', role: 'ASSISTANT', category: 'RESPONSIBILITY', businessModel: 'ALL', hashtags: '#ассистент', isActual: true, searchable: true, createdAt: now },
    { id: 'knowledge-assistant-info', title: 'Информация ассистента', content: 'Оперативная информация для ассистента.', role: 'ASSISTANT', category: 'IMPORTANT_INFO', businessModel: 'ALL', hashtags: '#важное', isActual: true, searchable: true, createdAt: now },
    { id: 'knowledge-assistant-base', title: 'База знаний ассистента', content: 'Материал для проверки поиска по хештегу.', role: 'ASSISTANT', category: 'KNOWLEDGE', businessModel: 'SUBSCRIPTION', hashtags: '#e2e #ассистент', isActual: true, searchable: true, createdAt: now },
    { id: 'knowledge-admin-regulation', title: 'Регламент администратора', content: 'Правила открытия смены и сдачи отчётов. https://drive.google.com/document/d/existing-admin-regulation', role: 'ADMIN', category: 'REGULATION', businessModel: 'ALL', hashtags: '#регламент', isActual: true, searchable: true, createdAt: now },
    { id: 'knowledge-admin-knowledge', title: 'База знаний администратора', content: 'Коммуникация с клиентами и контроль записи.', role: 'ADMIN', category: 'KNOWLEDGE', businessModel: 'MEMBERSHIP', hashtags: '#клиенты', isActual: true, searchable: true, createdAt: now },
    { id: 'knowledge-trainer-regulation', title: 'Регламент тренера', content: 'Стандарты подготовки занятия.', role: 'TRAINER', category: 'REGULATION', businessModel: 'ALL', hashtags: '#тренер', isActual: true, searchable: true, createdAt: now },
  ],
  checklists: [
    createChecklist({
      checklistId: 'checklist-assistant',
      userId: 'user-assistant',
      role: 'ASSISTANT',
      title: 'Чек-лист дня',
      adminName: 'Полина Ассистент',
      items: ['Проверить входящие сообщения', 'Обновить полезные ссылки'],
    }),
    createChecklist({
      checklistId: 'checklist-senior-admin',
      userId: 'user-senior-admin',
      role: 'SENIOR_ADMIN',
      title: 'Чек-лист администратора на смену',
      adminName: 'Полина Старший Админ',
      items: ['Проверить чистоту студии', 'Отчёт по звонкам и кассе в 14:00', 'Отчёт по звонкам и кассе в 18:00'],
    }),
    createChecklist({
      checklistId: 'checklist-admin',
      userId: 'user-admin',
      role: 'ADMIN',
      title: 'Чек-лист администратора на смену',
      adminName: 'Елена Администратор',
      items: ['Проверить чистоту студии', 'Отчёт по звонкам и кассе в 14:00', 'Отчёт по звонкам и кассе в 18:00'],
    }),
    createChecklist({
      checklistId: 'checklist-trainer',
      userId: 'user-trainer',
      role: 'TRAINER',
      title: 'Чек-лист тренировки',
      adminName: 'Мила Тренер',
      items: ['Проверить готовность зала', 'Заполнить заметки по тренировке'],
    }),
    createChecklist({
      checklistId: 'checklist-senior-trainer',
      userId: 'user-senior-trainer',
      role: 'SENIOR_TRAINER',
      title: 'Чек-лист тренировки',
      adminName: 'Алина Старший Тренер',
      items: ['Проверить готовность зала', 'Заполнить заметки по тренировке'],
    }),
  ],
  refunds: [
    { id: 'refund-1', clientName: 'Иванова Анна', requestedAt: now, amount: 15000, reason: 'Медицинские ограничения', status: 'IN_PROGRESS', comment: 'Ожидает документов.', createdAt: now },
  ],
  financialPlans: [
    { month, rows: [{ id: `financial-row-${month}`, title: 'Аренда', payments: { [`${month}-15`]: '100000' } }] },
  ],
  expenseCategories: [
    { id: 'expense-category-1', name: 'Аренда', createdAt: now },
    { id: 'expense-category-2', name: 'Маркетинг', createdAt: now },
  ],
  expenses: [
    { id: 'expense-1', date: today, amount: 5000, account: 'RS_SBER', category: 'Маркетинг', studio: 'STAVROPOLSKAYA', comment: 'Тестовый расход', createdAt: now },
  ],
  trainerEvaluations: [
    { id: 'trainer-evaluation-1', trainerName: 'Мила Тренер', studio: 'MACHUGI', direction: 'Растяжка', score: 8.8, evaluatedAt: today, sheetUrl: 'https://docs.google.com/spreadsheets/example', createdAt: now, createdById: 'user-assistant' },
  ],
  trainerHiringCandidates: [
    {
      id: 'trainer-hiring-1',
      fullName: 'Ольга Кандидат',
      status: 'active',
      videoIntroApproved: true,
      primaryDocumentsReceived: true,
      ndaSigned: false,
      ndaLink: null,
      introZoomScheduled: true,
      introZoomDate: today,
      introZoomTime: '12:30',
      secondCertificationPreparationZoomScheduled: false,
      secondCertificationPreparationZoomDate: null,
      secondCertificationPreparationZoomTime: null,
      secondCertificationScheduled: false,
      secondCertificationDate: null,
      secondCertificationTime: null,
      secondCertificationResult: 'pending',
      secondCertificationRetakeDate: null,
      trainingsVisitedAfterSecondCertification: false,
      mediaCollected: false,
      thirdCertificationScheduled: false,
      thirdCertificationDate: null,
      thirdCertificationTime: null,
      thirdCertificationResult: 'pending',
      thirdCertificationPreparationZoomDate: null,
      thirdCertificationPreparationZoomTime: null,
      workingHoursAssigned: false,
      firstShiftDate: null,
      createdAt: now,
      updatedAt: now,
      rejectedAt: null,
      createdById: 'user-senior-trainer',
    },
  ],
  callReviews: [
    { id: 'call-review-1', source: 'levita-calls', externalId: 'e2e-call-1', adminName: 'Елена Администратор', studio: 'STAVROPOLSKAYA', score: 82, reviewedAt: today, amoCrmDealUrl: 'https://example.com/amo', callUrl: null, originalFilename: null, comment: null, createdAt: now, updatedAt: now },
  ],
  favorites: [],
  readReceipts: [],
  callChecklist: ['Поздороваться и назвать студию', 'Уточнить цель клиента'],
  adminShifts: [],
  auditLog: [],
  settings: {
    colorMode: 'dark',
    density: 'comfortable',
    animations: false,
    telegramReports: false,
  },
};

mkdirSync(dirname(dbPath), { recursive: true });
rmSync(dbPath, { force: true });

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE app_state (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE app_state_backups (
    id TEXT PRIMARY KEY,
    state_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    backed_up_at TEXT NOT NULL
  );
`);

db.prepare('INSERT INTO app_state (id, payload, updated_at) VALUES (?, ?, ?)').run('main', JSON.stringify(state), now);
db.close();

console.log(`Prepared LEVTIA e2e database: ${dbPath}`);
