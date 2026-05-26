import type { ChecklistReportSlot, DailyChecklist, LibraryState, Role } from './types';

const now = '2026-05-13T09:00:00.000+03:00';

function id(prefix: string, value: number) {
  return `${prefix}-${value}`;
}

export const adminChecklistItems = [
  'Проверить чистоту студии: зеркала, углы и поверхности',
  'Отправить кружок об открытии студии до 09:30',
  'Скинуть план в чат до 10:00',
  'Подключиться на планёрку в 10:10',
  'Проверить воронку «Ждём оплату» до 12:00',
  'Позвонить по воронке «Взят в работу» до 12:00',
  'Разобрать задачи в листке до 14:00',
  'Отчёт по звонкам и кассе в 14:00',
  'Разобрать встречи до 15:00',
  'Разобрать заявки в течение 15 минут',
  'Отчёт по звонкам и кассе в 18:00',
  'Тренировка в приложении не менее 1 раза',
  'Сделать цифру дня',
  'Проверить задачи в amoCRM, нет просрочки',
  'Подарить купон на массаж всем пробницам и отправить контакт в «МАНТРУ» с согласия клиента',
  'Поменять воронку пробницам и поставить встречу тем, кто купил',
  'Отправить в чат «Документы» документы клиентов',
  'Проверить, что в листке все отмечены и пробные проведены',
  'Сверить выручку в отчётах, кассе и таблицах',
  'Заполнить таблицы на закрытие',
  'Сделать сверку итогов по кассе и терминалу рассрочки',
  'Скинуть в чат отчёт и фото чеков закрытия смены',
  'Проверить запись на завтра и поднять людей из очереди',
  'Звонки: сделать план звонков и записей',
  'Поставить телефон и терминал на зарядку',
];

const assistantChecklistItems = [
  'Проверить входящие сообщения и срочные задачи',
  'Обновить статусы кандидатов',
  'Проверить полезные ссылки и рабочие таблицы',
  'Подготовить шаблоны ответов для кандидатов',
];

function createReport(slot: ChecklistReportSlot, adminName: string) {
  return {
    slot,
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
  };
}

function createChecklist(userId: string, role: Role, index: number): DailyChecklist {
  const isAdminRole = role === 'ADMIN' || role === 'SENIOR_ADMIN';
  const labels = isAdminRole ? adminChecklistItems : assistantChecklistItems;
  const assigneeName = role === 'SENIOR_ADMIN' ? 'Мария Старший Админ' : role === 'ADMIN' ? 'Елена Администратор' : 'Анна Ассистент';

  return {
    id: id('checklist', index),
    title: isAdminRole ? 'Чек-лист администратора на смену' : 'Чек-лист дня',
    role,
    assignedTo: userId,
    date: '2026-05-13T00:00:00.000+03:00',
    createdAt: now,
    reports: isAdminRole ? [createReport('14:00', assigneeName), createReport('18:00', assigneeName), createReport('22:00', assigneeName)] : [],
    items: labels.map((label, itemIndex) => ({
      id: id(`checklist-${index}-item`, itemIndex + 1),
      label,
      completed: itemIndex < 2,
      completedAt: itemIndex < 2 ? `2026-05-13T0${9 + itemIndex}:20:00.000+03:00` : null,
      completedBy: itemIndex < 2 ? userId : null,
    })),
  };
}

export const initialState: LibraryState = {
  users: [
    { id: 'user-owner', name: 'Артём Левит', email: 'owner@levita.ru', password: 'owner123', role: 'OWNER', status: 'active', joinDate: 'янв 2024', createdAt: now },
    { id: 'user-assistant', name: 'Анна Ассистент', email: 'assistant@levita.ru', password: 'assistant123', role: 'ASSISTANT', status: 'active', joinDate: 'янв 2025', createdAt: now },
    { id: 'user-senior-admin', name: 'Мария Старший Админ', email: 'senior-admin@levita.ru', password: 'senior123', role: 'SENIOR_ADMIN', status: 'active', joinDate: 'мар 2024', createdAt: now },
    { id: 'user-admin', name: 'Елена Администратор', email: 'admin@levita.ru', password: 'admin123', role: 'ADMIN', status: 'active', joinDate: 'сен 2025', createdAt: now },
    { id: 'user-senior-trainer', name: 'Алина Старший Тренер', email: 'senior-trainer@levita.ru', password: 'trainer123', role: 'SENIOR_TRAINER', status: 'active', joinDate: 'апр 2024', createdAt: now },
    { id: 'user-trainer', name: 'Мила Тренер', email: 'trainer@levita.ru', password: 'trainer123', role: 'TRAINER', status: 'active', joinDate: 'июн 2025', createdAt: now },
  ],
  tasks: [
    { id: 'task-1', title: 'Ответить кандидатам после отклика', description: 'Уточнить актуальность поиска работы и передать следующий шаг.', period: 'ежедневно', role: 'ASSISTANT', priority: 'high', status: 'pending', createdAt: now },
    { id: 'task-2', title: 'Обновить таблицу вакансий', description: 'Проверить новые отклики, статусы и комментарии.', period: '2 раза в неделю', role: 'ASSISTANT', priority: 'medium', status: 'in-progress', createdAt: now },
    { id: 'task-3', title: 'Подготовить приветственные сообщения', description: 'Отправить шаблон новым кандидатам и клиентам.', period: 'ежедневно', role: 'ASSISTANT', priority: 'low', status: 'completed', createdAt: now },
  ],
  templates: [
    { id: 'template-1', title: 'Ответ кандидату после отклика', body: 'Здравствуйте! Спасибо за отклик. Подскажите, пожалуйста, актуален ли для вас поиск работы?', role: 'ASSISTANT', purpose: 'кандидаты', createdById: 'user-owner', createdAt: now },
    { id: 'template-2', title: 'Запись клиента на пробное занятие', body: 'Добрый день! С радостью запишу вас на пробное занятие. Подскажите удобный день и время.', role: 'ADMIN', purpose: 'клиенты', createdById: 'user-senior-admin', createdAt: now },
    { id: 'template-3', title: 'Подтверждение записи', body: 'Подтверждаю вашу запись. Пожалуйста, приходите за 10 минут до начала занятия.', role: 'ADMIN', purpose: 'клиенты', createdById: 'user-owner', createdAt: now },
  ],
  links: [
    { id: 'link-1', title: 'Таблица вакансий', url: 'https://example.com/vacancies', category: 'HELPFUL', role: 'ASSISTANT', description: 'Рабочая таблица по кандидатам.', createdAt: now },
    { id: 'link-2', title: 'Рабочая таблица администраторов', url: 'https://example.com/admin-sheet', category: 'WORK_TABLE', role: 'ADMIN', description: 'Операционная таблица смен.', createdAt: now },
    { id: 'link-3', title: 'Материалы обучения', url: 'https://example.com/training', category: 'TRAINING', role: 'ASSISTANT', description: 'Внутренние инструкции и материалы.', createdAt: now },
  ],
  documentTemplates: [
    { id: 'document-template-1', title: 'Анкета кандидата', url: 'https://drive.google.com/', createdAt: now, createdById: 'user-assistant' },
  ],
  usefulContacts: [
    { id: 'contact-1', name: 'Ирина Соколова', phone: '+7 900 000-00-00', company: 'Event People', specialty: 'Организация локальных мероприятий и партнёрств', createdAt: now },
  ],
  knowledge: [
    { id: 'knowledge-1', title: 'Стандарты открытия студии', content: 'Проверить чистоту, освещение, музыку, расписание и готовность администратора к первой записи.', role: 'ADMIN', category: 'REGULATION', hashtags: '#студия #открытие', searchable: true, createdAt: now },
    { id: 'knowledge-2', title: 'Важная информация по пробным занятиям', content: 'Клиенту важно заранее отправить адрес, форму одежды, правила отмены и время прибытия.', role: 'ADMIN', category: 'IMPORTANT_INFO', hashtags: '#пробное #клиенты', searchable: true, createdAt: now },
    { id: 'knowledge-3', title: 'Зона ответственности администратора', content: 'Смена, касса, звонки, корректная коммуникация, запись клиентов и ежедневный чек-лист.', role: 'ADMIN', category: 'RESPONSIBILITY', hashtags: '#ответственность', searchable: true, createdAt: now },
    { id: 'knowledge-4', title: 'Обучение ассистента', content: 'Ассистент работает с кандидатами, шаблонами ответов, полезными ссылками, контактами и ежедневным чек-листом.', role: 'ASSISTANT', category: 'TRAINING', hashtags: '#обучение', searchable: true, createdAt: now },
    { id: 'knowledge-5', title: 'База знаний по клиентскому сервису', content: 'Единые правила ответа клиентам, фиксации договорённостей и передачи сложных ситуаций старшему администратору.', role: 'ADMIN', category: 'KNOWLEDGE', hashtags: '#сервис', searchable: true, createdAt: now },
  ],
  checklists: [
    createChecklist('user-assistant', 'ASSISTANT', 1),
    createChecklist('user-senior-admin', 'SENIOR_ADMIN', 2),
    createChecklist('user-admin', 'ADMIN', 3),
  ],
  refunds: [
    { id: 'refund-1', clientName: 'Иванова Анна', requestedAt: '2026-05-11T12:00:00.000+03:00', amount: 15000, reason: 'Медицинские ограничения', status: 'IN_PROGRESS', comment: 'Нужно уточнить документы.', createdAt: now },
    { id: 'refund-2', clientName: 'Петрова Дарья', requestedAt: '2026-05-10T10:30:00.000+03:00', amount: 7500, reason: 'Смена графика', status: 'NEW', comment: 'Ожидает решения по переносу.', createdAt: now },
  ],
  financialPlans: [],
  calendarEvents: [],
  expenseCategories: [
    { id: 'expense-category-1', name: 'Аренда', createdAt: now },
    { id: 'expense-category-2', name: 'Маркетинг', createdAt: now },
    { id: 'expense-category-3', name: 'Хозяйственные расходы', createdAt: now },
  ],
  expenses: [],
  trainerEvaluations: [
    { id: 'trainer-evaluation-1', trainerName: 'Алина Старший Тренер', studio: 'STAVROPOLSKAYA', direction: 'Балет', score: 8.7, evaluatedAt: '2026-05-07', sheetUrl: 'https://docs.google.com/spreadsheets/', createdAt: now, createdById: 'user-owner' },
    { id: 'trainer-evaluation-2', trainerName: 'Мила Тренер', studio: 'MACHUGI', direction: 'Растяжка', score: 9.1, evaluatedAt: '2026-05-14', sheetUrl: 'https://docs.google.com/spreadsheets/', createdAt: now, createdById: 'user-assistant' },
    { id: 'trainer-evaluation-3', trainerName: 'Мила Тренер', studio: 'MACHUGI', direction: 'Балет', score: 8.4, evaluatedAt: '2026-05-21', sheetUrl: 'https://docs.google.com/spreadsheets/', createdAt: now, createdById: 'user-senior-trainer' },
  ],
  callChecklist: [
    'Поздороваться и назвать студию',
    'Уточнить цель клиента',
    'Предложить удобное время на пробное',
    'Подтвердить стоимость и условия',
    'Закрыть диалог следующим шагом',
  ],
  settings: {
    colorMode: 'dark',
    density: 'comfortable',
    animations: true,
    telegramReports: false,
  },
};
