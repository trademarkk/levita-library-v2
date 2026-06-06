import { useMemo, useState } from 'react';
import { Search, Star } from 'lucide-react';
import { useLibrary } from '../domain/LibraryContext';
import { roleLabels } from '../domain/labels';
import { can, knowledgeCategoryResource, visibleContentRolesFor } from '../domain/permissions';
import type { BusinessModelScope, FavoriteEntityType, KnowledgeCategory, LinkCategory, Role } from '../domain/types';
import { requestSearchNavigation, tabForSearchTarget } from './searchNavigation';

type SearchResult = {
  entityType: FavoriteEntityType;
  entityId: string;
  kind: string;
  title: string;
  description: string;
  body?: string;
  role?: Role;
  category?: KnowledgeCategory;
  businessModel?: BusinessModelScope;
  linkCategory?: LinkCategory;
  url?: string;
  createdAt?: string;
};

const categoryLabels: Record<KnowledgeCategory, string> = {
  RESPONSIBILITY: 'Обязанность',
  REGULATION: 'Регламент',
  IMPORTANT_INFO: 'Важная информация',
  TRAINING: 'Обучение',
  KNOWLEDGE: 'База знаний',
};

function normalized(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е');
}

function matches(result: SearchResult, query: string) {
  const haystack = normalized(`${result.title} ${result.description} ${result.body ?? ''} ${result.url ?? ''}`);
  return normalized(query).split(/\s+/).filter(Boolean).every((part) => haystack.includes(part));
}

export function GlobalSearch() {
  const { state, currentUser, isFavorite, toggleFavorite } = useLibrary();
  const [query, setQuery] = useState('');

  const results = useMemo<SearchResult[]>(() => {
    const role = currentUser?.role ?? 'OWNER';
    const visibleTemplateRoles = visibleContentRolesFor(role, 'messageTemplates');
    const visibleLinkRoles = visibleContentRolesFor(role, 'workLinks');
    const canSeeSharedAssistantTools = can(role, 'view', 'documentTemplates') && can(role, 'view', 'usefulContacts');

    return [
      ...state.knowledge
        .filter((entry) => entry.searchable !== false && visibleContentRolesFor(role, knowledgeCategoryResource(entry.category)).includes(entry.role))
        .map((entry) => ({
          entityType: 'knowledge' as const,
          entityId: entry.id,
          kind: categoryLabels[entry.category],
          title: entry.title,
          description: `${roleLabels[entry.role]}${entry.isActual === false ? ' · не актуально' : ''}`,
          body: entry.content,
          role: entry.role,
          category: entry.category,
          businessModel: entry.businessModel ?? 'ALL',
          createdAt: entry.createdAt,
        })),
      ...state.templates
        .filter((template) => visibleTemplateRoles.includes(template.role))
        .map((template) => ({
          entityType: 'template' as const,
          entityId: template.id,
          kind: 'Шаблон сообщения',
          title: template.title,
          description: `${roleLabels[template.role]}${template.purpose ? ` · ${template.purpose}` : ''}`,
          body: template.body,
          role: template.role,
          businessModel: template.businessModel ?? 'ALL',
          createdAt: template.createdAt,
        })),
      ...state.links
        .filter((link) => visibleLinkRoles.includes(link.role))
        .map((link) => ({
          entityType: 'link' as const,
          entityId: link.id,
          kind: link.category === 'WORK_TABLE' ? 'Рабочая ссылка' : link.category === 'TRAINING' ? 'Обучение' : 'Полезная ссылка',
          title: link.title,
          description: link.description ?? roleLabels[link.role],
          body: link.url,
          role: link.role,
          linkCategory: link.category,
          url: link.url,
          createdAt: link.createdAt,
        })),
      ...(canSeeSharedAssistantTools ? state.documentTemplates.map((template) => ({
        entityType: 'documentTemplate' as const,
        entityId: template.id,
        kind: 'Шаблон документа',
        title: template.title,
        description: 'Google Drive',
        body: template.url,
        url: template.url,
        createdAt: template.createdAt,
      })) : []),
      ...(canSeeSharedAssistantTools ? state.usefulContacts.map((contact) => ({
        entityType: 'usefulContact' as const,
        entityId: contact.id,
        kind: 'Полезный контакт',
        title: contact.name,
        description: `${contact.company} · ${contact.phone}`,
        body: contact.specialty,
        createdAt: contact.createdAt,
      })) : []),
    ];
  }, [currentUser?.role, state.documentTemplates, state.knowledge, state.links, state.templates, state.usefulContacts]);

  const trimmedQuery = query.trim();
  const visibleResults = trimmedQuery ? results.filter((result) => matches(result, trimmedQuery)).slice(0, 8) : [];

  return (
    <div className="global-search">
      <label className="global-search-input">
        <Search className="h-4 w-4" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по базе, регламентам, ссылкам" />
      </label>

      <div className="global-search-results">
        <p className="global-search-caption">{trimmedQuery ? 'Результаты поиска' : 'Поиск по материалам'}</p>
        {visibleResults.length === 0 && <p className="global-search-empty">{trimmedQuery ? 'Ничего не найдено' : 'Введите запрос, чтобы найти материал'}</p>}
        {visibleResults.map((result) => {
          const favorite = isFavorite(result.entityType, result.entityId);
          return (
            <div className="global-search-row" key={`${result.entityType}:${result.entityId}`}>
              <button
                type="button"
                className="global-search-open"
                onClick={() => {
                  requestSearchNavigation({
                    entityType: result.entityType,
                    entityId: result.entityId,
                    role: result.role,
                    category: result.category,
                    businessModel: result.businessModel,
                    linkCategory: result.linkCategory,
                    tabId: tabForSearchTarget(result),
                  });
                  setQuery('');
                }}
              >
                <span>{result.kind}</span>
                <strong>{result.title}</strong>
                <small>{result.description}</small>
              </button>
              <button
                type="button"
                data-allow-while-saving="true"
                className={favorite ? 'global-search-star is-active' : 'global-search-star'}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleFavorite(result.entityType, result.entityId);
                }}
                aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              >
                <Star className="h-4 w-4" fill={favorite ? 'currentColor' : 'none'} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
