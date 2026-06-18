import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, Edit2, FileText, Info, Link as LinkIcon, Plus, Save, Shield, Star, Trash2, X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { TabNavigation } from './TabNavigation';
import { useLibrary } from '../domain/LibraryContext';
import { formatDate, roleLabels } from '../domain/labels';
import { defaultWorkLinkGroupForRole, knowledgeCategoryResource, manageableContentRolesFor, managedContentRoles, visibleContentRolesFor, workLinkGroupForRole, workLinkRolesForGroup, type WorkLinkGroup } from '../domain/permissions';
import type { BusinessModelScope, FavoriteEntityType, HelpfulLink, KnowledgeCategory, KnowledgeEntry, LinkCategory, Role } from '../domain/types';
import { getPendingSearchTarget, SEARCH_NAVIGATION_EVENT, type SearchNavigationDetail } from './searchNavigation';

export const managedRoles = managedContentRoles;
const messageTemplateManagedRoles = managedContentRoles.filter((role) => role !== 'TRAINER' && role !== 'SENIOR_TRAINER');
const workLinkGroupTabs: Array<{ id: WorkLinkGroup; label: string }> = [
  { id: 'admins', label: 'Администраторы' },
  { id: 'trainers', label: 'Тренеры' },
  { id: 'assistants', label: 'Ассистент' },
];

const roleContentLabels: Record<Role, string> = {
  OWNER: 'руководителя',
  ASSISTANT: 'ассистента',
  ADMIN: 'администратора',
  SENIOR_ADMIN: 'старшего администратора',
  TRAINER: 'тренера',
  SENIOR_TRAINER: 'старшего тренера',
};

const categoryLabels: Record<KnowledgeCategory, string> = {
  RESPONSIBILITY: 'Обязанности',
  REGULATION: 'Регламенты',
  IMPORTANT_INFO: 'Важная информация',
  TRAINING: 'Обучение',
  KNOWLEDGE: 'База знаний',
};

const categoryEmpty: Record<KnowledgeCategory, string> = {
  RESPONSIBILITY: 'Для этой роли пока нет обязанностей.',
  REGULATION: 'Для этой роли пока нет регламентов.',
  IMPORTANT_INFO: 'Для этой роли пока нет важной информации.',
  TRAINING: 'Для этой роли пока нет материалов обучения.',
  KNOWLEDGE: 'Для этой роли пока нет материалов базы знаний.',
};

function tabsFor(category: KnowledgeCategory) {
  return managedRoles.map((role) => {
    const label = category === 'RESPONSIBILITY'
      ? `Обязанности ${roleContentLabels[role]}`
      : category === 'REGULATION'
        ? `Регламенты для ${roleContentLabels[role]}`
        : category === 'IMPORTANT_INFO'
          ? `Информация для ${roleContentLabels[role]}`
          : category === 'TRAINING'
            ? `Обучение для ${roleContentLabels[role]}`
            : `База знаний для ${roleContentLabels[role]}`;
    return { id: role, label };
  });
}

function roleTabs(label: string) {
  return managedRoles.map((role) => ({ id: role, label: `${label} ${roleContentLabels[role]}` }));
}

function roleTabsForRoles(label: string, roles: Role[]) {
  return roles.map((role) => ({ id: role, label: `${label} ${roleContentLabels[role]}` }));
}

const businessModelLabels: Record<BusinessModelScope, string> = {
  SUBSCRIPTION: 'Подписки',
  MEMBERSHIP: 'Абонементы',
  ALL: 'Для всех',
};

const businessModelHelp: Record<BusinessModelScope, string> = {
  SUBSCRIPTION: 'Подписная модель',
  MEMBERSHIP: 'Абонементная модель',
  ALL: 'Подходит обеим моделям',
};

const businessModelOptions: BusinessModelScope[] = ['SUBSCRIPTION', 'MEMBERSHIP', 'ALL'];

function supportsBusinessModel(category: KnowledgeCategory) {
  return category === 'REGULATION' || category === 'IMPORTANT_INFO' || category === 'KNOWLEDGE';
}

function businessModelMatches(value: BusinessModelScope | undefined, filter: BusinessModelScope) {
  const scope = value ?? 'ALL';
  if (filter === 'ALL') return scope === 'ALL';
  return scope === filter || scope === 'ALL';
}

function normalizeHashtag(value: string) {
  return value.trim().replace(/^#+/, '').toLowerCase();
}

function hashtagsMatch(hashtags: string | null | undefined, query: string) {
  const normalizedQuery = normalizeHashtag(query);
  if (!normalizedQuery) return true;
  return (hashtags ?? '')
    .split(/[\s,;]+/)
    .map((tag) => normalizeHashtag(tag))
    .filter(Boolean)
    .some((tag) => tag.includes(normalizedQuery));
}

function searchTarget(entityType: FavoriteEntityType, entityId: string) {
  return `${entityType}:${entityId}`;
}

function BusinessModelBadge({ value }: { value?: BusinessModelScope }) {
  const scope = value ?? 'ALL';
  const tone = scope === 'SUBSCRIPTION'
    ? 'border-[#6f9cc7]/35 bg-[#456785]/24 text-[#c8def1]'
    : scope === 'MEMBERSHIP'
      ? 'border-[#c9a98d]/35 bg-[#c9a98d]/16 text-[#dec8b6]'
      : 'border-[#7a8a70]/35 bg-[#5e6d58]/28 text-[#d8e0d2]';
  return (
    <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs ${tone}`}>
      {businessModelLabels[scope]}
    </span>
  );
}

function BusinessModelSelect({ value, onChange }: { value: BusinessModelScope; onChange: (value: BusinessModelScope) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as BusinessModelScope)} className="field">
      {businessModelOptions.map((option) => (
        <option key={option} value={option}>{businessModelLabels[option]} - {businessModelHelp[option]}</option>
      ))}
    </select>
  );
}

function BusinessModelFilter({ value, onChange }: { value: BusinessModelScope; onChange: (value: BusinessModelScope) => void }) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {businessModelOptions.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${active ? 'border-[#c9a98d] bg-[#c9a98d]/24 text-[#f5f3f0]' : 'border-[#c9a98d]/15 text-[#a89b8f] hover:bg-[#2a2630]'}`}
          >
            {businessModelLabels[option]}
          </button>
        );
      })}
    </div>
  );
}

function FavoriteButton({
  entityType,
  entityId,
  label,
  inactiveTitle = 'Добавить в избранное',
  activeTitle = 'Убрать из избранного',
}: {
  entityType: FavoriteEntityType;
  entityId: string;
  label: string;
  inactiveTitle?: string;
  activeTitle?: string;
}) {
  const { isFavorite, toggleFavorite } = useLibrary();
  const favorite = isFavorite(entityType, entityId);
  const [optimisticFavorite, setOptimisticFavorite] = useState(favorite);
  const pointerHandledRef = useRef(false);
  useEffect(() => {
    setOptimisticFavorite(favorite);
  }, [entityId, entityType, favorite]);

  const activate = () => {
    setOptimisticFavorite((current) => !current);
    toggleFavorite(entityType, entityId);
  };

  return (
    <button
      type="button"
      data-allow-while-saving="true"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        pointerHandledRef.current = true;
        activate();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (pointerHandledRef.current) {
          pointerHandledRef.current = false;
          return;
        }
        activate();
      }}
      className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors ${optimisticFavorite ? 'border-[#c9a98d]/50 bg-[#c9a98d]/22 text-[#c9a98d]' : 'border-[#c9a98d]/15 text-[#a89b8f] hover:border-[#c9a98d]/35 hover:text-[#c9a98d]'}`}
      aria-label={optimisticFavorite ? `${activeTitle}: ${label}` : `${inactiveTitle}: ${label}`}
      title={optimisticFavorite ? activeTitle : inactiveTitle}
    >
      <Star className="h-4 w-4" fill={optimisticFavorite ? 'currentColor' : 'none'} />
    </button>
  );
}

type FavoriteScopeFilterValue = 'all' | 'favorites';
type LinkPinFilterValue = 'all' | 'pinned';

function FavoriteScopeFilter({
  value,
  onChange,
  favoriteCount,
}: {
  value: FavoriteScopeFilterValue;
  onChange: (value: FavoriteScopeFilterValue) => void;
  favoriteCount: number;
}) {
  const options: { value: FavoriteScopeFilterValue; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'favorites', label: favoriteCount > 0 ? `Избранное (${favoriteCount})` : 'Избранное' },
  ];

  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${active ? 'border-[#c9a98d] bg-[#c9a98d]/24 text-[#f5f3f0]' : 'border-[#c9a98d]/15 text-[#a89b8f] hover:bg-[#2a2630]'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function WorkLinkGroupFilter({ value, onChange }: { value: WorkLinkGroup; onChange: (value: WorkLinkGroup) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {workLinkGroupTabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${active ? 'border-[#c9a98d] bg-[#c9a98d]/24 text-[#f5f3f0]' : 'border-[#c9a98d]/15 text-[#a89b8f] hover:bg-[#2a2630]'}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function LinkPinFilter({ value, onChange, pinnedCount }: { value: LinkPinFilterValue; onChange: (value: LinkPinFilterValue) => void; pinnedCount: number }) {
  const options: { value: LinkPinFilterValue; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'pinned', label: pinnedCount > 0 ? `Закрепленные (${pinnedCount})` : 'Закрепленные' },
  ];

  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${active ? 'border-[#c9a98d] bg-[#c9a98d]/24 text-[#f5f3f0]' : 'border-[#c9a98d]/15 text-[#a89b8f] hover:bg-[#2a2630]'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function LinkPinnedButton({ link, pinned }: { link: HelpfulLink; pinned: boolean }) {
  const { setLinkPinned } = useLibrary();
  const [optimisticPinned, setOptimisticPinned] = useState(pinned);
  const pointerHandledRef = useRef(false);

  useEffect(() => {
    setOptimisticPinned(pinned);
  }, [link.id, pinned]);

  const activate = () => {
    const nextPinned = !optimisticPinned;
    setOptimisticPinned(nextPinned);
    setLinkPinned(link.id, nextPinned);
  };

  return (
    <button
      type="button"
      data-allow-while-saving="true"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        pointerHandledRef.current = true;
        activate();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (pointerHandledRef.current) {
          pointerHandledRef.current = false;
          return;
        }
        activate();
      }}
      className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors ${optimisticPinned ? 'border-[#c9a98d]/50 bg-[#c9a98d]/22 text-[#c9a98d]' : 'border-[#c9a98d]/15 text-[#a89b8f] hover:border-[#c9a98d]/35 hover:text-[#c9a98d]'}`}
      aria-label={optimisticPinned ? `Открепить: ${link.title}` : `Закрепить: ${link.title}`}
      title={optimisticPinned ? 'Открепить' : 'Закрепить'}
    >
      <Star className="h-4 w-4" fill={optimisticPinned ? 'currentColor' : 'none'} />
    </button>
  );
}

function LinkPinnedIndicator({ link, pinned }: { link: HelpfulLink; pinned: boolean }) {
  if (!pinned) return null;
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#c9a98d]/50 bg-[#c9a98d]/22 text-[#c9a98d]"
      aria-label={`Закреплено: ${link.title}`}
      title="Закреплено"
    >
      <Star className="h-4 w-4" fill="currentColor" />
    </span>
  );
}

function scrollToEntity(entityType: FavoriteEntityType, entityId: string) {
  const target = searchTarget(entityType, entityId);
  requestAnimationFrame(() => {
    document.querySelector(`[data-search-target="${target}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function PinnedLinkTabs({ links, pinnedLinkIds }: { links: HelpfulLink[]; pinnedLinkIds: Set<string> }) {
  const pinnedLinks = links.filter((link) => pinnedLinkIds.has(link.id));
  if (!pinnedLinks.length) return null;

  return (
    <div className="mb-5 rounded-2xl border border-[#c9a98d]/18 bg-[#1a151d]/70 p-3">
      <p className="mb-3 text-xs uppercase tracking-[0.24em] text-[#c9a98d]">Закрепленные</p>
      <div className="flex flex-wrap gap-2">
        {pinnedLinks.map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={() => scrollToEntity('link', link.id)}
            className="rounded-full border border-[#c9a98d]/28 bg-[#c9a98d]/12 px-4 py-2 text-sm text-[#f5f3f0] transition-colors hover:bg-[#c9a98d]/22"
          >
            {link.title}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RoleContentViewer({ role, category }: { role: Role; category: KnowledgeCategory }) {
  const { state, currentUser, isFavorite, markKnowledgeAsRead, knowledgeReadReceipt } = useLibrary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [businessModelFilter, setBusinessModelFilter] = useState<BusinessModelScope>('ALL');
  const [favoriteFilter, setFavoriteFilter] = useState<FavoriteScopeFilterValue>('all');
  const [hashtagFilter, setHashtagFilter] = useState('');
  const hasBusinessModelFilter = supportsBusinessModel(category);
  const hasHashtagFilter = category === 'KNOWLEDGE';
  const visibleRoles = visibleContentRolesFor(role, knowledgeCategoryResource(category));
  const baseEntries = state.knowledge.filter((entry) => (
    visibleRoles.includes(entry.role)
    && entry.category === category
    && (!hasBusinessModelFilter || businessModelMatches(entry.businessModel, businessModelFilter))
  ));
  const hashtagEntries = hasHashtagFilter ? baseEntries.filter((entry) => hashtagsMatch(entry.hashtags, hashtagFilter)) : baseEntries;
  const favoriteCount = hashtagEntries.filter((entry) => isFavorite('knowledge', entry.id)).length;
  const entries = favoriteFilter === 'favorites' ? hashtagEntries.filter((entry) => isFavorite('knowledge', entry.id)) : hashtagEntries;
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const visibleRoleKey = visibleRoles.join('|');

  useEffect(() => {
    const applyTarget = (detail: SearchNavigationDetail | null) => {
      if (!detail || detail.entityType !== 'knowledge' || detail.category !== category) return;
      if (detail.role && !visibleRoles.includes(detail.role)) return;
      setFavoriteFilter('all');
      setSelectedId(null);
      if (hasBusinessModelFilter) setBusinessModelFilter(detail.businessModel ?? 'ALL');
    };

    applyTarget(getPendingSearchTarget());
    const handler = (event: Event) => applyTarget((event as CustomEvent<SearchNavigationDetail>).detail);
    window.addEventListener(SEARCH_NAVIGATION_EVENT, handler);
    return () => window.removeEventListener(SEARCH_NAVIGATION_EVENT, handler);
  }, [category, hasBusinessModelFilter, visibleRoleKey]);

  if (selected && (category === 'REGULATION' || category === 'KNOWLEDGE')) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedId(null)} className="px-4 py-2 rounded-lg border border-[#c9a98d]/20 text-[#f5f3f0] hover:bg-[#2a2630]">
          Назад к списку
        </button>
        <GlassCard>
          <p className="text-xs text-[#c9a98d] mb-2">{categoryLabels[category]}</p>
          <h2 className="text-2xl text-[#f5f3f0] mb-4">{selected.title}</h2>
          <div className="mb-4"><BusinessModelBadge value={selected.businessModel} /></div>
          <p className="text-[#a89b8f] leading-relaxed whitespace-pre-line">{selected.content}</p>
          {selected.hashtags && <p className="mt-4 text-xs text-[#c9a98d]">{selected.hashtags}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <FavoriteButton entityType="knowledge" entityId={selected.id} label={selected.title} />
            {category === 'IMPORTANT_INFO' && currentUser && (
              <button
                type="button"
                onClick={() => markKnowledgeAsRead(selected.id)}
                className="rounded-lg border border-[#c9a98d]/20 px-4 py-2 text-[#f5f3f0] hover:bg-[#2a2630]"
              >
                {knowledgeReadReceipt(selected.id) ? 'Ознакомление подтверждено' : 'Я ознакомлен'}
              </button>
            )}
          </div>
        </GlassCard>
      </div>
    );
  }

  if (category === 'RESPONSIBILITY') {
    return (
      <div>
        <FavoriteScopeFilter value={favoriteFilter} onChange={setFavoriteFilter} favoriteCount={favoriteCount} />
        <GlassCard>
          <h2 className="text-2xl text-[#f5f3f0] mb-5">Обязанности</h2>
          {entries.length === 0 && <p className="text-[#a89b8f]">{favoriteFilter === 'favorites' ? 'В избранном пока нет материалов этой вкладки.' : categoryEmpty[category]}</p>}
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} data-search-target={searchTarget('knowledge', entry.id)} className="flex items-start gap-3 rounded-lg bg-[#2a2630]/55 p-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#c9a98d]" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[#f5f3f0]">{entry.title}</h3>
                  {entry.content && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#a89b8f]">{entry.content}</p>}
                </div>
                <FavoriteButton entityType="knowledge" entityId={entry.id} label={entry.title} />
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    );
  }

  return (
    <>
    <FavoriteScopeFilter value={favoriteFilter} onChange={(value) => { setFavoriteFilter(value); setSelectedId(null); }} favoriteCount={favoriteCount} />
    {hasBusinessModelFilter && <BusinessModelFilter value={businessModelFilter} onChange={(value) => { setBusinessModelFilter(value); setSelectedId(null); }} />}
    {hasHashtagFilter && (
      <div className="mb-5 grid gap-2 md:max-w-md">
        <label htmlFor={`${category}-hashtag-filter`} className="text-sm text-[#a89b8f]">Поиск по хештегу</label>
        <input
          id={`${category}-hashtag-filter`}
          value={hashtagFilter}
          onChange={(event) => {
            setHashtagFilter(event.target.value);
            setSelectedId(null);
          }}
          className="field"
          placeholder="#продажи или продажи"
        />
      </div>
    )}
    <div className="grid md:grid-cols-2 gap-5">
      {entries.length === 0 && <GlassCard><p className="text-[#a89b8f]">{hasHashtagFilter && hashtagFilter.trim() ? 'Материалов с таким хештегом нет.' : favoriteFilter === 'favorites' ? 'В избранном пока нет материалов этой вкладки.' : categoryEmpty[category]}</p></GlassCard>}
      {entries.map((entry, index) => (
        <GlassCard key={entry.id} delay={index * 0.05} data-search-target={searchTarget('knowledge', entry.id)}>
          <div className="flex items-start gap-3 mb-3">
            {category === 'REGULATION' ? <Shield className="w-5 h-5 text-[#c9a98d] mt-1" /> : category === 'KNOWLEDGE' ? <BookOpen className="w-5 h-5 text-[#c9a98d] mt-1" /> : <Info className="w-5 h-5 text-[#c9a98d] mt-1" />}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl text-[#f5f3f0]">{entry.title}</h3>
                <FavoriteButton entityType="knowledge" entityId={entry.id} label={entry.title} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <BusinessModelBadge value={entry.businessModel} />
                {visibleRoles.length > 1 && <span className="rounded-full border border-[#c9a98d]/20 px-2.5 py-1 text-xs text-[#a89b8f]">{roleLabels[entry.role]}</span>}
              </div>
              {category === 'IMPORTANT_INFO' && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[#c9a98d]/15 px-2 py-1 text-[#c9a98d]">{formatDate(entry.createdAt)}</span>
                  <span className={`rounded-full px-2 py-1 ${entry.isActual === false ? 'bg-[#8b3a52]/25 text-[#f0c5cf]' : 'bg-[#5e6d58]/30 text-[#d8e0d2]'}`}>
                    {entry.isActual === false ? 'не актуально' : 'актуально'}
                  </span>
                  {knowledgeReadReceipt(entry.id) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#5e6d58]/30 px-2 py-1 text-[#d8e0d2]">
                      <CheckCircle2 className="h-3 w-3" />
                      ознакомлен
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-[#a89b8f] leading-relaxed whitespace-pre-line">{entry.content}</p>
          {entry.hashtags && <p className="mt-4 text-xs text-[#c9a98d]">{entry.hashtags}</p>}
          {category === 'IMPORTANT_INFO' && currentUser && (
            <button onClick={() => markKnowledgeAsRead(entry.id)} className="mt-4 px-4 py-2 rounded-lg border border-[#c9a98d]/20 text-[#f5f3f0] hover:bg-[#2a2630]">
              {knowledgeReadReceipt(entry.id) ? 'Обновить отметку ознакомления' : 'Я ознакомлен'}
            </button>
          )}
          {(category === 'REGULATION' || category === 'KNOWLEDGE') && (
            <button onClick={() => setSelectedId(entry.id)} className="mt-4 px-4 py-2 rounded-lg bg-[#c9a98d]/20 text-[#c9a98d] hover:bg-[#c9a98d]/30">
              Открыть
            </button>
          )}
        </GlassCard>
      ))}
    </div>
    </>
  );
}

export function RoleTemplatesViewer({ role }: { role: Role }) {
  const { state, isFavorite } = useLibrary();
  const [businessModelFilter, setBusinessModelFilter] = useState<BusinessModelScope>('ALL');
  const [favoriteFilter, setFavoriteFilter] = useState<FavoriteScopeFilterValue>('all');
  const visibleRoles = visibleContentRolesFor(role, 'messageTemplates');
  const baseTemplates = state.templates.filter((template) => visibleRoles.includes(template.role) && businessModelMatches(template.businessModel, businessModelFilter));
  const favoriteCount = baseTemplates.filter((template) => isFavorite('template', template.id)).length;
  const templates = favoriteFilter === 'favorites' ? baseTemplates.filter((template) => isFavorite('template', template.id)) : baseTemplates;
  const visibleRoleKey = visibleRoles.join('|');

  useEffect(() => {
    const applyTarget = (detail: SearchNavigationDetail | null) => {
      if (!detail || detail.entityType !== 'template') return;
      if (detail.role && !visibleRoles.includes(detail.role)) return;
      setFavoriteFilter('all');
      setBusinessModelFilter(detail.businessModel ?? 'ALL');
    };

    applyTarget(getPendingSearchTarget());
    const handler = (event: Event) => applyTarget((event as CustomEvent<SearchNavigationDetail>).detail);
    window.addEventListener(SEARCH_NAVIGATION_EVENT, handler);
    return () => window.removeEventListener(SEARCH_NAVIGATION_EVENT, handler);
  }, [visibleRoleKey]);

  return (
    <div className="space-y-4">
      <FavoriteScopeFilter value={favoriteFilter} onChange={setFavoriteFilter} favoriteCount={favoriteCount} />
      <BusinessModelFilter value={businessModelFilter} onChange={setBusinessModelFilter} />
      {templates.length === 0 && <GlassCard><p className="text-[#a89b8f]">{favoriteFilter === 'favorites' ? 'В избранном пока нет шаблонов этой вкладки.' : 'Для этой роли пока нет шаблонов сообщений.'}</p></GlassCard>}
      {templates.map((template, index) => (
        <GlassCard key={template.id} delay={index * 0.05} data-search-target={searchTarget('template', template.id)}>
          <div className="flex gap-3">
            <FileText className="w-5 h-5 text-[#c9a98d] mt-1" />
            <div>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg text-[#f5f3f0]">{template.title}</h3>
                <FavoriteButton entityType="template" entityId={template.id} label={template.title} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <BusinessModelBadge value={template.businessModel} />
                {visibleRoles.length > 1 && <span className="rounded-full border border-[#c9a98d]/20 px-2.5 py-1 text-xs text-[#a89b8f]">{roleLabels[template.role]}</span>}
                <p className="text-xs text-[#c9a98d]">{template.purpose}</p>
              </div>
              <p className="text-sm text-[#a89b8f] mt-3 whitespace-pre-line">{template.body}</p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

export function RoleLinksViewer({ role }: { role: Role }) {
  const { state } = useLibrary();
  const [pinFilter, setPinFilter] = useState<LinkPinFilterValue>('all');
  const canChooseGroup = role === 'OWNER' || role === 'ASSISTANT';
  const [workLinkGroup, setWorkLinkGroup] = useState<WorkLinkGroup>(defaultWorkLinkGroupForRole(role));
  const visibleRoles = canChooseGroup ? workLinkRolesForGroup(workLinkGroup) : visibleContentRolesFor(role, 'workLinks');
  const pinnedLinkIds = useMemo(() => new Set(state.favorites.filter((favorite) => favorite.entityType === 'link').map((favorite) => favorite.entityId)), [state.favorites]);
  const baseLinks = state.links.filter((link) => visibleRoles.includes(link.role));
  const pinnedCount = baseLinks.filter((link) => pinnedLinkIds.has(link.id)).length;
  const links = pinFilter === 'pinned' ? baseLinks.filter((link) => pinnedLinkIds.has(link.id)) : baseLinks;
  const visibleRoleKey = `${workLinkGroup}:${visibleRoles.join('|')}`;

  useEffect(() => {
    const applyTarget = (detail: SearchNavigationDetail | null) => {
      if (!detail || detail.entityType !== 'link') return;
      if (detail.role && canChooseGroup) {
        setWorkLinkGroup(workLinkGroupForRole(detail.role));
      } else if (detail.role && !visibleRoles.includes(detail.role)) {
        return;
      }
      setPinFilter('all');
    };

    applyTarget(getPendingSearchTarget());
    const handler = (event: Event) => applyTarget((event as CustomEvent<SearchNavigationDetail>).detail);
    window.addEventListener(SEARCH_NAVIGATION_EVENT, handler);
    return () => window.removeEventListener(SEARCH_NAVIGATION_EVENT, handler);
  }, [canChooseGroup, visibleRoleKey]);

  return (
    <div>
      {canChooseGroup && <WorkLinkGroupFilter value={workLinkGroup} onChange={(group) => { setWorkLinkGroup(group); setPinFilter('all'); }} />}
      <LinkPinFilter value={pinFilter} onChange={setPinFilter} pinnedCount={pinnedCount} />
      <PinnedLinkTabs links={baseLinks} pinnedLinkIds={pinnedLinkIds} />
      <div className="grid md:grid-cols-2 gap-4">
        {links.length === 0 && <GlassCard><p className="text-[#a89b8f]">{pinFilter === 'pinned' ? 'В закрепленных пока нет ссылок этой вкладки.' : 'Для этой роли пока нет рабочих ссылок.'}</p></GlassCard>}
        {links.map((link, index) => (
          <GlassCard key={link.id} delay={index * 0.05} data-search-target={searchTarget('link', link.id)}>
            <div className="flex gap-3">
              <LinkIcon className="w-5 h-5 text-[#c9a98d] mt-1" />
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[#f5f3f0]">{link.title}</h3>
                  <LinkPinnedIndicator link={link} pinned={pinnedLinkIds.has(link.id)} />
                </div>
                {visibleRoles.length > 1 && <p className="mt-1 text-xs text-[#c9a98d]">{roleLabels[link.role]}</p>}
                <a href={link.url} className="text-sm text-[#a89b8f] hover:text-[#c9a98d] break-all">{link.url}</a>
                <p className="text-sm text-[#a89b8f] mt-2">{link.description}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

export function RoleTemplatesManager({ role }: { role: Role }) {
  const { state, createTemplate, updateTemplate, deleteTemplate } = useLibrary();
  const manageableRoles = manageableContentRolesFor(role, 'messageTemplates');
  const [activeRole, setActiveRole] = useState<Role>(manageableRoles[0] ?? role);
  const [businessModelFilter, setBusinessModelFilter] = useState<BusinessModelScope>('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', purpose: '', body: '', businessModel: 'ALL' as BusinessModelScope });
  const [error, setError] = useState<string | null>(null);
  const templates = state.templates.filter((template) => manageableRoles.includes(template.role) && businessModelMatches(template.businessModel, businessModelFilter));
  const manageableRoleKey = manageableRoles.join('|');

  useEffect(() => {
    const applyTarget = (detail: SearchNavigationDetail | null) => {
      if (!detail || detail.entityType !== 'template' || !detail.role || !manageableRoles.includes(detail.role)) return;
      setActiveRole(detail.role);
      setBusinessModelFilter(detail.businessModel ?? 'ALL');
    };

    applyTarget(getPendingSearchTarget());
    const handler = (event: Event) => applyTarget((event as CustomEvent<SearchNavigationDetail>).detail);
    window.addEventListener(SEARCH_NAVIGATION_EVENT, handler);
    return () => window.removeEventListener(SEARCH_NAVIGATION_EVENT, handler);
  }, [manageableRoleKey]);

  const reset = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setError(null);
    setDraft({ title: '', purpose: '', body: '', businessModel: 'ALL' });
  };

  const openCreate = () => {
    setEditingId(null);
    setError(null);
    setDraft({ title: '', purpose: '', body: '', businessModel: 'ALL' });
    setIsFormOpen(true);
  };

  const save = () => {
    if (!draft.title.trim()) {
      setError('Укажите название шаблона.');
      return;
    }
    if (!draft.body.trim()) {
      setError('Укажите текст шаблона.');
      return;
    }
    setError(null);
    if (editingId) updateTemplate(editingId, { ...draft, role: activeRole });
    else createTemplate({ ...draft, role: activeRole });
    reset();
  };

  return (
    <div className="space-y-5">
      <BusinessModelFilter value={businessModelFilter} onChange={setBusinessModelFilter} />
      <div className="flex justify-end">
        <button type="button" onClick={openCreate} className="primary-action flex items-center gap-2"><Plus className="w-4 h-4" />Добавить шаблон</button>
      </div>
      {isFormOpen && (
        <GlassCard>
          <h3 className="text-xl text-[#f5f3f0] mb-4">{editingId ? 'Редактировать шаблон' : 'Добавить шаблон сообщения'}</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <select value={activeRole} onChange={(event) => setActiveRole(event.target.value as Role)} className="field">
              {manageableRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
            </select>
            <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Название шаблона" className="field" />
            <input value={draft.purpose} onChange={(event) => setDraft((value) => ({ ...value, purpose: event.target.value }))} placeholder="Назначение" className="field" />
            <BusinessModelSelect value={draft.businessModel} onChange={(businessModel) => setDraft((value) => ({ ...value, businessModel }))} />
            <textarea value={draft.body} onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))} placeholder="Текст шаблона" className="field md:col-span-2 min-h-28" />
          </div>
          {error && <p className="mt-3 text-sm text-[#f0c5cf]">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={save} className="primary-action flex items-center gap-2"><Save className="w-4 h-4" />Сохранить</button>
            <button onClick={reset} className="px-4 py-2 rounded-lg border border-[#c9a98d]/20 text-[#f5f3f0] hover:bg-[#2a2630] flex items-center gap-2"><X className="w-4 h-4" />Отмена</button>
          </div>
        </GlassCard>
      )}

      <div className="space-y-4">
        {templates.length === 0 && <GlassCard><p className="text-[#a89b8f]">Шаблоны для этих ролей пока не добавлены.</p></GlassCard>}
        {templates.map((template) => (
          <GlassCard key={template.id} data-search-target={searchTarget('template', template.id)}>
            <div className="flex justify-between gap-4">
              <div>
                <h3 className="text-lg text-[#f5f3f0]">{template.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <BusinessModelBadge value={template.businessModel} />
                  <span className="rounded-full border border-[#c9a98d]/20 px-2.5 py-1 text-xs text-[#a89b8f]">{roleLabels[template.role]}</span>
                  <p className="text-xs text-[#c9a98d]">{template.purpose}</p>
                </div>
                <p className="text-sm text-[#a89b8f] mt-3 whitespace-pre-line">{template.body}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setIsFormOpen(true); setEditingId(template.id); setActiveRole(template.role); setDraft({ title: template.title, purpose: template.purpose ?? '', body: template.body, businessModel: template.businessModel ?? 'ALL' }); }} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${template.title}`}><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => deleteTemplate(template.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${template.title}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

export function RoleLinksManager({ role }: { role: Role }) {
  const { state, createLink, updateLink, deleteLink } = useLibrary();
  const canChooseGroup = role === 'OWNER' || role === 'ASSISTANT';
  const [workLinkGroup, setWorkLinkGroup] = useState<WorkLinkGroup>(defaultWorkLinkGroupForRole(role));
  const manageableRoles = canChooseGroup ? workLinkRolesForGroup(workLinkGroup) : manageableContentRolesFor(role, 'workLinks');
  const [activeRole, setActiveRole] = useState<Role>(manageableRoles[0] ?? role);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', url: '', description: '', category: 'WORK_TABLE' as LinkCategory });
  const [error, setError] = useState<string | null>(null);
  const pinnedLinkIds = useMemo(() => new Set(state.favorites.filter((favorite) => favorite.entityType === 'link').map((favorite) => favorite.entityId)), [state.favorites]);
  const links = state.links.filter((link) => manageableRoles.includes(link.role));
  const manageableRoleKey = manageableRoles.join('|');

  useEffect(() => {
    const applyTarget = (detail: SearchNavigationDetail | null) => {
      if (!detail || detail.entityType !== 'link' || !detail.role) return;
      if (canChooseGroup) {
        setWorkLinkGroup(workLinkGroupForRole(detail.role));
      } else if (!manageableRoles.includes(detail.role)) {
        return;
      }
      setActiveRole(detail.role);
    };

    applyTarget(getPendingSearchTarget());
    const handler = (event: Event) => applyTarget((event as CustomEvent<SearchNavigationDetail>).detail);
    window.addEventListener(SEARCH_NAVIGATION_EVENT, handler);
    return () => window.removeEventListener(SEARCH_NAVIGATION_EVENT, handler);
  }, [canChooseGroup, manageableRoleKey]);

  const reset = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setError(null);
    setDraft({ title: '', url: '', description: '', category: 'WORK_TABLE' });
  };

  useEffect(() => {
    if (manageableRoles.includes(activeRole)) return;
    setActiveRole(manageableRoles[0] ?? role);
    setIsFormOpen(false);
    setEditingId(null);
    setError(null);
    setDraft({ title: '', url: '', description: '', category: 'WORK_TABLE' });
  }, [activeRole, manageableRoleKey, role]);

  const openCreate = () => {
    setEditingId(null);
    setError(null);
    setDraft({ title: '', url: '', description: '', category: 'WORK_TABLE' });
    setIsFormOpen(true);
  };

  const save = () => {
    if (!draft.title.trim()) {
      setError('Укажите название.');
      return;
    }
    if (!draft.url.trim()) {
      setError('Поле ссылки обязательно.');
      return;
    }
    setError(null);
    if (editingId) updateLink(editingId, { ...draft, role: activeRole });
    else createLink({ ...draft, role: activeRole });
    reset();
  };

  return (
    <div className="space-y-5">
      {canChooseGroup && <WorkLinkGroupFilter value={workLinkGroup} onChange={setWorkLinkGroup} />}
      <div className="flex justify-end">
        <button type="button" onClick={openCreate} className="primary-action flex items-center gap-2"><Plus className="w-4 h-4" />Добавить ссылку</button>
      </div>
      {isFormOpen && (
        <GlassCard>
          <h3 className="text-xl text-[#f5f3f0] mb-4">{editingId ? 'Редактировать ссылку' : 'Добавить рабочую ссылку или таблицу'}</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <select value={activeRole} onChange={(event) => setActiveRole(event.target.value as Role)} className="field">
              {manageableRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
            </select>
            <select value={draft.category} onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value as LinkCategory }))} className="field">
              <option value="WORK_TABLE">Рабочая таблица</option>
              <option value="TRAINING">Обучение</option>
              <option value="HELPFUL">Полезная ссылка</option>
            </select>
            <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Название" className="field" />
            <input value={draft.url} onChange={(event) => setDraft((value) => ({ ...value, url: event.target.value }))} placeholder="https://..." className="field" />
            <textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Описание" className="field md:col-span-2 min-h-24" />
          </div>
          {error && <p className="mt-3 text-sm text-[#f0c5cf]">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={save} className="primary-action flex items-center gap-2"><Save className="w-4 h-4" />Сохранить</button>
            <button onClick={reset} className="px-4 py-2 rounded-lg border border-[#c9a98d]/20 text-[#f5f3f0] hover:bg-[#2a2630] flex items-center gap-2"><X className="w-4 h-4" />Отмена</button>
          </div>
        </GlassCard>
      )}

      <PinnedLinkTabs links={links} pinnedLinkIds={pinnedLinkIds} />
      <div className="grid md:grid-cols-2 gap-4">
        {links.length === 0 && <GlassCard><p className="text-[#a89b8f]">Рабочие ссылки для этих ролей пока не добавлены.</p></GlassCard>}
        {links.map((link) => (
          <GlassCard key={link.id} data-search-target={searchTarget('link', link.id)}>
            <div className="flex justify-between gap-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[#f5f3f0]">{link.title}</h3>
                  <LinkPinnedButton link={link} pinned={pinnedLinkIds.has(link.id)} />
                </div>
                <p className="mt-1 text-xs text-[#c9a98d]">{roleLabels[link.role]}</p>
                <a href={link.url} className="text-sm text-[#a89b8f] hover:text-[#c9a98d] break-all">{link.url}</a>
                <p className="text-sm text-[#a89b8f] mt-2">{link.description}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setIsFormOpen(true); setEditingId(link.id); setActiveRole(link.role); setDraft({ title: link.title, url: link.url, description: link.description ?? '', category: link.category }); }} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${link.title}`}><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => deleteLink(link.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${link.title}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

export function OwnerRoleContentManager({ category }: { category: KnowledgeCategory }) {
  const { state, createKnowledge, updateKnowledge, deleteKnowledge, knowledgeReadCount } = useLibrary();
  const [activeRole, setActiveRole] = useState<Role>('ASSISTANT');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', content: '', isActual: true, businessModel: 'ALL' as BusinessModelScope });
  const entries = state.knowledge.filter((entry) => entry.role === activeRole && entry.category === category);
  const hasBusinessModel = supportsBusinessModel(category);
  const selectedTabs = useMemo(() => tabsFor(category), [category]);
  const titlePlaceholder = category === 'RESPONSIBILITY' ? 'Новая обязанность' : 'Название';
  const contentPlaceholder = category === 'REGULATION' ? 'Текст регламента' : category === 'KNOWLEDGE' ? 'Описание и содержимое' : 'Текст информации';

  useEffect(() => {
    const applyTarget = (detail: SearchNavigationDetail | null) => {
      if (!detail || detail.entityType !== 'knowledge' || detail.category !== category || !detail.role) return;
      setActiveRole(detail.role);
    };

    applyTarget(getPendingSearchTarget());
    const handler = (event: Event) => applyTarget((event as CustomEvent<SearchNavigationDetail>).detail);
    window.addEventListener(SEARCH_NAVIGATION_EVENT, handler);
    return () => window.removeEventListener(SEARCH_NAVIGATION_EVENT, handler);
  }, [category]);

  const resetDraft = () => {
    setEditingId(null);
    setDraft({ title: '', content: '', isActual: true, businessModel: 'ALL' });
  };

  const startEdit = (entry: KnowledgeEntry) => {
    setEditingId(entry.id);
    setDraft({ title: entry.title, content: entry.content, isActual: entry.isActual !== false, businessModel: entry.businessModel ?? 'ALL' });
  };

  const save = () => {
    if (!draft.title.trim()) return;
    const content = category === 'RESPONSIBILITY' ? draft.content || draft.title : draft.content;
    const businessModel = hasBusinessModel ? draft.businessModel : 'ALL';
    if (editingId) updateKnowledge(editingId, { ...draft, businessModel, content, role: activeRole, category });
    else createKnowledge({ ...draft, businessModel, content, role: activeRole, category });
    resetDraft();
  };

  return (
    <div className="space-y-5">
      <TabNavigation tabs={selectedTabs} activeTab={activeRole} onTabChange={(role) => { setActiveRole(role as Role); resetDraft(); }} />
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-4">{editingId ? 'Редактировать' : 'Добавить'}: {roleLabels[activeRole]}</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder={titlePlaceholder} className="field" />
          {hasBusinessModel && (
            <BusinessModelSelect value={draft.businessModel} onChange={(businessModel) => setDraft((value) => ({ ...value, businessModel }))} />
          )}
          {category === 'IMPORTANT_INFO' && (
            <select value={draft.isActual ? 'actual' : 'archived'} onChange={(event) => setDraft((value) => ({ ...value, isActual: event.target.value === 'actual' }))} className="field">
              <option value="actual">Актуально</option>
              <option value="archived">Не актуально</option>
            </select>
          )}
          <textarea value={draft.content} onChange={(event) => setDraft((value) => ({ ...value, content: event.target.value }))} placeholder={contentPlaceholder} className="field md:col-span-2 min-h-28" />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={save} className="primary-action flex items-center gap-2"><Save className="w-4 h-4" />Сохранить</button>
          {editingId && <button onClick={resetDraft} className="px-4 py-2 rounded-lg border border-[#c9a98d]/20 text-[#f5f3f0] hover:bg-[#2a2630] flex items-center gap-2"><X className="w-4 h-4" />Отмена</button>}
        </div>
      </GlassCard>

      <div className={category === 'RESPONSIBILITY' ? 'space-y-3' : 'grid md:grid-cols-2 gap-4'}>
        {entries.length === 0 && <GlassCard><p className="text-[#a89b8f]">{categoryEmpty[category]}</p></GlassCard>}
        {entries.map((entry, index) => (
          <GlassCard key={entry.id} delay={index * 0.04} data-search-target={searchTarget('knowledge', entry.id)}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-start gap-3">
                  <h3 className="text-lg text-[#f5f3f0]">{entry.title}</h3>
                  <FavoriteButton entityType="knowledge" entityId={entry.id} label={entry.title} />
                </div>
                {hasBusinessModel && <div className="mt-2"><BusinessModelBadge value={entry.businessModel} /></div>}
                {category === 'IMPORTANT_INFO' && (
                  <p className="text-xs text-[#c9a98d] mt-1">{formatDate(entry.createdAt)} · {entry.isActual === false ? 'не актуально' : 'актуально'} · ознакомились: {knowledgeReadCount(entry.id)}</p>
                )}
                {entry.content && <p className="text-sm text-[#a89b8f] mt-3 whitespace-pre-line">{entry.content}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(entry)} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать ${entry.title}`}><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => deleteKnowledge(entry.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить ${entry.title}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

export function OwnerTemplatesManager() {
  const { state, createTemplate, updateTemplate, deleteTemplate } = useLibrary();
  const [activeRole, setActiveRole] = useState<Role>('ASSISTANT');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', purpose: '', body: '', businessModel: 'ALL' as BusinessModelScope });
  const templates = state.templates.filter((template) => template.role === activeRole);

  useEffect(() => {
    const applyTarget = (detail: SearchNavigationDetail | null) => {
      if (!detail || detail.entityType !== 'template' || !detail.role) return;
      setActiveRole(detail.role);
    };

    applyTarget(getPendingSearchTarget());
    const handler = (event: Event) => applyTarget((event as CustomEvent<SearchNavigationDetail>).detail);
    window.addEventListener(SEARCH_NAVIGATION_EVENT, handler);
    return () => window.removeEventListener(SEARCH_NAVIGATION_EVENT, handler);
  }, []);

  const reset = () => {
    setEditingId(null);
    setDraft({ title: '', purpose: '', body: '', businessModel: 'ALL' });
  };

  const save = () => {
    if (!draft.title.trim() || !draft.body.trim()) return;
    if (editingId) updateTemplate(editingId, { ...draft, role: activeRole });
    else createTemplate({ ...draft, role: activeRole });
    reset();
  };

  return (
    <div className="space-y-5">
      <TabNavigation tabs={roleTabsForRoles('Шаблоны', messageTemplateManagedRoles)} activeTab={activeRole} onTabChange={(role) => { setActiveRole(role as Role); reset(); }} />
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-4">{editingId ? 'Редактировать шаблон' : 'Новый шаблон'}: {roleLabels[activeRole]}</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Название шаблона" className="field" />
          <input value={draft.purpose} onChange={(event) => setDraft((value) => ({ ...value, purpose: event.target.value }))} placeholder="Назначение" className="field" />
          <BusinessModelSelect value={draft.businessModel} onChange={(businessModel) => setDraft((value) => ({ ...value, businessModel }))} />
          <textarea value={draft.body} onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))} placeholder="Текст шаблона" className="field md:col-span-2 min-h-28" />
        </div>
        <button onClick={save} className="primary-action mt-4 flex items-center gap-2"><Plus className="w-4 h-4" />Сохранить</button>
      </GlassCard>
      <div className="space-y-4">
        {templates.map((template) => (
          <GlassCard key={template.id} data-search-target={searchTarget('template', template.id)}>
            <div className="flex justify-between gap-4">
              <div>
                <h3 className="text-lg text-[#f5f3f0]">{template.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <BusinessModelBadge value={template.businessModel} />
                  <p className="text-xs text-[#c9a98d]">{template.purpose}</p>
                </div>
                <p className="text-sm text-[#a89b8f] mt-3 whitespace-pre-line">{template.body}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingId(template.id); setDraft({ title: template.title, purpose: template.purpose ?? '', body: template.body, businessModel: template.businessModel ?? 'ALL' }); }} className="text-[#a89b8f] hover:text-[#c9a98d]"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => deleteTemplate(template.id)} className="text-[#a89b8f] hover:text-[#8b3a52]"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

export function OwnerLinksManager() {
  const { state, createLink, updateLink, deleteLink } = useLibrary();
  const [activeRole, setActiveRole] = useState<Role>('ASSISTANT');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', url: '', description: '', category: 'WORK_TABLE' as LinkCategory });
  const [error, setError] = useState<string | null>(null);
  const links = state.links.filter((link) => link.role === activeRole);

  useEffect(() => {
    const applyTarget = (detail: SearchNavigationDetail | null) => {
      if (!detail || detail.entityType !== 'link' || !detail.role) return;
      setActiveRole(detail.role);
    };

    applyTarget(getPendingSearchTarget());
    const handler = (event: Event) => applyTarget((event as CustomEvent<SearchNavigationDetail>).detail);
    window.addEventListener(SEARCH_NAVIGATION_EVENT, handler);
    return () => window.removeEventListener(SEARCH_NAVIGATION_EVENT, handler);
  }, []);

  const reset = () => {
    setEditingId(null);
    setDraft({ title: '', url: '', description: '', category: 'WORK_TABLE' });
  };

  const save = () => {
    if (!draft.title.trim()) {
      setError('Укажите название.');
      return;
    }
    if (!draft.url.trim()) {
      setError('Поле ссылки обязательно.');
      return;
    }
    setError(null);
    if (editingId) updateLink(editingId, { ...draft, role: activeRole });
    else createLink({ ...draft, role: activeRole });
    reset();
  };

  return (
    <div className="space-y-5">
      <TabNavigation tabs={roleTabs('Ссылки')} activeTab={activeRole} onTabChange={(role) => { setActiveRole(role as Role); reset(); }} />
      <GlassCard>
        <h3 className="text-xl text-[#f5f3f0] mb-4">{editingId ? 'Редактировать ссылку' : 'Новая ссылка'}: {roleLabels[activeRole]}</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Название" className="field" />
          <input value={draft.url} onChange={(event) => setDraft((value) => ({ ...value, url: event.target.value }))} placeholder="https://..." className="field" />
          <select value={draft.category} onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value as HelpfulLink['category'] }))} className="field">
            <option value="WORK_TABLE">Рабочая таблица</option>
            <option value="TRAINING">Обучение</option>
            <option value="HELPFUL">Полезная ссылка</option>
          </select>
          <textarea value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Описание" className="field md:col-span-2 min-h-24" />
        </div>
        {error && <p className="mt-3 text-sm text-[#f0c5cf]">{error}</p>}
        <button onClick={save} className="primary-action mt-4">Сохранить</button>
      </GlassCard>
      <div className="grid md:grid-cols-2 gap-4">
        {links.map((link) => (
          <GlassCard key={link.id} data-search-target={searchTarget('link', link.id)}>
            <div className="flex justify-between gap-4">
              <div>
                <h3 className="text-[#f5f3f0]">{link.title}</h3>
                <a href={link.url} className="text-sm text-[#a89b8f] hover:text-[#c9a98d] break-all">{link.url}</a>
                <p className="text-sm text-[#a89b8f] mt-2">{link.description}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingId(link.id); setDraft({ title: link.title, url: link.url, description: link.description ?? '', category: link.category }); }} className="text-[#a89b8f] hover:text-[#c9a98d]"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => deleteLink(link.id)} className="text-[#a89b8f] hover:text-[#8b3a52]"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
