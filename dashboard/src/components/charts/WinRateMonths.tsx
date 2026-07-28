"use client";

import { MonthWinRate } from "@/lib/types";
import { fmtMoney, fmtNum } from "@/lib/client";

/**
 * Win rate per month as horizontal meters. Magnitude on a bounded 0-100 scale,
 * so one sequential hue with a break-even reference at 50% - not the diverging
 * profit/loss pair, which encodes polarity.
 */
export default function WinRateMonths({ months }: { months: MonthWinRate[] }) {
  if (months.every((m) => m.trades === 0)) {
    return (
      <div className="flex h-32 items-center justify-center text-sm" style={{ color: "var(--ink-muted)" }}>
        No closed trades in this range
      </div>
    );
  }

  return (
    <div className="flex max-w-4xl flex-col gap-2.5">
      {months.map((m) => (
        <div
          key={m.key}
          className="flex items-center gap-3"
          title={
            m.trades === 0
              ? `${m.label}: no trades`
              : `${m.label}: ${fmtNum(m.winRate, 1)}% win rate · ${m.wins}W / ${m.losses}L of ${m.trades} trades · net ${fmtMoney(m.netProfit)}`
          }
        >
          <div className="w-20 shrink-0 whitespace-nowrap text-xs" style={{ color: "var(--ink-2)" }}>
            {m.label}
          </div>

          <div className="relative h-2 min-w-0 flex-1 rounded-full" style={{ background: "var(--grid)" }}>
            {m.winRate === null ? null : (
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${Math.max(m.winRate, 1.5)}%`, background: "var(--s1)" }}
              />
            )}
            <div
              className="absolute w-px"
              style={{ left: "50%", top: -3, bottom: -3, background: "var(--ink-muted)" }}
              title="50%"
            />
          </div>

          <div className="tnum w-16 shrink-0 text-right text-sm font-medium">
            {m.winRate === null ? "-" : `${fmtNum(m.winRate, 1)}%`}
          </div>
          <div className="tnum w-32 shrink-0 whitespace-nowrap text-right text-xs" style={{ color: "var(--ink-muted)" }}>
            {m.trades === 0 ? "no trades" : `${m.wins}W / ${m.losses}L · ${m.trades} trades`}
          </div>
        </div>
      ))}
    </div>
  );
}
