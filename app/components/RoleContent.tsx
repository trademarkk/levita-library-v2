import { useMemo, useState } from 'react';
import { BookOpen, Edit2, FileText, Info, Link as LinkIcon, Plus, Save, Shield, Trash2, X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { TabNavigation } from './TabNavigation';
import { useLibrary } from '../domain/LibraryContext';
import { formatDate, roleLabels } from '../domain/labels';
import type { BusinessModelScope, HelpfulLink, KnowledgeCategory, KnowledgeEntry, LinkCategory, Role } from '../domain/types';

export const managedRoles: Role[] = ['ASSISTANT', 'ADMIN', 'SENIOR_ADMIN', 'TRAINER', 'SENIOR_TRAINER'];

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
          : `База знаний для ${roleContentLabels[role]}`;
    return { id: role, label };
  });
}

function roleTabs(label: string) {
  return managedRoles.map((role) => ({ id: role, label: `${label} ${roleContentLabels[role]}` }));
}

const businessModelLabels: Record<BusinessModelScope, string> = {
  SUBSCRIPTION: 'Подписки',
  MEMBERSHIP: 'Абонементы',
  ALL: 'Для всех',
};

const businessModelHelp: Record<BusinessModelScope, string> = {
  SUBSCRIPTION: 'Подписная модель Мачуги',
  MEMBERSHIP: 'Абонементы 3/6/12 месяцев',
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

export function RoleContentViewer({ role, category }: { role: Role; category: KnowledgeCategory }) {
  const { state } = useLibrary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [businessModelFilter, setBusinessModelFilter] = useState<BusinessModelScope>('ALL');
  const hasBusinessModelFilter = supportsBusinessModel(category);
  const entries = state.knowledge.filter((entry) => (
    entry.role === role
    && entry.category === category
    && (!hasBusinessModelFilter || businessModelMatches(entry.businessModel, businessModelFilter))
  ));
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

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
        </GlassCard>
      </div>
    );
  }

  if (category === 'RESPONSIBILITY') {
    return (
      <GlassCard>
        <h2 className="text-2xl text-[#f5f3f0] mb-5">Обязанности</h2>
        {entries.length === 0 && <p className="text-[#a89b8f]">{categoryEmpty[category]}</p>}
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 rounded-lg bg-[#2a2630]/55 p-3">
              <span className="mt-2 h-2 w-2 rounded-full bg-[#c9a98d]" />
              <span className="text-[#f5f3f0]">{entry.title}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    );
  }

  return (
    <>
    {hasBusinessModelFilter && <BusinessModelFilter value={businessModelFilter} onChange={(value) => { setBusinessModelFilter(value); setSelectedId(null); }} />}
    <div className="grid md:grid-cols-2 gap-5">
      {entries.length === 0 && <GlassCard><p className="text-[#a89b8f]">{categoryEmpty[category]}</p></GlassCard>}
      {entries.map((entry, index) => (
        <GlassCard key={entry.id} delay={index * 0.05}>
          <div className="flex items-start gap-3 mb-3">
            {category === 'REGULATION' ? <Shield className="w-5 h-5 text-[#c9a98d] mt-1" /> : category === 'KNOWLEDGE' ? <BookOpen className="w-5 h-5 text-[#c9a98d] mt-1" /> : <Info className="w-5 h-5 text-[#c9a98d] mt-1" />}
            <div className="flex-1">
              <h3 className="text-xl text-[#f5f3f0]">{entry.title}</h3>
              <div className="mt-2"><BusinessModelBadge value={entry.businessModel} /></div>
              {category === 'IMPORTANT_INFO' && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[#c9a98d]/15 px-2 py-1 text-[#c9a98d]">{formatDate(entry.createdAt)}</span>
                  <span className={`rounded-full px-2 py-1 ${entry.isActual === false ? 'bg-[#8b3a52]/25 text-[#f0c5cf]' : 'bg-[#5e6d58]/30 text-[#d8e0d2]'}`}>
                    {entry.isActual === false ? 'не актуально' : 'актуально'}
                  </span>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-[#a89b8f] leading-relaxed whitespace-pre-line">{entry.content}</p>
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
  const { state } = useLibrary();
  const [businessModelFilter, setBusinessModelFilter] = useState<BusinessModelScope>('ALL');
  const templates = state.templates.filter((template) => template.role === role && businessModelMatches(template.businessModel, businessModelFilter));

  return (
    <div className="space-y-4">
      <BusinessModelFilter value={businessModelFilter} onChange={setBusinessModelFilter} />
      {templates.length === 0 && <GlassCard><p className="text-[#a89b8f]">Для этой роли пока нет шаблонов сообщений.</p></GlassCard>}
      {templates.map((template, index) => (
        <GlassCard key={template.id} delay={index * 0.05}>
          <div className="flex gap-3">
            <FileText className="w-5 h-5 text-[#c9a98d] mt-1" />
            <div>
              <h3 className="text-lg text-[#f5f3f0]">{template.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <BusinessModelBadge value={template.businessModel} />
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
  const links = state.links.filter((link) => link.role === role);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {links.length === 0 && <GlassCard><p className="text-[#a89b8f]">Для этой роли пока нет рабочих ссылок.</p></GlassCard>}
      {links.map((link, index) => (
        <GlassCard key={link.id} delay={index * 0.05}>
          <div className="flex gap-3">
            <LinkIcon className="w-5 h-5 text-[#c9a98d] mt-1" />
            <div>
              <h3 className="text-[#f5f3f0]">{link.title}</h3>
              <a href={link.url} className="text-sm text-[#a89b8f] hover:text-[#c9a98d] break-all">{link.url}</a>
              <p className="text-sm text-[#a89b8f] mt-2">{link.description}</p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

export function OwnerRoleContentManager({ category }: { category: KnowledgeCategory }) {
  const { state, createKnowledge, updateKnowledge, deleteKnowledge } = useLibrary();
  const [activeRole, setActiveRole] = useState<Role>('ASSISTANT');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', content: '', isActual: true, businessModel: 'ALL' as BusinessModelScope });
  const entries = state.knowledge.filter((entry) => entry.role === activeRole && entry.category === category);
  const hasBusinessModel = supportsBusinessModel(category);
  const selectedTabs = useMemo(() => tabsFor(category), [category]);
  const titlePlaceholder = category === 'RESPONSIBILITY' ? 'Новая обязанность' : 'Название';
  const contentPlaceholder = category === 'REGULATION' ? 'Текст регламента' : category === 'KNOWLEDGE' ? 'Описание и содержимое' : 'Текст информации';

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
          <GlassCard key={entry.id} delay={index * 0.04}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg text-[#f5f3f0]">{entry.title}</h3>
                {hasBusinessModel && <div className="mt-2"><BusinessModelBadge value={entry.businessModel} /></div>}
                {category === 'IMPORTANT_INFO' && (
                  <p className="text-xs text-[#c9a98d] mt-1">{formatDate(entry.createdAt)} · {entry.isActual === false ? 'не актуально' : 'актуально'}</p>
                )}
                {category !== 'RESPONSIBILITY' && <p className="text-sm text-[#a89b8f] mt-3 whitespace-pre-line">{entry.content}</p>}
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
      <TabNavigation tabs={roleTabs('Шаблоны')} activeTab={activeRole} onTabChange={(role) => { setActiveRole(role as Role); reset(); }} />
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
          <GlassCard key={template.id}>
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
  const links = state.links.filter((link) => link.role === activeRole);

  const reset = () => {
    setEditingId(null);
    setDraft({ title: '', url: '', description: '', category: 'WORK_TABLE' });
  };

  const save = () => {
    if (!draft.title.trim() || !draft.url.trim()) return;
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
        <button onClick={save} className="primary-action mt-4">Сохранить</button>
      </GlassCard>
      <div className="grid md:grid-cols-2 gap-4">
        {links.map((link) => (
          <GlassCard key={link.id}>
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
