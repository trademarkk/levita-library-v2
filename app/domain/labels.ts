import type { ChecklistReportSlot, EmployeeStatus, RefundStatus, Role } from './types';

export const roleLabels: Record<Role, string> = {
  OWNER: 'Руководитель',
  ASSISTANT: 'Ассистент',
  SENIOR_ADMIN: 'Старший администратор',
  ADMIN: 'Администратор',
  SENIOR_TRAINER: 'Старший тренер',
  TRAINER: 'Тренер',
};

export const roleRoutes: Record<Role, string> = {
  OWNER: '/owner',
  ASSISTANT: '/assistant',
  SENIOR_ADMIN: '/senior-admin',
  ADMIN: '/admin',
  SENIOR_TRAINER: '/senior-trainer',
  TRAINER: '/trainer',
};

export const refundStatusLabels: Record<RefundStatus, string> = {
  NEW: 'Новый',
  IN_PROGRESS: 'В работе',
  RESOLVED: 'Решен',
  DECLINED: 'Отклонен',
};

export const employeeStatusLabels: Record<EmployeeStatus, string> = {
  active: 'Активен',
  blocked: 'Заблокирован',
  'read-only': 'Только просмотр',
};

export const reportSlotLabels: Record<ChecklistReportSlot, string> = {
  '14:00': 'Отчет 14:00',
  '18:00': 'Отчет 18:00',
  '22:00': 'Отчет 22:00',
};

export function formatDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'дата не указана';

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatTime(value?: string | null) {
  if (!value) return 'не отмечено';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'не отмечено';

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function normalizeHashtags(value: string) {
  return value
    .split(/[\s,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
    .join(' ');
}
