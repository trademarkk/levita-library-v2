export type Role = 'OWNER' | 'ASSISTANT' | 'SENIOR_ADMIN' | 'ADMIN' | 'SENIOR_TRAINER' | 'TRAINER';

export type KnowledgeCategory = 'REGULATION' | 'IMPORTANT_INFO' | 'RESPONSIBILITY' | 'TRAINING' | 'KNOWLEDGE';
export type LinkCategory = 'WORK_TABLE' | 'TRAINING' | 'HELPFUL';
export type RefundStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'DECLINED';
export type EmployeeStatus = 'active' | 'blocked' | 'read-only';
export type ChecklistReportSlot = '14:00' | '18:00' | '22:00';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  status: EmployeeStatus;
  joinDate: string;
  createdAt: string;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  period: string;
  role: Role;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
  deadline?: string | null;
  addToCalendar?: boolean;
  calendarEventId?: string | null;
  createdAt: string;
}

export interface ResponseTemplate {
  id: string;
  title: string;
  body: string;
  role: Role;
  purpose?: string | null;
  createdById: string;
  createdAt: string;
}

export interface HelpfulLink {
  id: string;
  title: string;
  url: string;
  category: LinkCategory;
  role: Role;
  description?: string | null;
  createdAt: string;
}

export interface DocumentTemplate {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  createdById?: string | null;
}

export interface UsefulContact {
  id: string;
  name: string;
  phone: string;
  company: string;
  specialty: string;
  createdAt: string;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  role: Role;
  category: KnowledgeCategory;
  hashtags?: string | null;
  isActual?: boolean;
  searchable: boolean;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
}

export interface ChecklistReport {
  slot: ChecklistReportSlot;
  adminName: string;
  calls: string;
  reached: string;
  bookings: string;
  cash: string;
  came: string;
  bought: string;
  submittedAt?: string | null;
  sentToTelegram: boolean;
  telegramSentAt?: string | null;
}

export interface DailyChecklist {
  id: string;
  title: string;
  role: Role;
  assignedTo: string;
  date: string;
  createdAt: string;
  items: ChecklistItem[];
  reports: ChecklistReport[];
}

export interface RefundCase {
  id: string;
  clientName: string;
  requestedAt: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  comment?: string | null;
  createdAt: string;
}

export interface AppSettings {
  colorMode: 'dark' | 'light';
  density: 'comfortable' | 'compact';
  animations: boolean;
  telegramReports: boolean;
}

export interface FinancialPlanRow {
  id: string;
  title: string;
  payments: Record<string, string>;
}

export interface FinancialPlanMonth {
  month: string;
  rows: FinancialPlanRow[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  description?: string | null;
  sourceTaskId?: string | null;
  googleEventId?: string | null;
  googleHtmlLink?: string | null;
  googleSyncStatus?: 'pending' | 'synced' | 'error' | 'not_connected';
  googleSyncError?: string | null;
  source?: 'local' | 'google';
  createdAt: string;
}

export type ExpenseStudio = 'STAVROPOLSKAYA' | 'MACHUGI';
export type ExpenseAccount = 'RS_SBER' | 'TOCHKA' | 'CREDIT';

export interface ExpenseCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  date: string;
  amount: number;
  account: ExpenseAccount;
  category: string;
  studio: ExpenseStudio;
  comment?: string | null;
  createdAt: string;
}

export interface LibraryState {
  users: User[];
  tasks: TaskTemplate[];
  templates: ResponseTemplate[];
  links: HelpfulLink[];
  documentTemplates: DocumentTemplate[];
  usefulContacts: UsefulContact[];
  knowledge: KnowledgeEntry[];
  checklists: DailyChecklist[];
  refunds: RefundCase[];
  financialPlans: FinancialPlanMonth[];
  calendarEvents: CalendarEvent[];
  expenseCategories: ExpenseCategory[];
  expenses: ExpenseRecord[];
  callChecklist: string[];
  settings: AppSettings;
}

export interface OwnerChecklistReport {
  checklist: DailyChecklist;
  assignee: User;
  completedCount: number;
  report14: ChecklistControlStatus;
  report18: ChecklistControlStatus;
  report22: ChecklistControlStatus;
}

export interface ChecklistControlStatus {
  done: boolean;
  submitted: boolean;
  onTime: boolean;
  label: string;
  completedAt?: string | null;
  telegramSent: boolean;
  telegramSentAt?: string | null;
  telegramOnTime: boolean;
}
