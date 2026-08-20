import { BIAS_LABEL } from "@/lib/signal";
import type { Signal } from "@/lib/types";

export function biasColour(score: number): string {
  if (score >= 50) return "var(--up)";
  if (score >= 18) return "color-mix(in srgb, var(--up) 72%, var(--muted))";
  if (score <= -50) return "var(--down)";
  if (score <= -18) return "color-mix(in srgb, var(--down) 72%, var(--muted))";
  return "var(--muted)";
}

/** Compact -100..100 bar, centred on zero. */
export function SignalBar({ score }: { score: number }) {
  const half = Math.min(50, Math.abs(score) / 2);
  const colour = biasColour(score);

  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-2)]">
      <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--line)]" />
      <div
        className="absolute inset-y-0 rounded-full transition-all duration-500"
        style={{
          background: colour,
          left: score >= 0 ? "50%" : `${50 - half}%`,
          width: `${half}%`,
        }}
      />
    </div>
  );
}

export function SignalPanel({ signal }: { signal: Signal }) {
  const colour = biasColour(signal.score);

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted">Signal strength</h2>
        <span className="font-mono text-xs text-faint">
          {signal.confidence}% agreement
        </span>
      </div>

      <div className="mb-1 flex items-baseline gap-3">
        <span
          className="font-mono text-3xl font-semibold tabular-nums"
          style={{ color: colour }}
        >
          {signal.score > 0 ? "+" : ""}
          {signal.score}
        </span>
        <span className="text-sm font-medium" style={{ color: colour }}>
          {BIAS_LABEL[signal.bias]}
        </span>
      </div>

      <div className="mb-4 mt-3">
        <SignalBar score={signal.score} />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-faint">
          <span>−100</span>
          <span>0</span>
          <span>+100</span>
        </div>
      </div>

      <ul className="space-y-2.5 border-t border-line pt-3">
        {signal.components.map((c) => (
          <li key={c.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted">{c.label}</span>
              <span
                className="font-mono text-xs tabular-nums"
                style={{ color: biasColour(c.contribution) }}
              >
                {c.contribution > 0 ? "+" : ""}
                {c.contribution}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-faint">
              {c.note}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
