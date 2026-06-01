import { useMemo, useState } from 'react';
import { ExternalLink, Search, Star, X } from 'lucide-react';
import { useLibrary } from '../domain/LibraryContext';
import { formatDate, roleLabels } from '../domain/labels';
import { can, knowledgeCategoryResource, visibleContentRolesFor } from '../domain/permissions';
import type { FavoriteEntityType, Role } from '../domain/types';

type SearchResult = {
  entityType: FavoriteEntityType;
  entityId: string;
  kind: string;
  title: string;
  description: string;
  body?: string;
  role?: Role;
  url?: string;
  createdAt?: string;
};

const categoryLabels = {
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
  const [selected, setSelected] = useState<SearchResult | null>(null);

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
              <button type="button" className="global-search-open" onClick={() => setSelected(result)}>
                <span>{result.kind}</span>
                <strong>{result.title}</strong>
                <small>{result.description}</small>
              </button>
              <button
                type="button"
                className={favorite ? 'global-search-star is-active' : 'global-search-star'}
                onClick={() => toggleFavorite(result.entityType, result.entityId)}
                aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              >
                <Star className="h-4 w-4" fill={favorite ? 'currentColor' : 'none'} />
              </button>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <div className="app-modal" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#c9a98d]">{selected.kind}</p>
                <h2 className="mt-2 text-2xl text-[#f5f3f0]">{selected.title}</h2>
                <p className="mt-1 text-sm text-[#a89b8f]">{selected.description}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-[#a89b8f] hover:text-[#f5f3f0]" aria-label="Закрыть">
                <X className="h-5 w-5" />
              </button>
            </div>
            {selected.createdAt && <p className="mb-3 text-xs text-[#c9a98d]">{formatDate(selected.createdAt)}</p>}
            <p className="whitespace-pre-line text-sm leading-relaxed text-[#d8d1c8]">{selected.body}</p>
            {selected.url && (
              <a href={selected.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-[#c9a98d] hover:text-[#f5f3f0]">
                <ExternalLink className="h-4 w-4" />
                Открыть ссылку
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
