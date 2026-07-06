"use client";

import { useEffect, useState } from "react";
import Filters from "@/components/Filters";
import ErrorBanner from "@/components/ErrorBanner";
import { useMeta } from "@/components/useMeta";
import { filterQuery, fmtMoney, fmtNum, getJSON, profitColor, sendJSON } from "@/lib/client";
import { TradeFilters, TradeRecord } from "@/lib/types";

export default function TradesPage() {
  const { meta } = useMeta();
  const [filters, setFilters] = useState<TradeFilters>({});
  const [includeOpen, setIncludeOpen] = useState(true);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  const load = () => {
    getJSON<{ trades: TradeRecord[] }>(
      `/api/trades${filterQuery(filters, includeOpen ? { includeOpen: "1" } : {})}`
    )
      .then((r) => {
        setTrades(r.trades);
        setError(null);
      })
      .catch((e) => setError(e.message));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [filters, includeOpen]);

  const assign = async (trade: TradeRecord, strategyId: string) => {
    setSaving(trade.id);
    try {
      await sendJSON(`/api/trades/${trade.id}`, "PATCH", { strategyId: strategyId || null });
      setTrades((ts) =>
        ts.map((t) =>
          t.id === trade.id
            ? {
                ...t,
                strategy_id: strategyId ? Number(strategyId) : null,
                strategy_name: meta.strategies.find((s) => String(s.id) === strategyId)?.name || null,
              }
            : t
        )
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  const setReviewFlag = async (trade: TradeRecord, field: "entry_correct" | "exit_correct", value: boolean) => {
    const otherCorrect = !!(field === "entry_correct" ? trade.exit_correct : trade.entry_correct);
    const clearsMistake = value && otherCorrect;
    const patch: Record<string, unknown> = {
      [field === "entry_correct" ? "entryCorrect" : "exitCorrect"]: value,
    };
    if (clearsMistake) patch.mistakeId = null;
    setSaving(trade.id);
    try {
      await sendJSON(`/api/trades/${trade.id}`, "PATCH", patch);
      setTrades((ts) =>
        ts.map((t) =>
          t.id === trade.id
            ? {
                ...t,
                [field]: value ? 1 : 0,
                ...(clearsMistake ? { mistake_id: null, mistake_name: null } : {}),
              }
            : t
        )
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  const setMistake = async (trade: TradeRecord, mistakeId: string) => {
    setSaving(trade.id);
    try {
      await sendJSON(`/api/trades/${trade.id}`, "PATCH", { mistakeId: mistakeId || null });
      setTrades((ts) =>
        ts.map((t) =>
          t.id === trade.id
            ? {
                ...t,
                mistake_id: mistakeId ? Number(mistakeId) : null,
                mistake_name: meta.mistakes.find((m) => String(m.id) === mistakeId)?.name || null,
              }
            : t
        )
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Trades</h1>
      {error ? <ErrorBanner message={error} /> : null}
      <Filters filters={filters} onChange={setFilters} symbols={meta.symbols} strategies={meta.strategies} />
      <label className="mb-3 flex items-center gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
        <input type="checkbox" checked={includeOpen} onChange={(e) => setIncludeOpen(e.target.checked)} />
        Include open positions
      </label>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: "var(--ink-muted)" }}>
              <th className="px-3 py-2 font-medium">Closed</th>
              <th className="px-3 py-2 font-medium">Symbol</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Result</th>
              <th className="px-3 py-2 text-right font-medium">Entry</th>
              <th className="px-3 py-2 text-right font-medium">SL</th>
              <th className="px-3 py-2 text-right font-medium">TP</th>
              <th className="px-3 py-2 text-right font-medium">Close</th>
              <th className="px-3 py-2 text-right font-medium">R:R</th>
              <th className="px-3 py-2 text-right font-medium">Profit</th>
              <th className="px-3 py-2 font-medium">Strategy</th>
              <th className="px-3 py-2 text-center font-medium">Entry OK</th>
              <th className="px-3 py-2 text-center font-medium">Exit OK</th>
              <th className="px-3 py-2 font-medium">Mistake</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="tnum whitespace-nowrap px-3 py-2 text-xs" style={{ color: "var(--ink-2)" }}>
                  {(t.close_time || t.open_time).slice(0, 16)}
                </td>
                <td className="px-3 py-2 font-medium">{t.symbol}</td>
                <td className="px-3 py-2">{t.type}</td>
                <td className="px-3 py-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      color:
                        t.result === "Win" ? "var(--good-text)" : t.result === "Lose" ? "var(--bad-text)" : "var(--ink-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {t.result}
                  </span>
                </td>
                <td className="tnum px-3 py-2 text-right">{fmtNum(t.entry_price, 5)}</td>
                <td className="tnum px-3 py-2 text-right">{t.stop_loss ? fmtNum(t.stop_loss, 5) : "-"}</td>
                <td className="tnum px-3 py-2 text-right">{t.take_profit ? fmtNum(t.take_profit, 5) : "-"}</td>
                <td className="tnum px-3 py-2 text-right">{t.close_price ? fmtNum(t.close_price, 5) : "-"}</td>
                <td className="tnum px-3 py-2 text-right">{t.rr || "-"}</td>
                <td className="tnum px-3 py-2 text-right font-medium" style={{ color: profitColor(Number(t.profit)) }}>
                  {fmtMoney(Number(t.profit))}
                </td>
                <td className="px-3 py-2">
                  <select
                    className="input"
                    value={t.strategy_id ? String(t.strategy_id) : ""}
                    disabled={saving === t.id}
                    onChange={(e) => assign(t, e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {meta.strategies.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!t.entry_correct}
                    disabled={saving === t.id}
                    onChange={(e) => setReviewFlag(t, "entry_correct", e.target.checked)}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!t.exit_correct}
                    disabled={saving === t.id}
                    onChange={(e) => setReviewFlag(t, "exit_correct", e.target.checked)}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className="input"
                    value={t.mistake_id ? String(t.mistake_id) : ""}
                    disabled={saving === t.id || (!!t.entry_correct && !!t.exit_correct)}
                    onChange={(e) => setMistake(t, e.target.value)}
                  >
                    <option value="">
                      {t.entry_correct && t.exit_correct ? "-" : "Select mistake"}
                    </option>
                    {meta.mistakes.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {trades.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center" colSpan={14} style={{ color: "var(--ink-muted)" }}>
                  No trades in this range
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
