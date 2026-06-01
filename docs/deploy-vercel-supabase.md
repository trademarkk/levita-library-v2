# Деплой LEVTIA Library на Vercel + Supabase

## Supabase

1. Создайте проект Supabase.
2. Примените SQL из папки `supabase/migrations` по порядку:
   - `0001_levtia_library_initial.sql`
   - `0002_add_max_report_delivery.sql`
   - `0003_add_checklist_report_studio.sql`
   - `0004_add_max_reminders_queue.sql`
   - `0005_limit_max_reminders_to_report_slots.sql`
   - `0006_add_tables_mode_entities.sql`
3. Скопируйте `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`.
4. Перед первым полноценным запуском перенесите текущее состояние:
   ```bash
   npm run supabase:push-state
   npm run supabase:migrate-tables
   ```

## Vercel

Добавьте переменные окружения:

```bash
LEVTIA_STORAGE_DRIVER=supabase
LEVTIA_DATA_MODE=tables
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
LEVTIA_APP_ORIGIN=https://your-domain.vercel.app

MAX_BOT_TOKEN=...
MAX_REPORT_CHAT_ID_STAVROPOLSKAYA=...
MAX_REPORT_CHAT_ID_MACHUGI=...
MAX_REQUEST_TIMEOUT_MS=12000
MAX_API_BASE=https://platform-api.max.ru

CRON_SECRET=generate-a-random-secret
MAX_REMINDER_RETENTION_DAYS=20
APP_STATE_BACKUP_RETENTION_DAYS=20
APP_STATE_BACKUP_MAX_ROWS=50

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/api/google/callback
GOOGLE_CALENDAR_ID=primary
GOOGLE_TIME_ZONE=Europe/Moscow
GOOGLE_INCLUDE_ALL_CALENDARS=true
GOOGLE_INCLUDE_TASKS=true
```

`vercel.json` уже содержит cron:

```json
{
  "path": "/api/jobs/max-reminders",
  "schedule": "* * * * *"
}
```

Если в Vercel задан `CRON_SECRET`, Vercel будет отправлять его в заголовке `Authorization: Bearer ...`, а endpoint будет отклонять чужие запросы.

## Google OAuth

В Google Cloud Console замените локальные адреса на продовые:

- Authorized JavaScript origins: `https://your-domain.vercel.app`
- Authorized redirect URIs: `https://your-domain.vercel.app/api/google/callback`

## MAX-напоминания

Когда администратор открывает смену, приложение создает записи в `max_reminders` на:

- 13:45 по Москве для отчета 14:00
- 17:45 по Москве для отчета 18:00

Cron endpoint каждую минуту забирает pending-напоминания из Supabase, отправляет их в MAX и помечает как `sent` или `failed`.
После каждого запуска cron также удаляет из `max_reminders` отправленные и ошибочные записи старше `MAX_REMINDER_RETENTION_DAYS` дней, чтобы бесплатный тариф Supabase не забивался служебной историей.
