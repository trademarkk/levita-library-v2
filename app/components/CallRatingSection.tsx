import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ExternalLink, X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useLibrary } from '../domain/LibraryContext';
import { formatDate } from '../domain/labels';
import type { CallReview, ExpenseStudio } from '../domain/types';

const studioLabels: Record<ExpenseStudio, string> = {
  STAVROPOLSKAYA: 'Ставропольская',
  MACHUGI: 'Мачуги',
};

type RatingScope = 'all' | 'studio' | 'admin';

type ChartPointSelection = {
  review: CallReview;
  x: number;
  y: number;
  containerWidth: number;
};

type RatingDotProps = {
  cx?: number;
  cy?: number;
  payload?: CallReview;
  selected?: boolean;
  onSelect: (review: CallReview, x: number, y: number) => void;
};

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return 'Месяц не выбран';
  return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function scoreLabel(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function adminNamesFrom(reviews: CallReview[]) {
  return Array.from(new Set(reviews.map((review) => review.adminName).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function ChartCallCard({ point, onClose }: { point: ChartPointSelection | null; onClose: () => void }) {
  if (!point) return null;
  const { review, x, y, containerWidth } = point;
  const placeBelow = y < 150;
  const cardWidth = Math.min(360, Math.max(270, containerWidth - 32));
  const left = Math.min(Math.max(16, x - cardWidth / 2), Math.max(16, containerWidth - cardWidth - 16));

  return (
    <div
      className="absolute z-20 rounded-xl border border-[#c9a98d]/25 bg-[#1a1820]/95 p-4 text-sm shadow-2xl backdrop-blur"
      style={{
        width: `${cardWidth}px`,
        left: `${left}px`,
        top: `${placeBelow ? y + 18 : y - 18}px`,
        transform: placeBelow ? undefined : 'translateY(-100%)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[#c9a98d]">{formatDate(review.reviewedAt)}</p>
          <h3 className="mt-1 text-base text-[#f5f3f0]">{review.adminName}</h3>
        </div>
        <button onClick={onClose} className="text-[#a89b8f] hover:text-[#f5f3f0]" aria-label="Закрыть карточку звонка">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 space-y-1 text-[#a89b8f]">
        <p>Баллы за звонок: <span className="text-[#f5f3f0]">{scoreLabel(review.score)}</span></p>
        <p>Студия: {studioLabels[review.studio]}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {review.amoCrmDealUrl && (
          <a href={review.amoCrmDealUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[#c9a98d] hover:text-[#f5f3f0]">
            <ExternalLink className="h-4 w-4" />
            Сделка amoCRM
          </a>
        )}
      </div>
    </div>
  );
}

function RatingDot({ cx, cy, payload, selected, onSelect }: RatingDotProps) {
  if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) return null;
  const select = () => onSelect(payload, cx, cy);

  return (
    <g className="cursor-pointer" onMouseEnter={select} onClick={select} onFocus={select} tabIndex={0} role="button" aria-label={`${payload.adminName}: ${scoreLabel(payload.score)} баллов`}>
      <circle cx={cx} cy={cy} r={16} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={selected ? 10 : 7}
        fill="#c9a98d"
        stroke={selected ? '#f5f3f0' : '#1a1820'}
        strokeWidth={2}
        pointerEvents="none"
      />
    </g>
  );
}

export function CallRatingSection() {
  const { state, refreshSlice } = useLibrary();
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useState<RatingScope>('all');
  const [studio, setStudio] = useState<ExpenseStudio>('STAVROPOLSKAYA');
  const [adminName, setAdminName] = useState('');
  const availableMonths = useMemo(() => {
    const currentMonth = monthKey(todayKey());
    const months = Array.from(new Set([currentMonth, ...state.callReviews.map((review) => monthKey(review.reviewedAt))])).sort((left, right) => right.localeCompare(left));
    return months.length ? months : [currentMonth];
  }, [state.callReviews]);
  const [selectedMonth, setSelectedMonth] = useState(() => availableMonths[0] ?? monthKey(todayKey()));
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [chartPoint, setChartPoint] = useState<ChartPointSelection | null>(null);

  useEffect(() => {
    void refreshSlice('ratings', { month: selectedMonth });
  }, [selectedMonth]);

  const monthReviews = useMemo(
    () => state.callReviews.filter((review) => monthKey(review.reviewedAt) === selectedMonth),
    [selectedMonth, state.callReviews],
  );
  const adminNames = useMemo(() => adminNamesFrom(monthReviews), [monthReviews]);

  useEffect(() => {
    if (adminName && !adminNames.includes(adminName)) setAdminName('');
  }, [adminName, adminNames]);

  const filtered = useMemo(() => {
    const targetAdmin = adminName || adminNames[0] || '';
    return [...monthReviews]
      .filter((review) => {
        if (scope === 'studio') return review.studio === studio;
        if (scope === 'admin') return review.adminName === targetAdmin;
        return true;
      })
      .sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt) || left.updatedAt.localeCompare(right.updatedAt));
  }, [adminName, adminNames, monthReviews, scope, studio]);

  const average = filtered.length ? filtered.reduce((sum, review) => sum + review.score, 0) / filtered.length : 0;
  const maxScore = Math.max(100, ...filtered.map((review) => review.score));
  const yMax = maxScore <= 100 ? 100 : Math.ceil(maxScore / 10) * 10;
  const activeChartPoint = chartPoint && filtered.some((review) => review.id === chartPoint.review.id) ? chartPoint : null;

  const clearSelection = () => {
    setSelectedReviewId(null);
    setChartPoint(null);
  };

  const selectChartPoint = (review: CallReview, x: number, y: number) => {
    setSelectedReviewId(review.id);
    setChartPoint({
      review,
      x,
      y,
      containerWidth: chartAreaRef.current?.clientWidth ?? 900,
    });
  };

  return (
    <div className="space-y-5">
      <GlassCard>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#c9a98d]">Качество звонков</p>
            <h2 className="mt-1 text-2xl text-[#f5f3f0]">Рейтинг звонков</h2>
            <p className="mt-2 text-sm text-[#a89b8f]">
              Данные приходят из levita-calls. График показывает баллы по разборам звонков: X - дни, Y - итоговая оценка.
            </p>
          </div>
          <button onClick={() => void refreshSlice('ratings', { month: selectedMonth })} className="soft-action self-start xl:self-auto">
            Обновить из базы
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <label className="text-sm text-[#a89b8f]">
            Месяц
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                setSelectedMonth(event.target.value || monthKey(todayKey()));
                clearSelection();
              }}
              className="field mt-2"
            />
          </label>
          <label className="text-sm text-[#a89b8f]">
            Срез
            <select value={scope} onChange={(event) => { setScope(event.target.value as RatingScope); clearSelection(); }} className="field mt-2">
              <option value="all">Общий</option>
              <option value="studio">По студии</option>
              <option value="admin">По администратору</option>
            </select>
          </label>
          <label className="text-sm text-[#a89b8f]">
            Студия
            <select value={studio} onChange={(event) => { setStudio(event.target.value as ExpenseStudio); clearSelection(); }} disabled={scope !== 'studio'} className="field mt-2 disabled:opacity-45">
              <option value="STAVROPOLSKAYA">Ставропольская</option>
              <option value="MACHUGI">Мачуги</option>
            </select>
          </label>
          <label className="text-sm text-[#a89b8f]">
            Администратор
            <select value={adminName || adminNames[0] || ''} onChange={(event) => { setAdminName(event.target.value); clearSelection(); }} disabled={scope !== 'admin'} className="field mt-2 disabled:opacity-45">
              {adminNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#c9a98d]/15 bg-[#2a2630]/45 p-4">
            <p className="text-xs text-[#a89b8f]">Разборов за месяц</p>
            <p className="mt-1 text-2xl text-[#f5f3f0]">{filtered.length}</p>
            <p className="mt-1 text-xs text-[#a89b8f]">{monthLabel(selectedMonth)}</p>
          </div>
          <div className="rounded-xl border border-[#c9a98d]/15 bg-[#2a2630]/45 p-4">
            <p className="text-xs text-[#a89b8f]">Средний балл</p>
            <p className="mt-1 text-2xl text-[#f5f3f0]">{filtered.length ? scoreLabel(average) : '-'}</p>
          </div>
          <div className="rounded-xl border border-[#c9a98d]/15 bg-[#2a2630]/45 p-4">
            <p className="text-xs text-[#a89b8f]">Последний разбор</p>
            <p className="mt-1 text-2xl text-[#f5f3f0]">{filtered.length ? formatDate(filtered[filtered.length - 1].reviewedAt) : '-'}</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div ref={chartAreaRef} className="relative h-[25rem]">
          {filtered.length ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filtered} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="rgba(201,169,141,0.12)" vertical={false} />
                  <XAxis dataKey="reviewedAt" tickFormatter={(value) => formatDate(String(value)).replace(/\s2026 г\./, '')} stroke="#a89b8f" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, yMax]} stroke="#a89b8f" tick={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#c9a98d"
                    strokeWidth={3}
                    dot={(props) => {
                      const { key: dotKey, ...dotProps } = props as RatingDotProps & { key?: string };
                      return (
                        <RatingDot
                          key={dotKey}
                          {...dotProps}
                          selected={props.payload?.id === selectedReviewId}
                          onSelect={selectChartPoint}
                        />
                      );
                    }}
                    activeDot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              <ChartCallCard point={activeChartPoint} onClose={() => setChartPoint(null)} />
            </>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl bg-[#2a2630]/45 text-[#a89b8f]">
              Для выбранного среза пока нет разборов звонков.
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

