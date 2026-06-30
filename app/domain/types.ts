export type Role = 'OWNER' | 'ASSISTANT' | 'SENIOR_ADMIN' | 'ADMIN' | 'SENIOR_TRAINER' | 'TRAINER';

export type KnowledgeCategory = 'REGULATION' | 'IMPORTANT_INFO' | 'RESPONSIBILITY' | 'TRAINING' | 'KNOWLEDGE';
export type LinkCategory = 'WORK_TABLE' | 'TRAINING' | 'HELPFUL';
export type RefundStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'DECLINED';
export type EmployeeStatus = 'active' | 'blocked' | 'read-only';
export type ChecklistReportSlot = '14:00' | '18:00' | '22:00';
export type Studio = 'STAVROPOLSKAYA' | 'MACHUGI';
export type BusinessModelScope = 'SUBSCRIPTION' | 'MEMBERSHIP' | 'ALL';
export type FavoriteEntityType = 'knowledge' | 'template' | 'link' | 'documentTemplate' | 'usefulContact';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  passwordHash?: string;
  role: Role;
  status: EmployeeStatus;
  joinDate: string;
  createdAt: string;
}

export type AuditAction =
  | 'auth.login'
  | 'auth.password_reset'
  | 'shift.start'
  | 'employee.create'
  | 'employee.update'
  | 'employee.delete'
  | 'checklist.item_toggle'
  | 'checklist.report_update'
  | 'content.create'
  | 'content.update'
  | 'content.delete'
  | 'content.favorite'
  | 'content.read'
  | 'finance.update';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  entityLabel: string;
  description?: string | null;
  actorId?: string | null;
  actorName: string;
  actorRole?: Role | null;
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
  createdAt: string;
}

export interface ResponseTemplate {
  id: string;
  title: string;
  body: string;
  role: Role;
  businessModel?: BusinessModelScope;
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
  regulationUrl?: string | null;
  role: Role;
  category: KnowledgeCategory;
  businessModel?: BusinessModelScope;
  hashtags?: string | null;
  isActual?: boolean;
  videoUrl?: string | null;
  attachments?: ContentAttachment[];
  searchable: boolean;
  createdAt: string;
}

export interface ContentAttachment {
  id: string;
  knowledgeEntryId: string;
  storagePath?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  createdAt: string;
  url: string;
}

export interface ContentFavorite {
  id: string;
  userId: string;
  entityType: FavoriteEntityType;
  entityId: string;
  createdAt: string;
}

export interface ContentReadReceipt {
  id: string;
  userId: string;
  entityType: 'knowledge';
  entityId: string;
  readAt: string;
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
  studio?: Studio;
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
  sentToMax?: boolean;
  maxSentAt?: string | null;
  maxSendError?: string | null;
  maxMessageId?: string | null;
}

export interface AdminShift {
  id: string;
  userId: string;
  adminName: string;
  studio: Studio;
  date: string;
  startedAt: string;
  closedAt?: string | null;
  remindersScheduledAt?: string | null;
  reminderScheduleError?: string | null;
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
  paidPayments: Record<string, boolean>;
}

export interface FinancialPlanMonth {
  month: string;
  rows: FinancialPlanRow[];
}

export interface UpcomingFinancialPayment {
  rowId: string;
  title: string;
  date: string;
  value: string;
}

export type ExpenseStudio = 'STAVROPOLSKAYA' | 'MACHUGI';
export type ExpenseAccount = 'RS_SBER' | 'TOCHKA' | 'CREDIT';

export interface TrainerEvaluationSheet {
  id: string;
  trainerName: string;
  studio: ExpenseStudio;
  direction: string;
  score: number;
  evaluatedAt: string;
  sheetUrl: string;
  createdAt: string;
  createdById?: string | null;
}

export type TrainerHiringStatus = 'active' | 'rejected';
export type TrainerCertificationResult = 'pending' | 'passed' | 'failed';

export interface TrainerHiringCandidate {
  id: string;
  fullName: string;
  status: TrainerHiringStatus;
  videoIntroApproved?: boolean | null;
  primaryDocumentsReceived: boolean;
  ndaSigned: boolean;
  ndaLink?: string | null;
  introZoomScheduled: boolean;
  introZoomDate?: string | null;
  introZoomTime?: string | null;
  secondCertificationPreparationZoomScheduled: boolean;
  secondCertificationPreparationZoomDate?: string | null;
  secondCertificationPreparationZoomTime?: string | null;
  secondCertificationScheduled: boolean;
  secondCertificationDate?: string | null;
  secondCertificationTime?: string | null;
  secondCertificationResult: TrainerCertificationResult;
  secondCertificationRetakeDate?: string | null;
  trainingsVisitedAfterSecondCertification: boolean;
  mediaCollected: boolean;
  thirdCertificationScheduled: boolean;
  thirdCertificationDate?: string | null;
  thirdCertificationTime?: string | null;
  thirdCertificationResult: TrainerCertificationResult;
  thirdCertificationPreparationZoomDate?: string | null;
  thirdCertificationPreparationZoomTime?: string | null;
  workingHoursAssigned: boolean;
  firstShiftDate?: string | null;
  createdAt: string;
  updatedAt: string;
  rejectedAt?: string | null;
  createdById?: string | null;
}

export interface CallReview {
  id: string;
  source: 'levita-calls';
  externalId: string;
  adminName: string;
  studio: ExpenseStudio;
  score: number;
  reviewedAt: string;
  amoCrmDealUrl?: string | null;
  callUrl?: string | null;
  originalFilename?: string | null;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  previousMonthCredit: boolean;
  comment?: string | null;
  createdAt: string;
}

export interface LibraryState {
  schemaVersion?: number;
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
  upcomingFinancialPayments: UpcomingFinancialPayment[];
  expenseCategories: ExpenseCategory[];
  expenses: ExpenseRecord[];
  trainerEvaluations: TrainerEvaluationSheet[];
  trainerHiringCandidates: TrainerHiringCandidate[];
  callReviews: CallReview[];
  favorites: ContentFavorite[];
  readReceipts: ContentReadReceipt[];
  callChecklist: string[];
  adminShifts: AdminShift[];
  auditLog: AuditEntry[];
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
  studio: Studio;
  completedAt?: string | null;
  telegramSent: boolean;
  telegramSentAt?: string | null;
  telegramOnTime: boolean;
  maxSent: boolean;
  maxSentAt?: string | null;
  maxOnTime: boolean;
  maxSendError?: string | null;
}
