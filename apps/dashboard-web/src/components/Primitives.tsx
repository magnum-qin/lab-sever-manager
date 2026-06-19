import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function MetricCell({ label, value, caption, changed = false }: { label: string; value: string | number; caption?: string; changed?: boolean }) {
  return (
    <div className={`flex flex-col w-full min-w-0 transition-colors duration-300 rounded p-0.5 ${changed ? 'bg-slate-150' : ''}`}>
      <span className="text-sm font-bold text-slate-800 leading-tight">{value}</span>
      {caption ? (
        <span className="text-[10px] text-slate-400 mt-1 truncate" title={caption}>
          {caption}
        </span>
      ) : null}
    </div>
  );
}

export function ProgressMetric({ label, value, caption, percent = 0 }: { label: string; value: string | number; caption?: string; percent?: number }) {
  // Determine color based on threshold (emerald for low, amber for medium, rose for high)
  let barColor = 'bg-indigo-600';
  if (percent <= 65) {
    barColor = 'bg-emerald-500';
  } else if (percent <= 85) {
    barColor = 'bg-amber-500';
  } else {
    barColor = 'bg-rose-500';
  }

  return (
    <div className="flex flex-col w-full min-w-0">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{label}</span>
        <span className="text-xs font-bold text-slate-800">{value}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden relative" aria-hidden="true">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={false}
          animate={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        />
      </div>
      {caption ? (
        <span className="text-[10px] text-slate-400 mt-1 truncate" title={caption}>
          {caption}
        </span>
      ) : null}
    </div>
  );
}

export function StatusPill({ state }: { state: string }) {
  const label = state === 'idle' ? 'idle' : state === 'busy' ? 'busy' : 'down';
  const badgeColors = {
    idle: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    busy: 'text-amber-700 bg-amber-50 border-amber-200',
    down: 'text-rose-700 bg-rose-50 border-rose-200'
  };
  return (
    <span className={`inline-flex items-center gap-x-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border ${badgeColors[label]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${label === 'idle' ? 'bg-emerald-500' : label === 'busy' ? 'bg-amber-500' : 'bg-rose-500'}`} />
      <span className="capitalize">{label}</span>
    </span>
  );
}

export function Card({ children, className = '', decorationColor = 'none' }: { children: ReactNode; className?: string; decorationColor?: 'green' | 'amber' | 'red' | 'blue' | 'none' }) {
  const decorationClasses = {
    none: '',
    green: 'border-t-2 border-t-emerald-500',
    amber: 'border-t-2 border-t-amber-500',
    red: 'border-t-2 border-t-rose-500',
    blue: 'border-t-2 border-t-indigo-600'
  };
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${decorationClasses[decorationColor]} ${className}`}>
      {children}
    </section>
  );
}

export function Sparkline({ points, strokeColor = '#4f46e5' }: { points: number[]; strokeColor?: string }) {
  const width = 300;
  const height = 65;
  if (points.length < 2) {
    return (
      <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-400 font-mono italic">
        Gathering trend metrics...
      </div>
    );
  }

  const minVal = 0;
  const maxVal = 100;
  const range = maxVal - minVal;

  const pathPoints = points.map((val, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((val - minVal) / range) * (height - 8) - 4; // leave margin
    return { x, y };
  });

  const pathD = `M ${pathPoints.map(p => `${p.x} ${p.y}`).join(' L ')}`;
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
  const gradId = `grad-${strokeColor.replace('#', '')}`;

  return (
    <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.15} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LineChart({
  points,
  strokeColor = '#4f46e5',
  pollSeconds = 2
}: {
  points: number[];
  strokeColor?: string;
  pollSeconds?: number;
}) {
  const width = 360;
  const height = 140;

  const paddingLeft = 32;
  const paddingRight = 8;
  const paddingTop = 8;
  const paddingBottom = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxPoints = Math.max(2, Math.ceil(60 / pollSeconds));
  const L = points.length;
  // Pad with null on the left so we always represent maxPoints (60s total)
  const paddedPoints = L < maxPoints ? Array(maxPoints - L).fill(null).concat(points) : points.slice(L - maxPoints);

  const pathPoints = paddedPoints.map((val, i) => {
    if (val === null || val === undefined) return null;
    const x = paddingLeft + (i / (maxPoints - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (val / 100) * chartHeight;
    return { x, y };
  }).filter((p): p is { x: number; y: number } => p !== null);

  const pathD = pathPoints.length >= 2 ? `M ${pathPoints.map((p) => `${p.x} ${p.y}`).join(' L ')}` : '';
  
  let areaD = '';
  if (pathPoints.length >= 2) {
    const firstPoint = pathPoints[0];
    const lastPoint = pathPoints[pathPoints.length - 1];
    areaD = `${pathD} L ${lastPoint.x} ${paddingTop + chartHeight} L ${firstPoint.x} ${paddingTop + chartHeight} Z`;
  }

  const gradId = `grad-${strokeColor.replace('#', '')}`;
  const gridLevels = [0, 25, 50, 75, 100];

  return (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.15} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      
      {/* Grid Lines and Y-axis labels */}
      {gridLevels.map((level) => {
        const y = paddingTop + chartHeight - (level / 100) * chartHeight;
        return (
          <g key={level}>
            {/* Grid Line */}
            <line
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            {/* Y-axis text label (only show 0, 50, 100 for clean look) */}
            {(level === 0 || level === 50 || level === 100) && (
              <text
                x={paddingLeft - 6}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] fill-slate-400 font-mono font-medium"
              >
                {level}%
              </text>
            )}
          </g>
        );
      })}

      {/* X and Y axes solid lines */}
      <line
        x1={paddingLeft}
        y1={paddingTop}
        x2={paddingLeft}
        y2={paddingTop + chartHeight}
        stroke="#cbd5e1"
        strokeWidth={1}
      />
      <line
        x1={paddingLeft}
        y1={paddingTop + chartHeight}
        x2={width - paddingRight}
        y2={paddingTop + chartHeight}
        stroke="#cbd5e1"
        strokeWidth={1}
      />

      {/* X-axis labels (Fixed at 60s, 30s, now) */}
      <text
        x={paddingLeft}
        y={height - 4}
        textAnchor="start"
        className="text-[9px] fill-slate-400 font-mono font-medium"
      >
        -60s
      </text>
      <text
        x={paddingLeft + chartWidth / 2}
        y={height - 4}
        textAnchor="middle"
        className="text-[9px] fill-slate-400 font-mono font-medium"
      >
        -30s
      </text>
      <text
        x={width - paddingRight}
        y={height - 4}
        textAnchor="end"
        className="text-[9px] fill-slate-400 font-mono font-medium"
      >
        now
      </text>

      {/* Line area and path (only if we have >= 2 points) */}
      {pathPoints.length >= 2 && (
        <>
          <path d={areaD} fill={`url(#${gradId})`} />
          <path d={pathD} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {/* Single dot representation if we only have 1 data point */}
      {pathPoints.length === 1 && (
        <circle cx={pathPoints[0].x} cy={pathPoints[0].y} r="2.5" fill={strokeColor} />
      )}
    </svg>
  );
}
