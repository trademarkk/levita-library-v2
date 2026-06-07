import { useEffect, useMemo, useState } from 'react';
import { Ban, CalendarDays, ChevronRight, ExternalLink, Save, UserPlus, X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useLibrary } from '../domain/LibraryContext';
import type { TrainerCertificationResult, TrainerHiringCandidate } from '../domain/types';

type CandidateDraft = Omit<TrainerHiringCandidate, 'id' | 'createdAt' | 'updatedAt' | 'rejectedAt' | 'createdById'>;
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

function BooleanField({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`flex items-center gap-3 rounded-lg border border-[#4d3f3a] bg-[#221d26] px-4 py-3 text-sm text-[#f5f3f0] ${disabled ? 'opacity-60' : 'cursor-pointer hover:border-[#c9a98d]'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 rounded accent-[#c9a98d]"
      />
      {label}
    </label>
  );
}

function CandidateDetailsCard({ candidate, onClose }: { candidate: TrainerHiringCandidate; onClose: () => void }) {
  const { updateTrainerHiringCandidate, rejectTrainerHiringCandidate, isSaving } = useLibrary();
  const [draft, setDraft] = useState<CandidateDraft>(() => draftFromCandidate(candidate));

  useEffect(() => {
    setDraft(draftFromCandidate(candidate));
  }, [candidate.id, candidate.updatedAt, candidate.status]);

  const isRejected = draft.status === 'rejected';
  const done = completedSteps(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFromCandidate(candidate));

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
    <GlassCard className={isRejected ? 'opacity-55 grayscale' : ''}>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <input
              value={draft.fullName}
              disabled={isRejected}
              onChange={(event) => setField('fullName', event.target.value)}
              className="field max-w-xl text-xl font-semibold text-[#f5f3f0]"
              placeholder="ФИ кандидата"
            />
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isRejected ? 'bg-[#5a2f3d] text-[#f0c5cf]' : 'bg-[#324535] text-[#cfe8cf]'}`}>
              {isRejected ? 'Отказ' : 'В работе'}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#2b2430]">
            <div className="h-full rounded-full bg-[#c9a98d] transition-all" style={{ width: `${Math.round((done / HIRING_STEPS_TOTAL) * 100)}%` }} />
          </div>
          <p className="mt-2 text-sm text-[#a89b8f]">Заполнено этапов: {done} из {HIRING_STEPS_TOTAL}</p>
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

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-[#4d3f3a] bg-[#1c1820] p-4">
          <label className="mb-2 block text-sm font-semibold text-[#d8c7b7]">1. Просмотр видео визитки</label>
          <select
            value={draft.videoIntroApproved === null ? 'pending' : draft.videoIntroApproved ? 'approved' : 'rejected'}
            disabled={isRejected}
            onChange={(event) => setField('videoIntroApproved', event.target.value === 'pending' ? null : event.target.value === 'approved')}
            className="field"
          >
            <option value="pending">Не принято решение</option>
            <option value="approved">Одобрена</option>
            <option value="rejected">Не одобрена</option>
          </select>
        </div>

        <div className="rounded-xl border border-[#4d3f3a] bg-[#1c1820] p-4">
          <label className="mb-2 block text-sm font-semibold text-[#d8c7b7]">2. Первичные документы</label>
          <BooleanField checked={draft.primaryDocumentsReceived} disabled={isRejected} label="Документы получены" onChange={(value) => setField('primaryDocumentsReceived', value)} />
        </div>

        <div className="rounded-xl border border-[#4d3f3a] bg-[#1c1820] p-4">
          <label className="mb-2 block text-sm font-semibold text-[#d8c7b7]">3. НДА с кандидатом</label>
          <BooleanField checked={draft.ndaSigned} disabled={isRejected} label="НДА подписан" onChange={(value) => setDraft((current) => ({ ...current, ndaSigned: value, ndaLink: value ? current.ndaLink : null }))} />
          <div className="mt-3 flex gap-3">
            <input
              value={draft.ndaLink ?? ''}
              disabled={isRejected || !draft.ndaSigned}
              onChange={(event) => setField('ndaLink', event.target.value)}
              className="field"
              placeholder="Ссылка на подписанный НДА"
            />
            {draft.ndaLink && (
              <a href={draft.ndaLink} target="_blank" rel="noreferrer" className="secondary-action inline-flex items-center justify-center">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#4d3f3a] bg-[#1c1820] p-4">
          <label className="mb-2 block text-sm font-semibold text-[#d8c7b7]">4. Зум-знакомство</label>
          <BooleanField checked={draft.introZoomScheduled} disabled={isRejected} label="Зум назначен" onChange={(value) => setDraft((current) => ({ ...current, introZoomScheduled: value, introZoomDate: value ? current.introZoomDate : null, introZoomTime: value ? current.introZoomTime : null }))} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={draft.introZoomDate ?? ''}
              disabled={isRejected || !draft.introZoomScheduled}
              onChange={(event) => setField('introZoomDate', dateOrNull(event.target.value))}
              className="field"
            />
            <input
              type="time"
              value={draft.introZoomTime ?? ''}
              disabled={isRejected || !draft.introZoomScheduled}
              onChange={(event) => setField('introZoomTime', timeOrNull(event.target.value))}
              className="field"
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#4d3f3a] bg-[#1c1820] p-4 xl:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-[#d8c7b7]">5. Зум-подготовка к 2 аттестации</label>
          <div className="grid gap-3 md:grid-cols-3">
            <BooleanField checked={draft.secondCertificationPreparationZoomScheduled} disabled={isRejected} label="Зум назначен" onChange={(value) => setDraft((current) => ({
              ...current,
              secondCertificationPreparationZoomScheduled: value,
              secondCertificationPreparationZoomDate: value ? current.secondCertificationPreparationZoomDate : null,
              secondCertificationPreparationZoomTime: value ? current.secondCertificationPreparationZoomTime : null,
            }))} />
            <input
              type="date"
              value={draft.secondCertificationPreparationZoomDate ?? ''}
              disabled={isRejected || !draft.secondCertificationPreparationZoomScheduled}
              onChange={(event) => setField('secondCertificationPreparationZoomDate', dateOrNull(event.target.value))}
              className="field"
            />
            <input
              type="time"
              value={draft.secondCertificationPreparationZoomTime ?? ''}
              disabled={isRejected || !draft.secondCertificationPreparationZoomScheduled}
              onChange={(event) => setField('secondCertificationPreparationZoomTime', timeOrNull(event.target.value))}
              className="field"
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#4d3f3a] bg-[#1c1820] p-4 xl:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-[#d8c7b7]">6. Вторая аттестация</label>
          <div className="grid gap-3 md:grid-cols-4">
            <BooleanField checked={draft.secondCertificationScheduled} disabled={isRejected} label="Аттестация назначена" onChange={(value) => setDraft((current) => ({
              ...current,
              secondCertificationScheduled: value,
              secondCertificationDate: value ? current.secondCertificationDate : null,
              secondCertificationTime: value ? current.secondCertificationTime : null,
              secondCertificationResult: value ? current.secondCertificationResult : 'pending',
              secondCertificationRetakeDate: value ? current.secondCertificationRetakeDate : null,
            }))} />
            <input
              type="date"
              value={draft.secondCertificationDate ?? ''}
              disabled={isRejected || !draft.secondCertificationScheduled}
              onChange={(event) => setField('secondCertificationDate', dateOrNull(event.target.value))}
              className="field"
            />
            <input
              type="time"
              value={draft.secondCertificationTime ?? ''}
              disabled={isRejected || !draft.secondCertificationScheduled}
              onChange={(event) => setField('secondCertificationTime', timeOrNull(event.target.value))}
              className="field"
            />
            <select
              value={draft.secondCertificationResult}
              disabled={isRejected || !draft.secondCertificationScheduled}
              onChange={(event) => {
                const result = event.target.value as TrainerCertificationResult;
                setDraft((current) => ({ ...current, secondCertificationResult: result, secondCertificationRetakeDate: result === 'failed' ? current.secondCertificationRetakeDate : null }));
              }}
              className="field"
            >
              <option value="pending">Сдача не отмечена</option>
              <option value="passed">Сдана</option>
              <option value="failed">Не сдана</option>
            </select>
          </div>
          {draft.secondCertificationResult === 'failed' && (
            <input
              type="date"
              value={draft.secondCertificationRetakeDate ?? ''}
              disabled={isRejected}
              onChange={(event) => setField('secondCertificationRetakeDate', dateOrNull(event.target.value))}
              className="field mt-3"
              aria-label="Дата пересдачи"
            />
          )}
        </div>

        <BooleanPanel title="7. Посещение тренировок после 2 аттестации" checked={draft.trainingsVisitedAfterSecondCertification} disabled={isRejected} label="Тренировки посещены" onChange={(value) => setField('trainingsVisitedAfterSecondCertification', value)} />
        <BooleanPanel title="8. Фото и видео для клиентов и CRM" checked={draft.mediaCollected} disabled={isRejected} label="Материалы собраны" onChange={(value) => setField('mediaCollected', value)} />

        <DateTimePanel title="9. Зум-подготовка к 3 аттестации" dateValue={draft.thirdCertificationPreparationZoomDate} timeValue={draft.thirdCertificationPreparationZoomTime} disabled={isRejected} onDateChange={(value) => setField('thirdCertificationPreparationZoomDate', value)} onTimeChange={(value) => setField('thirdCertificationPreparationZoomTime', value)} />

        <div className="rounded-xl border border-[#4d3f3a] bg-[#1c1820] p-4">
          <label className="mb-2 block text-sm font-semibold text-[#d8c7b7]">10. Третья аттестация</label>
          <BooleanField checked={draft.thirdCertificationScheduled} disabled={isRejected} label="Аттестация назначена" onChange={(value) => setDraft((current) => ({
            ...current,
            thirdCertificationScheduled: value,
            thirdCertificationDate: value ? current.thirdCertificationDate : null,
            thirdCertificationTime: value ? current.thirdCertificationTime : null,
            thirdCertificationResult: value ? current.thirdCertificationResult : 'pending',
          }))} />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input
              type="date"
              value={draft.thirdCertificationDate ?? ''}
              disabled={isRejected || !draft.thirdCertificationScheduled}
              onChange={(event) => setField('thirdCertificationDate', dateOrNull(event.target.value))}
              className="field"
            />
            <input
              type="time"
              value={draft.thirdCertificationTime ?? ''}
              disabled={isRejected || !draft.thirdCertificationScheduled}
              onChange={(event) => setField('thirdCertificationTime', timeOrNull(event.target.value))}
              className="field"
            />
            <select
              value={draft.thirdCertificationResult}
              disabled={isRejected || !draft.thirdCertificationScheduled}
              onChange={(event) => setField('thirdCertificationResult', event.target.value as TrainerCertificationResult)}
              className="field"
            >
              <option value="pending">Сдача не отмечена</option>
              <option value="passed">Сдана</option>
              <option value="failed">Не сдана</option>
            </select>
          </div>
        </div>

        <BooleanPanel title="11. Распределение рабочих часов" checked={draft.workingHoursAssigned} disabled={isRejected} label="Часы распределены" onChange={(value) => setField('workingHoursAssigned', value)} />
        <DatePanel title="12. Первая рабочая смена" value={draft.firstShiftDate} disabled={isRejected} onChange={(value) => setField('firstShiftDate', value)} />
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
  const done = completedSteps(draftFromCandidate(candidate));
  const isRejected = candidate.status === 'rejected';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group rounded-xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#c9a98d] hover:bg-[#2a2328] ${
        isSelected ? 'border-[#c9a98d] bg-[#2a2328]' : 'border-[#c9a98d]/20 bg-[#1a1820]/70'
      } ${isRejected ? 'opacity-60 grayscale' : ''}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold text-[#f5f3f0]">{candidate.fullName}</p>
          <p className="mt-1 text-sm text-[#a89b8f]">{isRejected ? 'Кандидату отказано' : `Этапов заполнено: ${done} из ${HIRING_STEPS_TOTAL}`}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${isRejected ? 'bg-[#5a2f3d] text-[#f0c5cf]' : 'bg-[#324535] text-[#cfe8cf]'}`}>
          {isRejected ? 'Отказ' : 'В работе'}
        </span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#2b2430]">
        <div className="h-full rounded-full bg-[#c9a98d] transition-all" style={{ width: `${Math.round((done / HIRING_STEPS_TOTAL) * 100)}%` }} />
      </div>
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#d8b99f]">
        Открыть карточку
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </button>
  );
}

function BooleanPanel(props: { title: string; checked: boolean; disabled?: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <div className="rounded-xl border border-[#4d3f3a] bg-[#1c1820] p-4">
      <label className="mb-2 block text-sm font-semibold text-[#d8c7b7]">{props.title}</label>
      <BooleanField {...props} />
    </div>
  );
}

function DatePanel({ disabled, onChange, title, value }: { disabled?: boolean; onChange: (value: string | null) => void; title: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-[#4d3f3a] bg-[#1c1820] p-4">
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#d8c7b7]">
        <CalendarDays className="h-4 w-4" />
        {title}
      </label>
      <input type="date" value={value ?? ''} disabled={disabled} onChange={(event) => onChange(dateOrNull(event.target.value))} className="field" />
    </div>
  );
}

function DateTimePanel({
  dateValue,
  disabled,
  onDateChange,
  onTimeChange,
  timeValue,
  title,
}: {
  dateValue?: string | null;
  disabled?: boolean;
  onDateChange: (value: string | null) => void;
  onTimeChange: (value: string | null) => void;
  timeValue?: string | null;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-[#4d3f3a] bg-[#1c1820] p-4">
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#d8c7b7]">
        <CalendarDays className="h-4 w-4" />
        {title}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <input type="date" value={dateValue ?? ''} disabled={disabled} onChange={(event) => onDateChange(dateOrNull(event.target.value))} className="field" />
        <input type="time" value={timeValue ?? ''} disabled={disabled} onChange={(event) => onTimeChange(timeOrNull(event.target.value))} className="field" />
      </div>
    </div>
  );
}

export function TrainerHiringSection() {
  const { state, createTrainerHiringCandidate, refreshSlice } = useLibrary();
  const [fullName, setFullName] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const candidates = useMemo(() => [...state.trainerHiringCandidates].sort((left, right) => {
    if (left.status !== right.status) return left.status === 'active' ? -1 : 1;
    return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
  }), [state.trainerHiringCandidates]);
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null;

  useEffect(() => {
    if (selectedCandidateId && !selectedCandidate) setSelectedCandidateId(null);
  }, [selectedCandidate, selectedCandidateId]);

  const createCandidate = () => {
    if (!fullName.trim()) return;
    createTrainerHiringCandidate({ ...emptyDraft, fullName: fullName.trim() });
    setFullName('');
  };

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="mb-5 flex items-start gap-3">
          <UserPlus className="mt-1 h-6 w-6 text-[#c9a98d]" />
          <div>
            <h2 className="text-2xl text-[#f5f3f0]">Приём тренера</h2>
            <p className="mt-1 text-sm text-[#a89b8f]">
              Воронка кандидата от видео визитки до первой рабочей смены. Изменения в карточке сохраняются только по кнопке «Сохранить».
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="field" placeholder="ФИ нового кандидата" />
          <button type="button" onClick={createCandidate} className="primary-action inline-flex items-center justify-center gap-2">
            <UserPlus className="h-4 w-4" />
            Добавить кандидата
          </button>
          <button type="button" onClick={() => void refreshSlice('trainer-hiring')} className="secondary-action">
            Обновить из базы
          </button>
        </div>
      </GlassCard>

      {candidates.length === 0 ? (
        <GlassCard>
          <p className="text-[#a89b8f]">Кандидатов пока нет. Добавьте первого кандидата, чтобы начать вести воронку.</p>
        </GlassCard>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {candidates.map((candidate) => (
              <CandidateSummaryCard
                key={candidate.id}
                candidate={candidate}
                isSelected={candidate.id === selectedCandidateId}
                onOpen={() => setSelectedCandidateId(candidate.id)}
              />
            ))}
          </div>

          {selectedCandidate && (
            <CandidateDetailsCard
              candidate={selectedCandidate}
              onClose={() => setSelectedCandidateId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
