# Prisma data flow

LEVTIA Library now treats Supabase Postgres as the source of truth.

## Runtime mode

Use:

```env
LEVTIA_STORAGE_DRIVER=supabase
LEVTIA_DATA_MODE=prisma
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@aws-1-eu-west-2.pooler.supabase.com:5432/postgres"
```

`DATABASE_URL` is used by the app runtime through the Supabase transaction pooler.
`DIRECT_URL` is reserved for migrations and direct schema work.

## Read model

`GET /api/state` aggregates normalized Postgres tables through Prisma and returns the current application state to the React client.

The client refreshes from the database:

- on app start;
- when dashboards call `refreshState`;
- after every mutation response.

## Write model

The client no longer writes a full state snapshot for normal actions.
Actions go through:

```http
POST /api/mutations
```

Each mutation writes one concrete entity or one concrete table group, then returns the freshly aggregated state.

Examples:

- `usefulContact.create` inserts one row into `useful_contacts`;
- `financial.cell.update` upserts/deletes rows in `financial_plan_payments`;
- `calendar.create` inserts one row into `calendar_events`;
- `expense.create` inserts one row into `expenses`;
- `checklist.report.update` upserts one report row in `checklist_reports`.

## UI feedback

The app exposes:

- `isDataLoading` for database reads;
- `isSaving` for database writes;
- `dataError` for failed read/write operations.

`DashboardLayout` shows a loader/status bar while data is loading or saving.

## Legacy

`/api/state PUT` is disabled in Prisma mode. This prevents accidental full-snapshot overwrites.
