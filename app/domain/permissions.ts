import type { KnowledgeCategory, Role, User } from './types';

export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'manage';

export type PermissionResource =
  | 'team'
  | 'assistantTasks'
  | 'knowledge'
  | 'responsibilities'
  | 'regulations'
  | 'importantInfo'
  | 'trainingMaterials'
  | 'messageTemplates'
  | 'documentTemplates'
  | 'workLinks'
  | 'usefulContacts'
  | 'adminChecklist'
  | 'trainerChecklist'
  | 'callChecklist'
  | 'refunds'
  | 'financialPlan'
  | 'expenses'
  | 'trainerEvaluationSheets'
  | 'trainerRating'
  | 'callRating'
  | 'settings'
  | 'audit'
  | 'controlCenter'
  | 'shiftJournal';

export interface PermissionContext {
  targetRole?: Role | null;
  ownerProtected?: boolean;
}

type PermissionSubject = Pick<User, 'role' | 'status'> | Role | null | undefined;

export const managedContentRoles: Role[] = ['ASSISTANT', 'ADMIN', 'SENIOR_ADMIN', 'TRAINER', 'SENIOR_TRAINER'];
export const assistantManagedTeamRoles: Role[] = ['SENIOR_ADMIN', 'ADMIN', 'SENIOR_TRAINER', 'TRAINER'];
export const adminRoles: Role[] = ['ADMIN', 'SENIOR_ADMIN'];
export const trainerRoles: Role[] = ['TRAINER', 'SENIOR_TRAINER'];
export type WorkLinkGroup = 'admins' | 'trainers';

export function workLinkRolesForGroup(group: WorkLinkGroup): Role[] {
  return group === 'admins' ? adminRoles : trainerRoles;
}

export function defaultWorkLinkGroupForRole(role: Role | null | undefined): WorkLinkGroup {
  return isTrainerRole(role) ? 'trainers' : 'admins';
}

const seniorAdminInheritedResources: PermissionResource[] = ['regulations', 'importantInfo', 'knowledge', 'messageTemplates', 'workLinks'];
const seniorTrainerInheritedResources: PermissionResource[] = ['regulations', 'importantInfo', 'knowledge', 'workLinks'];

export function roleOf(subject: PermissionSubject): Role | null {
  if (!subject) return null;
  return typeof subject === 'string' ? subject : subject.role;
}

function isBlocked(subject: PermissionSubject) {
  return typeof subject === 'object' && subject?.status === 'blocked';
}

function canWrite(subject: PermissionSubject) {
  return typeof subject !== 'object' || subject?.status !== 'read-only';
}

export function isAdminRole(role: Role | null | undefined) {
  return role === 'ADMIN' || role === 'SENIOR_ADMIN';
}

export function isTrainerRole(role: Role | null | undefined) {
  return role === 'TRAINER' || role === 'SENIOR_TRAINER';
}

export function visibleContentRolesFor(subject: PermissionSubject, resource?: PermissionResource): Role[] {
  const role = roleOf(subject);
  if (role === 'OWNER') return managedContentRoles;
  if (resource === 'messageTemplates' && isTrainerRole(role)) return [];
  if (resource === 'workLinks' && isAdminRole(role)) return adminRoles;
  if (resource === 'workLinks' && isTrainerRole(role)) return trainerRoles;
  if (role === 'SENIOR_ADMIN' && resource && seniorAdminInheritedResources.includes(resource)) return ['SENIOR_ADMIN', 'ADMIN'];
  if (role === 'SENIOR_TRAINER' && resource && seniorTrainerInheritedResources.includes(resource)) return ['SENIOR_TRAINER', 'TRAINER'];
  return role ? [role] : [];
}

export function manageableContentRolesFor(subject: PermissionSubject, resource: PermissionResource): Role[] {
  const role = roleOf(subject);
  if (!role || !canWrite(subject)) return [];
  if (role === 'OWNER') return managedContentRoles;
  if ((resource === 'messageTemplates' || resource === 'workLinks') && role === 'SENIOR_ADMIN') return ['SENIOR_ADMIN', 'ADMIN'];
  if (resource === 'workLinks' && role === 'SENIOR_TRAINER') return ['SENIOR_TRAINER', 'TRAINER'];
  if (resource === 'workLinks' && role === 'ASSISTANT') return [...adminRoles, ...trainerRoles];
  if (resource === 'messageTemplates' && role === 'ASSISTANT') return ['ASSISTANT'];
  if (resource === 'trainingMaterials' && role === 'ASSISTANT') return ['ASSISTANT'];
  return [];
}

export function knowledgeCategoryResource(category: KnowledgeCategory): PermissionResource {
  if (category === 'RESPONSIBILITY') return 'responsibilities';
  if (category === 'REGULATION') return 'regulations';
  if (category === 'IMPORTANT_INFO') return 'importantInfo';
  if (category === 'TRAINING') return 'trainingMaterials';
  return 'knowledge';
}

export function can(subject: PermissionSubject, action: PermissionAction, resource: PermissionResource, context: PermissionContext = {}) {
  const role = roleOf(subject);
  if (!role || isBlocked(subject)) return false;
  if (action !== 'view' && !canWrite(subject)) return false;

  if (role === 'OWNER') {
    if (resource === 'team' && action === 'delete' && context.ownerProtected) return false;
    return true;
  }

  if (action === 'view') {
    if (resource === 'settings') return true;
    if (resource === 'financialPlan' || resource === 'expenses') return role === 'ASSISTANT';
    if (resource === 'trainerEvaluationSheets') return role === 'ASSISTANT' || role === 'SENIOR_TRAINER';
    if (resource === 'trainerRating') return role === 'ASSISTANT' || isTrainerRole(role);
    if (resource === 'callRating') return role === 'ASSISTANT' || isAdminRole(role);
    if (resource === 'controlCenter' || resource === 'shiftJournal' || resource === 'audit') return role === 'ASSISTANT';
    if (resource === 'adminChecklist') return role === 'ASSISTANT' || isAdminRole(role);
    if (resource === 'trainerChecklist') return isTrainerRole(role);
    if (resource === 'refunds') return role === 'SENIOR_ADMIN';
    if (resource === 'team') return role === 'ASSISTANT';
    if (resource === 'documentTemplates' || resource === 'usefulContacts' || resource === 'assistantTasks') return role === 'ASSISTANT';
    if (resource === 'messageTemplates' && isTrainerRole(role)) return false;
    if (['knowledge', 'responsibilities', 'regulations', 'importantInfo', 'trainingMaterials', 'messageTemplates', 'workLinks'].includes(resource)) {
      return context.targetRole ? visibleContentRolesFor(role, resource).includes(context.targetRole) : true;
    }
    if (resource === 'callChecklist') return isAdminRole(role);
    return false;
  }

  if (resource === 'team') return role === 'ASSISTANT' && !!context.targetRole && assistantManagedTeamRoles.includes(context.targetRole);
  if (resource === 'assistantTasks') return role === 'ASSISTANT';
  if (resource === 'settings') return true;
  if (resource === 'financialPlan' || resource === 'expenses') return role === 'ASSISTANT';
  if (resource === 'trainerEvaluationSheets') return role === 'ASSISTANT' || role === 'SENIOR_TRAINER';
  if (resource === 'documentTemplates') return role === 'ASSISTANT' && action === 'create';
  if (resource === 'usefulContacts') return role === 'ASSISTANT';
  if (resource === 'trainingMaterials') return role === 'ASSISTANT' && (!context.targetRole || context.targetRole === 'ASSISTANT');
  if (resource === 'knowledge') return role === 'ASSISTANT' && action === 'create' && (!context.targetRole || context.targetRole === 'ASSISTANT');
  if (resource === 'importantInfo') return role === 'ASSISTANT' && action === 'create' && (!context.targetRole || context.targetRole === 'ASSISTANT');
  if (resource === 'messageTemplates' || resource === 'workLinks') {
    return !!context.targetRole && manageableContentRolesFor(role, resource).includes(context.targetRole);
  }
  if (resource === 'adminChecklist') return isAdminRole(role);
  if (resource === 'trainerChecklist') return role === 'SENIOR_TRAINER';
  if (resource === 'refunds') return role === 'SENIOR_ADMIN';
  return false;
}
