# Подготовка LEVTIA Library к Supabase

Этот проект уже подготовлен к переключению с локального SQLite на Supabase без поломки текущей разработки.

## Текущее состояние

- По умолчанию приложение работает как раньше: `LEVTIA_STORAGE_DRIVER=sqlite`.
- SQLite хранит основной снимок приложения в `data/levtia-library.sqlite`, таблица `app_state`.
- Supabase можно включить отдельно через `LEVTIA_STORAGE_DRIVER=supabase`.
- На первом этапе Supabase использует совместимый JSON-слой `public.app_state`, чтобы не переписывать весь фронт сразу.
- Для полноценного будущего перехода добавлена нормализованная схема таблиц: пользователи, задачи, шаблоны, ссылки, чек-листы, отчеты, расходы, календарь, листы оценивания и т.д.

## Что добавлено

- `supabase/migrations/0001_levtia_library_initial.sql` — базовая Supabase/Postgres схема.
- `server/api.mjs` — поддержка двух storage backend:
  - `sqlite`
  - `supabase`
- `scripts/push-state-to-supabase.mjs` — перенос текущего `app_state` из SQLite в Supabase.
- `.env.example` — переменные окружения Supabase.
- `npm run supabase:push-state` — команда миграции текущего состояния.

## Важная модель безопасности

Сейчас Supabase используется только сервером через `SUPABASE_SERVICE_ROLE_KEY`.

Не добавлять `SUPABASE_SERVICE_ROLE_KEY` во фронтенд, Vite env, браузер или публичный хостинг. Этот ключ должен жить только на backend/server runtime.

В SQL-миграции включен RLS для всех таблиц. Пока приложение ходит в Supabase через серверный service role, RLS не мешает работе. Перед прямым клиентским доступом из браузера нужно отдельно спроектировать Supabase Auth и политики доступа.

## Быстрый переход на Supabase app_state

1. Создать проект в Supabase.

2. Открыть SQL Editor и выполнить:

```sql
-- вставить содержимое:
-- supabase/migrations/0001_levtia_library_initial.sql
```

Либо через Supabase CLI:

```bash
supabase db push
```

3. Заполнить `.env`:

```env
LEVTIA_STORAGE_DRIVER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Google Calendar переменные оставить как сейчас.

4. Перенести текущее состояние из SQLite:

```bash
npm run supabase:push-state
```

Скрипт читает `data/levtia-library.sqlite` и пишет строку `id = main` в `public.app_state`.

Если SQLite лежит в другом месте:

```env
LEVTIA_SQLITE_PATH=C:\absolute\path\levtia-library.sqlite
```

5. Запустить приложение:

```bash
npm run dev
```

6. Проверить backend:

```bash
curl http://127.0.0.1:4174/api/health
```

Ожидаемо:

```json
{
  "ok": true,
  "storageDriver": "supabase",
  "dbPath": null
}
```

## Переходный режим

Переходный режим специально хранит весь `LibraryState` в `public.app_state.payload`.

Плюсы:

- можно быстро перевести текущее приложение на Supabase;
- не нужно переписывать все UI-действия сразу;
- можно откатиться на SQLite, вернув `LEVTIA_STORAGE_DRIVER=sqlite`.

Минусы:

- параллельные изменения разными пользователями все еще конфликтуют на уровне одного JSON-снимка;
- сложные запросы и фильтры не используют нормализованные таблицы;
- role-based безопасность пока остается в приложении, а не в SQL-политиках.

## Полноценный следующий этап

После проверки переходного режима переносить модули по одному:

1. Авторизация и сотрудники:
   - перевести пользователей в Supabase Auth;
   - заменить `legacy_password` на нормальную auth-модель;
   - связать `auth.users.id` с `public.users`.

2. Чек-листы:
   - `daily_checklists`
   - `checklist_items`
   - `checklist_reports`
   - отдельные запросы для контроля сегодняшних и прошлых чек-листов.

3. Контент по ролям:
   - `knowledge_entries`
   - `response_templates`
   - `helpful_links`
   - `document_templates`.

4. Финансы:
   - `financial_plan_months`
   - `financial_plan_rows`
   - `financial_plan_payments`
   - `expenses`
   - `expense_categories`.

5. Календарь:
   - `calendar_events`
   - Google sync поля уже заложены в схеме.

6. Тренерские оценки:
   - `trainer_evaluation_sheets`
   - графики можно строить SQL-запросом по месяцу, тренеру или студии.

## Индексы

В миграции добавлены индексы под текущие основные сценарии:

- фильтрация по роли и статусу;
- чек-листы по дате, роли и сотруднику;
- контент по роли и категории;
- календарь по дате;
- расходы по дате и студии;
- оценки тренеров по дате, студии и имени тренера.

## Что не сделано специально

- Не включен прямой Supabase client во фронтенд.
- Не внедрена Supabase Auth вместо текущего логина.
- Не переписан `LibraryContext` на таблицы по сущностям.
- Не добавлены production RLS policies для ролей, потому что текущая модель ролей пока не связана с `auth.uid()`.

Это осознанно: текущая задача — подготовить безопасный и обратимый переход, а не ломать работающую продуктовую логику.
