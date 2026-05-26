import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ExternalLink, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useLibrary } from '../domain/LibraryContext';
import { formatDate } from '../domain/labels';
import type { ExpenseStudio, TrainerEvaluationSheet } from '../domain/types';

const studioLabels: Record<ExpenseStudio, string> = {
  STAVROPOLSKAYA: 'Ставропольская',
  MACHUGI: 'Мачуги',
};

type EvaluationDraft = {
  trainerName: string;
  studio: ExpenseStudio;
  direction: string;
  score: string;
  evaluatedAt: string;
  sheetUrl: string;
};

type RatingScope = 'all' | 'studio' | 'trainer';

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function emptyDraft(): EvaluationDraft {
  return {
    trainerName: '',
    studio: 'STAVROPOLSKAYA',
    direction: '',
    score: '',
    evaluatedAt: todayKey(),
    sheetUrl: '',
  };
}

function draftFromEvaluation(evaluation: TrainerEvaluationSheet): EvaluationDraft {
  return {
    trainerName: evaluation.trainerName,
    studio: evaluation.studio,
    direction: evaluation.direction,
    score: String(evaluation.score),
    evaluatedAt: evaluation.evaluatedAt,
    sheetUrl: evaluation.sheetUrl,
  };
}

function toInput(draft: EvaluationDraft) {
  return {
    trainerName: draft.trainerName,
    studio: draft.studio,
    direction: draft.direction,
    score: Number(draft.score),
    evaluatedAt: draft.evaluatedAt,
    sheetUrl: draft.sheetUrl,
  };
}

function scoreLabel(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function trainerNamesFrom(evaluations: TrainerEvaluationSheet[]) {
  return Array.from(new Set(evaluations.map((evaluation) => evaluation.trainerName).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function evaluationSort(left: TrainerEvaluationSheet, right: TrainerEvaluationSheet) {
  return right.evaluatedAt.localeCompare(left.evaluatedAt) || right.createdAt.localeCompare(left.createdAt);
}

function RatingTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TrainerEvaluationSheet }> }) {
  const item = active && payload?.[0]?.payload ? payload[0].payload : null;
  if (!item) return null;

  return (
    <div className="rounded-xl border border-[#c9a98d]/25 bg-[#1a1820]/95 p-4 text-sm shadow-2xl">
      <p className="text-xs text-[#c9a98d]">{formatDate(item.evaluatedAt)}</p>
      <p className="mt-1 text-[#f5f3f0]">{item.trainerName}</p>
      <p className="text-[#a89b8f]">Оценка: {scoreLabel(item.score)}</p>
      <p className="text-[#a89b8f]">Студия: {studioLabels[item.studio]}</p>
      <p className="text-[#a89b8f]">Направление: {item.direction}</p>
      <a href={item.sheetUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[#c9a98d] hover:text-[#f5f3f0]">
        <ExternalLink className="h-3 w-3" />
        Открыть лист
      </a>
    </div>
  );
}

export function TrainerEvaluationSheetsSection() {
  const { state, createTrainerEvaluation, updateTrainerEvaluation, deleteTrainerEvaluation } = useLibrary();
  const [draft, setDraft] = useState<EvaluationDraft>(() => emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const trainerNames = useMemo(() => Array.from(new Set([
    ...state.users.filter((user) => user.role === 'TRAINER' || user.role === 'SENIOR_TRAINER').map((user) => user.name),
    ...trainerNamesFrom(state.trainerEvaluations),
  ])).sort((left, right) => left.localeCompare(right)), [state.trainerEvaluations, state.users]);
  const evaluations = useMemo(() => [...state.trainerEvaluations].sort(evaluationSort), [state.trainerEvaluations]);

  const reset = () => {
    setDraft(emptyDraft());
    setEditingId(null);
  };

  const save = () => {
    if (!draft.trainerName.trim() || !draft.direction.trim() || !draft.score || !draft.evaluatedAt || !draft.sheetUrl.trim()) return;
    if (editingId) updateTrainerEvaluation(editingId, toInput(draft));
    else createTrainerEvaluation(toInput(draft));
    reset();
  };

  const startEdit = (evaluation: TrainerEvaluationSheet) => {
    setEditingId(evaluation.id);
    setDraft(draftFromEvaluation(evaluation));
  };

  return (
    <div className="space-y-5">
      <GlassCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#c9a98d]">Тренерская команда</p>
            <h2 className="mt-1 text-2xl text-[#f5f3f0]">Листы оценивания</h2>
            <p className="mt-2 text-sm text-[#a89b8f]">Сохраняйте оценку тренера и ссылку на подробный разбор занятия в Google-таблице.</p>
          </div>
          {editingId && (
            <button onClick={reset} className="calendar-soft-button inline-flex items-center gap-2 self-start">
              <X className="h-4 w-4" />
              Отменить редактирование
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm text-[#a89b8f] xl:col-span-2">
            Имя тренера
            <input list="trainer-evaluation-names" value={draft.trainerName} onChange={(event) => setDraft((value) => ({ ...value, trainerName: event.target.value }))} className="field mt-2" placeholder="Например, Мила Тренер" />
            <datalist id="trainer-evaluation-names">
              {trainerNames.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
          <label className="text-sm text-[#a89b8f]">
            Студия
            <select value={draft.studio} onChange={(event) => setDraft((value) => ({ ...value, studio: event.target.value as ExpenseStudio }))} className="field mt-2">
              <option value="STAVROPOLSKAYA">Ставропольская</option>
              <option value="MACHUGI">Мачуги</option>
            </select>
          </label>
          <label className="text-sm text-[#a89b8f]">
            Направление
            <input value={draft.direction} onChange={(event) => setDraft((value) => ({ ...value, direction: event.target.value }))} className="field mt-2" placeholder="Балет, растяжка..." />
          </label>
          <label className="text-sm text-[#a89b8f]">
            Оценка
            <input type="number" min="0" step="0.1" value={draft.score} onChange={(event) => setDraft((value) => ({ ...value, score: event.target.value }))} className="field mt-2" placeholder="9.2" />
          </label>
          <label className="text-sm text-[#a89b8f]">
            Дата
            <input type="date" value={draft.evaluatedAt} onChange={(event) => setDraft((value) => ({ ...value, evaluatedAt: event.target.value }))} className="field mt-2" />
          </label>
          <label className="text-sm text-[#a89b8f] md:col-span-2 xl:col-span-5">
            Ссылка на Google-таблицу
            <input value={draft.sheetUrl} onChange={(event) => setDraft((value) => ({ ...value, sheetUrl: event.target.value }))} className="field mt-2" placeholder="https://docs.google.com/spreadsheets/..." />
          </label>
          <button onClick={save} className="primary-action mt-7 inline-flex items-center justify-center gap-2">
            {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        {evaluations.map((evaluation) => (
          <GlassCard key={evaluation.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-[#c9a98d]">{formatDate(evaluation.evaluatedAt)}</p>
                <h3 className="mt-1 text-xl text-[#f5f3f0]">{evaluation.trainerName}</h3>
                <p className="mt-1 text-sm text-[#a89b8f]">{studioLabels[evaluation.studio]} · {evaluation.direction}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#c9a98d]/15 px-3 py-1 text-sm text-[#c9a98d]">{scoreLabel(evaluation.score)}</span>
                <button onClick={() => startEdit(evaluation)} className="text-[#a89b8f] hover:text-[#c9a98d]" aria-label={`Редактировать оценку ${evaluation.trainerName}`}><Pencil className="h-4 w-4" /></button>
                <button onClick={() => deleteTrainerEvaluation(evaluation.id)} className="text-[#a89b8f] hover:text-[#8b3a52]" aria-label={`Удалить оценку ${evaluation.trainerName}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <a href={evaluation.sheetUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-[#c9a98d] hover:text-[#f5f3f0]">
              <ExternalLink className="h-4 w-4" />
              Открыть оценочный лист
            </a>
          </GlassCard>
        ))}
        {!evaluations.length && <GlassCard><p className="text-[#a89b8f]">Оценочные листы пока не добавлены.</p></GlassCard>}
      </div>
    </div>
  );
}

export function TrainerRatingSection() {
  const { state } = useLibrary();
  const [scope, setScope] = useState<RatingScope>('all');
  const [studio, setStudio] = useState<ExpenseStudio>('STAVROPOLSKAYA');
  const trainerNames = useMemo(() => trainerNamesFrom(state.trainerEvaluations), [state.trainerEvaluations]);
  const [trainerName, setTrainerName] = useState('');

  const filtered = useMemo(() => {
    const targetTrainer = trainerName || trainerNames[0] || '';
    return [...state.trainerEvaluations]
      .filter((evaluation) => {
        if (scope === 'studio') return evaluation.studio === studio;
        if (scope === 'trainer') return evaluation.trainerName === targetTrainer;
        return true;
      })
      .sort((left, right) => left.evaluatedAt.localeCompare(right.evaluatedAt) || left.createdAt.localeCompare(right.createdAt));
  }, [scope, state.trainerEvaluations, studio, trainerName, trainerNames]);

  const average = filtered.length ? filtered.reduce((sum, evaluation) => sum + evaluation.score, 0) / filtered.length : 0;
  const maxScore = Math.max(10, ...filtered.map((evaluation) => evaluation.score));
  const yMax = maxScore <= 10 ? 10 : Math.ceil(maxScore / 10) * 10;

  return (
    <div className="space-y-5">
      <GlassCard>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#c9a98d]">Динамика качества занятий</p>
            <h2 className="mt-1 text-2xl text-[#f5f3f0]">Рейтинг тренеров</h2>
            <p className="mt-2 text-sm text-[#a89b8f]">График строится по оценкам из листов оценивания: X — дни, Y — оценка.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-[#a89b8f]">
              Срез
              <select value={scope} onChange={(event) => setScope(event.target.value as RatingScope)} className="field mt-2">
                <option value="all">Общий</option>
                <option value="studio">По студии</option>
                <option value="trainer">По тренеру</option>
              </select>
            </label>
            <label className="text-sm text-[#a89b8f]">
              Студия
              <select value={studio} onChange={(event) => setStudio(event.target.value as ExpenseStudio)} disabled={scope !== 'studio'} className="field mt-2 disabled:opacity-45">
                <option value="STAVROPOLSKAYA">Ставропольская</option>
                <option value="MACHUGI">Мачуги</option>
              </select>
            </label>
            <label className="text-sm text-[#a89b8f]">
              Тренер
              <select value={trainerName || trainerNames[0] || ''} onChange={(event) => setTrainerName(event.target.value)} disabled={scope !== 'trainer'} className="field mt-2 disabled:opacity-45">
                {trainerNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#c9a98d]/15 bg-[#2a2630]/45 p-4">
            <p className="text-xs text-[#a89b8f]">Оценок в срезе</p>
            <p className="mt-1 text-2xl text-[#f5f3f0]">{filtered.length}</p>
          </div>
          <div className="rounded-xl border border-[#c9a98d]/15 bg-[#2a2630]/45 p-4">
            <p className="text-xs text-[#a89b8f]">Средняя оценка</p>
            <p className="mt-1 text-2xl text-[#f5f3f0]">{filtered.length ? scoreLabel(average) : '—'}</p>
          </div>
          <div className="rounded-xl border border-[#c9a98d]/15 bg-[#2a2630]/45 p-4">
            <p className="text-xs text-[#a89b8f]">Последний лист</p>
            <p className="mt-1 text-2xl text-[#f5f3f0]">{filtered.length ? formatDate(filtered[filtered.length - 1].evaluatedAt) : '—'}</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="h-[25rem]">
          {filtered.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filtered} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="rgba(201,169,141,0.12)" vertical={false} />
                <XAxis dataKey="evaluatedAt" tickFormatter={(value) => formatDate(String(value)).replace(/\s2026 г\./, '')} stroke="#a89b8f" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, yMax]} stroke="#a89b8f" tick={{ fontSize: 12 }} />
                <Tooltip content={<RatingTooltip />} />
                <Line type="monotone" dataKey="score" stroke="#c9a98d" strokeWidth={3} dot={{ r: 5, fill: '#c9a98d', stroke: '#1a1820', strokeWidth: 2 }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl bg-[#2a2630]/45 text-[#a89b8f]">Для выбранного среза пока нет оценок.</div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
