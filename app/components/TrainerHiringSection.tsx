import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileCheck2,
  RefreshCcw,
  Save,
  UserPlus,
  X,
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useLibrary } from '../domain/LibraryContext';
import type { TrainerCertificationResult, TrainerHiringCandidate } from '../domain/types';

type CandidateDraft = Omit<TrainerHiringCandidate, 'id' | 'createdAt' | 'updatedAt' | 'rejectedAt' | 'createdById'>;
type StepTone = 'done' | 'attention' | 'idle' | 'danger';
type CandidateFilter = 'all' | 'active' | 'rejected';

const HIRING_STEPS_TOTAL = 12;

const emptyDraft: CandidateDraft = {
  fullName: '',
  status: 'active',
  videoIntroApproved: null,
  primaryDocumentsReceived: false,
  ndaSigned: false,
  ndaLink: null,
  introZoomScheduled: false,
  introZoomDate: null,
  introZoomTime: null,
  secondCertificationPreparationZoomScheduled: false,
  secondCertificationPreparationZoomDate: null,
  secondCertificationPreparationZoomTime: null,
  secondCertificationScheduled: false,
  secondCertificationDate: null,
  secondCertificationTime: null,
  secondCertificationResult: 'pending',
  secondCertificationRetakeDate: null,
  trainingsVisitedAfterSecondCertification: false,
  mediaCollected: false,
  thirdCertificationScheduled: false,
  thirdCertificationDate: null,
  thirdCertificationTime: null,
  thirdCertificationResult: 'pending',
  thirdCertificationPreparationZoomDate: null,
  thirdCertificationPreparationZoomTime: null,
  workingHoursAssigned: false,
  firstShiftDate: null,
};

const filterLabels: Record<CandidateFilter, string> = {
  all: 'Все',
  active: 'В работе',
  rejected: 'Отказ',
};

function draftFromCandidate(candidate: TrainerHiringCandidate): CandidateDraft {
  return {
    fullName: candidate.fullName,
    status: candidate.status,
    videoIntroApproved: candidate.videoIntroApproved ?? null,
    primaryDocumentsReceived: candidate.primaryDocumentsReceived,
    ndaSigned: candidate.ndaSigned,
    ndaLink: candidate.ndaLink ?? null,
    introZoomScheduled: candidate.introZoomScheduled,
    introZoomDate: candidate.introZoomDate ?? null,
    introZoomTime: candidate.introZoomTime ?? null,
    secondCertificationPreparationZoomScheduled: Boolean(candidate.secondCertificationPreparationZoomScheduled),
    secondCertificationPreparationZoomDate: candidate.secondCertificationPreparationZoomDate ?? null,
    secondCertificationPreparationZoomTime: candidate.secondCertificationPreparationZoomTime ?? null,
    secondCertificationScheduled: candidate.secondCertificationScheduled,
    secondCertificationDate: candidate.secondCertificationDate ?? null,
    secondCertificationTime: candidate.secondCertificationTime ?? null,
    secondCertificationResult: candidate.secondCertificationResult,
    secondCertificationRetakeDate: candidate.secondCertificationRetakeDate ?? null,
    trainingsVisitedAfterSecondCertification: candidate.trainingsVisitedAfterSecondCertification,
    mediaCollected: candidate.mediaCollected,
    thirdCertificationScheduled: candidate.thirdCertificationScheduled,
    thirdCertificationDate: candidate.thirdCertificationDate ?? null,
    thirdCertificationTime: candidate.thirdCertificationTime ?? null,
    thirdCertificationResult: candidate.thirdCertificationResult === 'passed' || candidate.thirdCertificationResult === 'failed' ? candidate.thirdCertificationResult : 'pending',
    thirdCertificationPreparationZoomDate: candidate.thirdCertificationPreparationZoomDate ?? null,
    thirdCertificationPreparationZoomTime: candidate.thirdCertificationPreparationZoomTime ?? null,
    workingHoursAssigned: candidate.workingHoursAssigned,
    firstShiftDate: candidate.firstShiftDate ?? null,
  };
}

function dateOrNull(value: string) {
  return value || null;
}

function timeOrNull(value: string) {
  return value || null;
}

function completedSteps(draft: CandidateDraft) {
  const steps = [
    draft.videoIntroApproved !== null,
    draft.primaryDocumentsReceived,
    draft.ndaSigned && Boolean(draft.ndaLink?.trim()),
    draft.introZoomScheduled && Boolean(draft.introZoomDate) && Boolean(draft.introZoomTime),
    draft.secondCertificationPreparationZoomScheduled && Boolean(draft.secondCertificationPreparationZoomDate) && Boolean(draft.secondCertificationPreparationZoomTime),
    draft.secondCertificationScheduled
      && Boolean(draft.secondCertificationDate)
      && Boolean(draft.secondCertificationTime)
      && draft.secondCertificationResult !== 'pending'
      && (draft.secondCertificationResult !== 'failed' || Boolean(draft.secondCertificationRetakeDate)),
    draft.trainingsVisitedAfterSecondCertification,
    draft.mediaCollected,
    Boolean(draft.thirdCertificationPreparationZoomDate) && Boolean(draft.thirdCertificationPreparationZoomTime),
    draft.thirdCertificationScheduled && Boolean(draft.thirdCertificationDate) && Boolean(draft.thirdCertificationTime) && draft.thirdCertificationResult !== 'pending',
    draft.workingHoursAssigned,
    Boolean(draft.firstShiftDate),
  ];
  return steps.filter(Boolean).length;
}

function formatShortDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(date);
}

function formatDateTime(date?: string | null, time?: string | null) {
  if (!date && !time) return '';
  if (date && time) return `${formatShortDate(date)}, ${time}`;
  if (date) return formatShortDate(date);
  return time ?? '';
}

function certificationResultLabel(value: TrainerCertificationResult) {
  if (value === 'passed') return 'сдана';
  if (value === 'failed') return 'не сдана';
  return 'результат не отмечен';
}

function stepTone(complete: boolean, attention = false, danger = false): StepTone {
  if (danger) return 'danger';
  if (complete) return 'done';
  if (attention) return 'attention';
  return 'idle';
}

function stepMeta(draft: CandidateDraft) {
  const ndaHasLink = Boolean(draft.ndaLink?.trim());
  const introHasDateTime = Boolean(draft.introZoomDate && draft.introZoomTime);
  const prep2HasDateTime = Boolean(draft.secondCertificationPreparationZoomDate && draft.secondCertificationPreparationZoomTime);
  const secondHasDateTime = Boolean(draft.secondCertificationDate && draft.secondCertificationTime);
  const secondFailedWithoutRetake = draft.secondCertificationResult === 'failed' && !draft.secondCertificationRetakeDate;
  const prep3HasDateTime = Boolean(draft.thirdCertificationPreparationZoomDate && draft.thirdCertificationPreparationZoomTime);
  const thirdHasDateTime = Boolean(draft.thirdCertificationDate && draft.thirdCertificationTime);

  return [
    {
      index: 1,
      title: 'Видео визитка',
      summary: draft.videoIntroApproved === null ? 'решение ещё не принято' : draft.videoIntroApproved ? 'видео одобрено' : 'видео не одобрено',
      tone: stepTone(draft.videoIntroApproved !== null, false, draft.videoIntroApproved === false),
    },
    {
      index: 2,
      title: 'Первичные документы',
      summary: draft.primaryDocumentsReceived ? 'документы получены' : 'ожидаем документы',
      tone: stepTone(draft.primaryDocumentsReceived),
    },
    {
      index: 3,
      title: 'НДА',
      summary: draft.ndaSigned ? (ndaHasLink ? 'подписан, ссылка добавлена' : 'подписан, нужна ссылка') : 'НДА не подписан',
      tone: stepTone(draft.ndaSigned && ndaHasLink, draft.ndaSigned && !ndaHasLink),
    },
    {
      index: 4,
      title: 'Зум-знакомство',
      summary: draft.introZoomScheduled ? (introHasDateTime ? formatDateTime(draft.introZoomDate, draft.introZoomTime) : 'назначен, укажите дату и время') : 'не назначен',
      tone: stepTone(draft.introZoomScheduled && introHasDateTime, draft.introZoomScheduled && !introHasDateTime),
    },
    {
      index: 5,
      title: 'Подготовка к 2 аттестации',
      summary: draft.secondCertificationPreparationZoomScheduled ? (prep2HasDateTime ? formatDateTime(draft.secondCertificationPreparationZoomDate, draft.secondCertificationPreparationZoomTime) : 'назначена, укажите дату и время') : 'не назначена',
      tone: stepTone(draft.secondCertificationPreparationZoomScheduled && prep2HasDateTime, draft.secondCertificationPreparationZoomScheduled && !prep2HasDateTime),
    },
    {
      index: 6,
      title: 'Вторая аттестация',
      summary: draft.secondCertificationScheduled
        ? `${secondHasDateTime ? formatDateTime(draft.secondCertificationDate, draft.secondCertificationTime) : 'укажите дату и время'} · ${certificationResultLabel(draft.secondCertificationResult)}`
        : 'не назначена',
      tone: stepTone(
        draft.secondCertificationScheduled && secondHasDateTime && draft.secondCertificationResult !== 'pending' && !secondFailedWithoutRetake,
        draft.secondCertificationScheduled && (!secondHasDateTime || draft.secondCertificationResult === 'pending' || secondFailedWithoutRetake),
        draft.secondCertificationResult === 'failed' && !draft.secondCertificationRetakeDate,
      ),
    },
    {
      index: 7,
      title: 'Посещение тренировок',
      summary: draft.trainingsVisitedAfterSecondCertification ? 'тренировки посещены' : 'ожидаем посещение',
      tone: stepTone(draft.trainingsVisitedAfterSecondCertification),
    },
    {
      index: 8,
      title: 'Фото и видео для клиентов/CRM',
      summary: draft.mediaCollected ? 'материалы собраны' : 'материалы не собраны',
      tone: stepTone(draft.mediaCollected),
    },
    {
      index: 9,
      title: 'Подготовка к 3 аттестации',
      summary: prep3HasDateTime ? formatDateTime(draft.thirdCertificationPreparationZoomDate, draft.thirdCertificationPreparationZoomTime) : 'укажите дату и время подготовки',
      tone: stepTone(prep3HasDateTime),
    },
    {
      index: 10,
      title: 'Третья аттестация',
      summary: draft.thirdCertificationScheduled
        ? `${thirdHasDateTime ? formatDateTime(draft.thirdCertificationDate, draft.thirdCertificationTime) : 'укажите дату и время'} · ${certificationResultLabel(draft.thirdCertificationResult)}`
        : 'не назначена',
      tone: stepTone(draft.thirdCertificationScheduled && thirdHasDateTime && draft.thirdCertificationResult !== 'pending', draft.thirdCertificationScheduled && (!thirdHasDateTime || draft.thirdCertificationResult === 'pending'), draft.thirdCertificationResult === 'failed'),
    },
    {
      index: 11,
      title: 'Рабочие часы',
      summary: draft.workingHoursAssigned ? 'часы распределены' : 'часы не распределены',
      tone: stepTone(draft.workingHoursAssigned),
    },
    {
      index: 12,
      title: 'Первая смена',
      summary: draft.firstShiftDate ? formatShortDate(draft.firstShiftDate) : 'дата первой смены не указана',
      tone: stepTone(Boolean(draft.firstShiftDate)),
    },
  ];
}

function toneClasses(tone: StepTone) {
  if (tone === 'done') return {
    border: 'border-[#5e6d58]/55',
    bg: 'bg-[#5e6d58]/14',
    text: 'text-[#d8e0d2]',
    dot: 'bg-[#7f9a70]',
    label: 'готово',
    icon: CheckCircle2,
  };
  if (tone === 'attention') return {
    border: 'border-[#c9a98d]/55',
    bg: 'bg-[#c9a98d]/12',
    text: 'text-[#dec8b6]',
    dot: 'bg-[#c9a98d]',
    label: 'нужно дополнить',
    icon: AlertCircle,
  };
  if (tone === 'danger') return {
    border: 'border-[#8b3a52]/60',
    bg: 'bg-[#8b3a52]/15',
    text: 'text-[#f0c5cf]',
    dot: 'bg-[#b65370]',
    label: 'проблема',
    icon: AlertCircle,
  };
  return {
    border: 'border-[#4d3f3a]',
    bg: 'bg-[#1c1820]',
    text: 'text-[#a89b8f]',
    dot: 'bg-[#61515b]',
    label: 'не заполнено',
    icon: Clock3,
  };
}

function StatusPill({ tone }: { tone: StepTone }) {
  const classes = toneClasses(tone);
  const Icon = classes.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${classes.border} ${classes.bg} ${classes.text}`}>
      <Icon className="h-3.5 w-3.5" />
      {classes.label}
    </span>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-[#c9a98d] first:mt-0">{children}</p>;
}

function ChoiceGroup<T extends string>({
  disabled,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  value: T;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
              active
                ? 'border-[#c9a98d] bg-[#c9a98d]/24 text-[#f5f3f0]'
                : 'border-[#c9a98d]/18 text-[#a89b8f] hover:border-[#c9a98d]/45 hover:bg-[#2a2630]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function BooleanChoice({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <ChoiceGroup
      disabled={disabled}
      value={checked ? 'yes' : 'no'}
      onChange={(value) => onChange(value === 'yes')}
      options={[
        { value: 'yes', label: 'Да' },
        { value: 'no', label: 'Нет' },
      ]}
    />
  );
}

function DateTimeInputs({
  dateValue,
  disabled,
  onDateChange,
  onTimeChange,
  timeValue,
}: {
  dateValue?: string | null;
  disabled?: boolean;
  onDateChange: (value: string | null) => void;
  onTimeChange: (value: string | null) => void;
  timeValue?: string | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <input type="date" value={dateValue ?? ''} disabled={disabled} onChange={(event) => onDateChange(dateOrNull(event.target.value))} className="field" />
      <input type="time" value={timeValue ?? ''} disabled={disabled} onChange={(event) => onTimeChange(timeOrNull(event.target.value))} className="field" />
    </div>
  );
}

function HiringStepCard({
  children,
  index,
  summary,
  title,
  tone,
}: {
  children: React.ReactNode;
  index: number;
  summary: string;
  title: string;
  tone: StepTone;
}) {
  const classes = toneClasses(tone);
  return (
    <section className={`rounded-2xl border ${classes.border} ${classes.bg} p-4 transition-colors`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${classes.dot} text-sm font-bold text-[#0f0e12]`}>
            {index}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[#f5f3f0]">{title}</h3>
            <p className="mt-1 text-sm text-[#a89b8f]">{summary}</p>
          </div>
        </div>
        <StatusPill tone={tone} />
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function CandidateDetailsCard({ candidate, onClose }: { candidate: TrainerHiringCandidate; onClose: () => void }) {
  const { updateTrainerHiringCandidate, rejectTrainerHiringCandidate, isSaving } = useLibrary();
  const originalDraft = useMemo(() => draftFromCandidate(candidate), [candidate]);
  const [draft, setDraft] = useState<CandidateDraft>(() => originalDraft);

  useEffect(() => {
    setDraft(originalDraft);
  }, [originalDraft]);

  const steps = useMemo(() => stepMeta(draft), [draft]);
  const isRejected = draft.status === 'rejected';
  const done = completedSteps(draft);
  const progress = Math.round((done / HIRING_STEPS_TOTAL) * 100);
  const dirty = JSON.stringify(draft) !== JSON.stringify(originalDraft);
  const nextStep = steps.find((step) => step.tone !== 'done') ?? null;

  const setField = <Key extends keyof CandidateDraft>(key: Key, value: CandidateDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    if (!draft.fullName.trim() || isRejected) return;
    updateTrainerHiringCandidate(candidate.id, draft);
  };

  const reject = () => {
    setDraft((current) => ({ ...current, status: 'rejected' }));
    rejectTrainerHiringCandidate(candidate.id);
  };

  return (
    <GlassCard className={isRejected ? 'opacity-60 grayscale' : ''}>
      <div className="mb-6 border-b border-[#c9a98d]/12 pb-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#c9a98d]">Карточка кандидата</p>
            <input
              value={draft.fullName}
              disabled={isRejected}
              onChange={(event) => setField('fullName', event.target.value)}
              className="field max-w-2xl text-2xl font-semibold text-[#f5f3f0]"
              placeholder="ФИ кандидата"
            />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isRejected ? 'bg-[#5a2f3d] text-[#f0c5cf]' : 'bg-[#324535] text-[#cfe8cf]'}`}>
                {isRejected ? 'Кандидату отказано' : 'В работе'}
              </span>
              <span className="rounded-full border border-[#c9a98d]/20 px-3 py-1 text-xs font-semibold text-[#d8c7b7]">
                {done}/{HIRING_STEPS_TOTAL} этапов
              </span>
              {dirty && !isRejected && <span className="rounded-full border border-[#c9a98d]/35 bg-[#c9a98d]/12 px-3 py-1 text-xs font-semibold text-[#dec8b6]">Есть несохранённые изменения</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={save}
              disabled={isRejected || !draft.fullName.trim() || !dirty || isSaving}
              className="primary-action inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving && dirty ? 'Сохраняем...' : 'Сохранить'}
            </button>
            {!isRejected && (
              <button type="button" onClick={reject} className="secondary-action inline-flex items-center gap-2 text-[#f0c5cf]">
                <Ban className="h-4 w-4" />
                Кандидату отказано
              </button>
            )}
            <button type="button" onClick={onClose} className="secondary-action inline-flex items-center gap-2">
              <X className="h-4 w-4" />
              Закрыть
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="h-3 overflow-hidden rounded-full bg-[#2b2430]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#c9a98d] to-[#8f6f63] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-sm text-[#a89b8f]">Общий прогресс: {progress}%</p>
          </div>
          <div className="rounded-xl border border-[#c9a98d]/18 bg-[#2a2630]/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c9a98d]">Следующий фокус</p>
            <p className="mt-1 text-sm text-[#f5f3f0]">{nextStep ? `${nextStep.index}. ${nextStep.title}` : 'Воронка полностью заполнена'}</p>
          </div>
        </div>
      </div>

      <SectionLabel>Старт и документы</SectionLabel>
      <div className="grid gap-4 xl:grid-cols-2">
        <HiringStepCard index={1} title="Просмотр видео визитки" summary={steps[0].summary} tone={steps[0].tone}>
          <ChoiceGroup
            disabled={isRejected}
            value={draft.videoIntroApproved === null ? 'pending' : draft.videoIntroApproved ? 'approved' : 'rejected'}
            onChange={(value) => setField('videoIntroApproved', value === 'pending' ? null : value === 'approved')}
            options={[
              { value: 'pending', label: 'Ждёт решения' },
              { value: 'approved', label: 'Одобрена' },
              { value: 'rejected', label: 'Не одобрена' },
            ]}
          />
        </HiringStepCard>

        <HiringStepCard index={2} title="Получение первичных документов" summary={steps[1].summary} tone={steps[1].tone}>
          <BooleanChoice checked={draft.primaryDocumentsReceived} disabled={isRejected} onChange={(value) => setField('primaryDocumentsReceived', value)} />
        </HiringStepCard>

        <HiringStepCard index={3} title="Подписание НДА" summary={steps[2].summary} tone={steps[2].tone}>
          <BooleanChoice checked={draft.ndaSigned} disabled={isRejected} onChange={(value) => setDraft((current) => ({ ...current, ndaSigned: value, ndaLink: value ? current.ndaLink : null }))} />
          <div className="flex gap-3">
            <input
              value={draft.ndaLink ?? ''}
              disabled={isRejected || !draft.ndaSigned}
              onChange={(event) => setField('ndaLink', event.target.value)}
              className="field"
              placeholder="Ссылка на подписанный НДА"
            />
            {draft.ndaLink && (
              <a href={draft.ndaLink} target="_blank" rel="noreferrer" className="secondary-action inline-flex items-center justify-center" aria-label="Открыть НДА">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </HiringStepCard>
      </div>

      <SectionLabel>Зумы и вторая аттестация</SectionLabel>
      <div className="grid gap-4">
        <HiringStepCard index={4} title="Зум-знакомство" summary={steps[3].summary} tone={steps[3].tone}>
          <BooleanChoice checked={draft.introZoomScheduled} disabled={isRejected} onChange={(value) => setDraft((current) => ({ ...current, introZoomScheduled: value, introZoomDate: value ? current.introZoomDate : null, introZoomTime: value ? current.introZoomTime : null }))} />
          <DateTimeInputs
            dateValue={draft.introZoomDate}
            timeValue={draft.introZoomTime}
            disabled={isRejected || !draft.introZoomScheduled}
            onDateChange={(value) => setField('introZoomDate', value)}
            onTimeChange={(value) => setField('introZoomTime', value)}
          />
        </HiringStepCard>

        <HiringStepCard index={5} title="Зум-подготовка к 2 аттестации" summary={steps[4].summary} tone={steps[4].tone}>
          <BooleanChoice checked={draft.secondCertificationPreparationZoomScheduled} disabled={isRejected} onChange={(value) => setDraft((current) => ({
            ...current,
            secondCertificationPreparationZoomScheduled: value,
            secondCertificationPreparationZoomDate: value ? current.secondCertificationPreparationZoomDate : null,
            secondCertificationPreparationZoomTime: value ? current.secondCertificationPreparationZoomTime : null,
          }))} />
          <DateTimeInputs
            dateValue={draft.secondCertificationPreparationZoomDate}
            timeValue={draft.secondCertificationPreparationZoomTime}
            disabled={isRejected || !draft.secondCertificationPreparationZoomScheduled}
            onDateChange={(value) => setField('secondCertificationPreparationZoomDate', value)}
            onTimeChange={(value) => setField('secondCertificationPreparationZoomTime', value)}
          />
        </HiringStepCard>

        <HiringStepCard index={6} title="Вторая аттестация" summary={steps[5].summary} tone={steps[5].tone}>
          <BooleanChoice checked={draft.secondCertificationScheduled} disabled={isRejected} onChange={(value) => setDraft((current) => ({
            ...current,
            secondCertificationScheduled: value,
            secondCertificationDate: value ? current.secondCertificationDate : null,
            secondCertificationTime: value ? current.secondCertificationTime : null,
            secondCertificationResult: value ? current.secondCertificationResult : 'pending',
            secondCertificationRetakeDate: value ? current.secondCertificationRetakeDate : null,
          }))} />
          <DateTimeInputs
            dateValue={draft.secondCertificationDate}
            timeValue={draft.secondCertificationTime}
            disabled={isRejected || !draft.secondCertificationScheduled}
            onDateChange={(value) => setField('secondCertificationDate', value)}
            onTimeChange={(value) => setField('secondCertificationTime', value)}
          />
          <ChoiceGroup
            disabled={isRejected || !draft.secondCertificationScheduled}
            value={draft.secondCertificationResult}
            onChange={(result) => setDraft((current) => ({ ...current, secondCertificationResult: result, secondCertificationRetakeDate: result === 'failed' ? current.secondCertificationRetakeDate : null }))}
            options={[
              { value: 'pending', label: 'Не отмечена' },
              { value: 'passed', label: 'Сдана' },
              { value: 'failed', label: 'Не сдана' },
            ]}
          />
          {draft.secondCertificationResult === 'failed' && (
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#d8c7b7]">Дата пересдачи</span>
              <input
                type="date"
                value={draft.secondCertificationRetakeDate ?? ''}
                disabled={isRejected}
                onChange={(event) => setField('secondCertificationRetakeDate', dateOrNull(event.target.value))}
                className="field"
              />
            </label>
          )}
        </HiringStepCard>

      </div>

      <SectionLabel>Практика и материалы</SectionLabel>
      <div className="grid gap-4 xl:grid-cols-2">
        <HiringStepCard index={7} title="Посещение тренировок после 2 аттестации" summary={steps[6].summary} tone={steps[6].tone}>
          <BooleanChoice checked={draft.trainingsVisitedAfterSecondCertification} disabled={isRejected} onChange={(value) => setField('trainingsVisitedAfterSecondCertification', value)} />
        </HiringStepCard>

        <HiringStepCard index={8} title="Фото и видео для клиентов и CRM" summary={steps[7].summary} tone={steps[7].tone}>
          <BooleanChoice checked={draft.mediaCollected} disabled={isRejected} onChange={(value) => setField('mediaCollected', value)} />
        </HiringStepCard>
      </div>

      <SectionLabel>Финальный выход</SectionLabel>
      <div className="grid gap-4 xl:grid-cols-2">
        <HiringStepCard index={9} title="Зум-подготовка к 3 аттестации" summary={steps[8].summary} tone={steps[8].tone}>
          <DateTimeInputs
            dateValue={draft.thirdCertificationPreparationZoomDate}
            timeValue={draft.thirdCertificationPreparationZoomTime}
            disabled={isRejected}
            onDateChange={(value) => setField('thirdCertificationPreparationZoomDate', value)}
            onTimeChange={(value) => setField('thirdCertificationPreparationZoomTime', value)}
          />
        </HiringStepCard>

        <HiringStepCard index={10} title="Третья аттестация" summary={steps[9].summary} tone={steps[9].tone}>
          <BooleanChoice checked={draft.thirdCertificationScheduled} disabled={isRejected} onChange={(value) => setDraft((current) => ({
            ...current,
            thirdCertificationScheduled: value,
            thirdCertificationDate: value ? current.thirdCertificationDate : null,
            thirdCertificationTime: value ? current.thirdCertificationTime : null,
            thirdCertificationResult: value ? current.thirdCertificationResult : 'pending',
          }))} />
          <DateTimeInputs
            dateValue={draft.thirdCertificationDate}
            timeValue={draft.thirdCertificationTime}
            disabled={isRejected || !draft.thirdCertificationScheduled}
            onDateChange={(value) => setField('thirdCertificationDate', value)}
            onTimeChange={(value) => setField('thirdCertificationTime', value)}
          />
          <ChoiceGroup
            disabled={isRejected || !draft.thirdCertificationScheduled}
            value={draft.thirdCertificationResult}
            onChange={(value) => setField('thirdCertificationResult', value)}
            options={[
              { value: 'pending', label: 'Не отмечена' },
              { value: 'passed', label: 'Сдана' },
              { value: 'failed', label: 'Не сдана' },
            ]}
          />
        </HiringStepCard>

        <HiringStepCard index={11} title="Распределение рабочих часов" summary={steps[10].summary} tone={steps[10].tone}>
          <BooleanChoice checked={draft.workingHoursAssigned} disabled={isRejected} onChange={(value) => setField('workingHoursAssigned', value)} />
        </HiringStepCard>

        <HiringStepCard index={12} title="Дата первой рабочей смены" summary={steps[11].summary} tone={steps[11].tone}>
          <input
            type="date"
            value={draft.firstShiftDate ?? ''}
            disabled={isRejected}
            onChange={(event) => setField('firstShiftDate', dateOrNull(event.target.value))}
            className="field"
          />
        </HiringStepCard>
      </div>
    </GlassCard>
  );
}

function CandidateSummaryCard({
  candidate,
  isSelected,
  onOpen,
}: {
  candidate: TrainerHiringCandidate;
  isSelected: boolean;
  onOpen: () => void;
}) {
  const draft = draftFromCandidate(candidate);
  const done = completedSteps(draft);
  const progress = Math.round((done / HIRING_STEPS_TOTAL) * 100);
  const isRejected = candidate.status === 'rejected';
  const nextStep = stepMeta(draft).find((step) => step.tone !== 'done');

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={isSelected}
      className={`group rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#c9a98d] hover:bg-[#2a2328] ${
        isSelected ? 'border-[#c9a98d] bg-[#2a2328]' : 'border-[#c9a98d]/20 bg-[#1a1820]/70'
      } ${isRejected ? 'opacity-60 grayscale' : ''}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold text-[#f5f3f0]">{candidate.fullName}</p>
          <p className="mt-1 text-sm text-[#a89b8f]">{isRejected ? 'Процесс остановлен' : `Готово: ${done} из ${HIRING_STEPS_TOTAL}`}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${isRejected ? 'bg-[#5a2f3d] text-[#f0c5cf]' : 'bg-[#324535] text-[#cfe8cf]'}`}>
          {isRejected ? 'Отказ' : 'В работе'}
        </span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#2b2430]">
        <div className="h-full rounded-full bg-[#c9a98d] transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="mb-4 text-sm text-[#a89b8f]">
        {nextStep && !isRejected ? `Следующий шаг: ${nextStep.index}. ${nextStep.title}` : isRejected ? 'Кандидату отказано' : 'Воронка заполнена'}
      </p>
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#d8b99f]">
        Открыть карточку
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </button>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#c9a98d]/16 bg-[#1a1820]/72 p-4">
      <p className="text-2xl font-semibold text-[#f5f3f0]">{value}</p>
      <p className="mt-1 text-sm text-[#a89b8f]">{label}</p>
    </div>
  );
}

export function TrainerHiringSection() {
  const { state, createTrainerHiringCandidate, refreshSlice } = useLibrary();
  const [fullName, setFullName] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CandidateFilter>('all');
  const [query, setQuery] = useState('');

  const candidates = useMemo(() => [...state.trainerHiringCandidates].sort((left, right) => {
    if (left.status !== right.status) return left.status === 'active' ? -1 : 1;
    return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
  }), [state.trainerHiringCandidates]);

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return candidates.filter((candidate) => {
      const statusMatches = filter === 'all' || candidate.status === filter;
      const queryMatches = !normalizedQuery || candidate.fullName.toLowerCase().includes(normalizedQuery);
      return statusMatches && queryMatches;
    });
  }, [candidates, filter, query]);

  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null;
  const activeCount = candidates.filter((candidate) => candidate.status === 'active').length;
  const rejectedCount = candidates.length - activeCount;
  const averageProgress = candidates.length
    ? Math.round(candidates.reduce((sum, candidate) => sum + completedSteps(draftFromCandidate(candidate)), 0) / (candidates.length * HIRING_STEPS_TOTAL) * 100)
    : 0;

  useEffect(() => {
    if (selectedCandidateId && !selectedCandidate) setSelectedCandidateId(null);
  }, [selectedCandidate, selectedCandidateId]);

  const createCandidate = () => {
    if (!fullName.trim()) return;
    createTrainerHiringCandidate({ ...emptyDraft, fullName: fullName.trim() });
    setFullName('');
    setFilter('active');
  };

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <div className="mb-4 flex items-start gap-3">
              <UserPlus className="mt-1 h-6 w-6 text-[#c9a98d]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c9a98d]">Найм тренеров</p>
                <h2 className="mt-1 text-2xl text-[#f5f3f0]">Приём тренера</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a89b8f]">
                  Единая воронка от видео визитки до первой смены. Откройте карточку кандидата, отмечайте шаги по порядку и сохраните изменения одной кнопкой.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="кандидатов в работе" value={activeCount} />
              <MetricCard label="отказано" value={rejectedCount} />
              <MetricCard label="средний прогресс" value={`${averageProgress}%`} />
            </div>
          </div>

          <div className="rounded-2xl border border-[#c9a98d]/18 bg-[#2a2630]/45 p-4">
            <div className="mb-3 flex items-center gap-2 text-[#f5f3f0]">
              <FileCheck2 className="h-5 w-5 text-[#c9a98d]" />
              <h3 className="font-semibold">Добавить кандидата</h3>
            </div>
            <div className="space-y-3">
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="field" placeholder="ФИ нового кандидата" />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={createCandidate} disabled={!fullName.trim()} className="primary-action inline-flex flex-1 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <UserPlus className="h-4 w-4" />
                  Добавить
                </button>
                <button type="button" onClick={() => void refreshSlice('trainer-hiring')} className="secondary-action inline-flex items-center justify-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Обновить
                </button>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl text-[#f5f3f0]">Кандидаты</h3>
            <p className="mt-1 text-sm text-[#a89b8f]">Клик по карточке открывает подробную воронку кандидата.</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start">
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="field h-11 sm:w-64" placeholder="Поиск по имени" />
            <div className="flex flex-wrap gap-2">
              {(Object.keys(filterLabels) as CandidateFilter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    filter === item ? 'border-[#c9a98d] bg-[#c9a98d]/24 text-[#f5f3f0]' : 'border-[#c9a98d]/15 text-[#a89b8f] hover:bg-[#2a2630]'
                  }`}
                >
                  {filterLabels[item]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredCandidates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#c9a98d]/22 bg-[#1a1820]/55 p-6">
            <p className="text-[#a89b8f]">{candidates.length === 0 ? 'Кандидатов пока нет. Добавьте первого кандидата, чтобы начать вести воронку.' : 'По текущему фильтру кандидатов нет.'}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCandidates.map((candidate) => (
              <CandidateSummaryCard
                key={candidate.id}
                candidate={candidate}
                isSelected={candidate.id === selectedCandidateId}
                onOpen={() => setSelectedCandidateId(candidate.id)}
              />
            ))}
          </div>
        )}
      </GlassCard>

      {selectedCandidate && (
        <CandidateDetailsCard
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidateId(null)}
        />
      )}
    </div>
  );
}
