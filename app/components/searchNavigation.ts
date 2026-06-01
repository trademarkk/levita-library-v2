import type { BusinessModelScope, FavoriteEntityType, KnowledgeCategory, LinkCategory, Role } from '../domain/types';

export const SEARCH_NAVIGATION_EVENT = 'levtia:search-navigation';

export type SearchNavigationDetail = {
  entityType: FavoriteEntityType;
  entityId: string;
  tabId: string;
  role?: Role;
  category?: KnowledgeCategory;
  businessModel?: BusinessModelScope;
  linkCategory?: LinkCategory;
};

let pendingSearchTarget: SearchNavigationDetail | null = null;

export function tabForSearchTarget(input: {
  entityType: FavoriteEntityType;
  category?: KnowledgeCategory;
  linkCategory?: LinkCategory;
}) {
  if (input.entityType === 'template') return 'templates';
  if (input.entityType === 'documentTemplate') return 'document-templates';
  if (input.entityType === 'usefulContact') return 'contacts';
  if (input.entityType === 'link') return input.linkCategory === 'TRAINING' ? 'training' : 'links';

  if (input.category === 'RESPONSIBILITY') return 'responsibilities';
  if (input.category === 'REGULATION') return 'regulations';
  if (input.category === 'IMPORTANT_INFO') return 'info';
  if (input.category === 'TRAINING') return 'training';
  return 'knowledge';
}

export function searchTargetSelector(entityType: FavoriteEntityType, entityId: string) {
  return `[data-search-target="${CSS.escape(`${entityType}:${entityId}`)}"]`;
}

export function scrollToSearchTarget(entityType: FavoriteEntityType, entityId: string) {
  const element = document.querySelector<HTMLElement>(searchTargetSelector(entityType, entityId));
  if (!element) return false;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.classList.remove('search-target-highlight');
  window.setTimeout(() => element.classList.add('search-target-highlight'), 20);
  window.setTimeout(() => element.classList.remove('search-target-highlight'), 2400);
  return true;
}

export function requestSearchNavigation(detail: SearchNavigationDetail) {
  pendingSearchTarget = detail;
  window.dispatchEvent(new CustomEvent<SearchNavigationDetail>(SEARCH_NAVIGATION_EVENT, { detail }));

  const attempts = [120, 300, 700, 1200];
  for (const delay of attempts) {
    window.setTimeout(() => {
      if (pendingSearchTarget?.entityId === detail.entityId) {
        scrollToSearchTarget(detail.entityType, detail.entityId);
      }
    }, delay);
  }
}

export function getPendingSearchTarget() {
  return pendingSearchTarget;
}

export function clearPendingSearchTarget(detail: SearchNavigationDetail) {
  if (pendingSearchTarget?.entityType === detail.entityType && pendingSearchTarget.entityId === detail.entityId) {
    pendingSearchTarget = null;
  }
}

