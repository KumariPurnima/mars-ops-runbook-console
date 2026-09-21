'use client';

import type { Incident } from '@/lib/seed';

const COLUMNS: { id: Incident['column']; label: string }[] = [
  { id: 'triggered', label: 'Triggered' },
  { id: 'investigating', label: 'Investigating' },
  { id: 'mitigating', label: 'Mitigating' },
  { id: 'resolved', label: 'Resolved' },
];

const SEV_STYLE: Record<string, string> = {
  'SEV-1': 'bg-red/15 text-red border-red/40',
  'SEV-2': 'bg-amber/15 text-amber border-amber/40',
  'SEV-3': 'bg-blue/15 text-blue border-blue/40',
};

export function IncidentBoard({
  incidents,
  selected,
  onSelect,
}: {
  incidents: Incident[];
  selected?: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {COLUMNS.map((col) => {
        const items = incidents.filter((t) => t.column === col.id);
        return (
          <div key={col.id} className="rounded-lg bg-panel border border-edge p-2.5 min-h-[170px]">
            <div className="flex items-center justify-between px-0.5 pb-2.5">
              <span className="text-sm font-semibold uppercase tracking-wider text-muted">
                {col.label}
              </span>
              <span className="text-sm text-subtle">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((t) => (
                <button
                  key={t.key}
                  onClick={() => onSelect(t.key)}
                  aria-current={selected === t.key}
                  className={`w-full text-left rounded-md border p-2.5 transition ${
                    selected === t.key
                      ? 'border-do-blue bg-do-blue/10'
                      : 'border-edge bg-raised hover:border-edge-hi'
                  }`}
                >
                  <div className="flex items-center gap-2 pb-1.5 flex-wrap">
                    <span className="mono text-sm text-blue">{t.key}</span>
                    <span className={`mono text-xs px-1.5 py-px rounded border ${SEV_STYLE[t.severity]}`}>
                      {t.severity}
                    </span>
                  </div>
                  <div className="text-base leading-snug text-primary">{t.summary}</div>
                  <div className="pt-1.5 text-sm text-muted mono">{t.service}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
