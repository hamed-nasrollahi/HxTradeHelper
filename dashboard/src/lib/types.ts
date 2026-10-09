export interface TradeRecord {
  id: number;
  account: number;
  position_id: number;
  symbol: string;
  type: string; // Buy / Sell
  result: string; // Win / Lose / BreakEven / Open
  rr: string | null; // planned R:R, e.g. "1:2.50"
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  close_price: number | null;
  profit: number;
  open_time: string;
  close_time: string | null;
  is_open: number;
  strategy_id: number | null;
  strategy_name: string | null;
  strategy_color: string | null;
  entry_correct: number; // 1 = correct trade to open, 0 = mistake
  exit_correct: number; // 1 = closed correctly, 0 = mistake
  mistake_id: number | null;
  mistake_name: string | null;
  note_ids: number[];
}

export interface Strategy {
  id: number;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
}

export interface Mistake {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  trade_count: number;
}

export interface Note {
  id: number;
  text: string;
  created_at: string;
  trade_count: number;
  backtest_count: number;
}

export interface AccountVisibility {
  account: number;
  visible: number; // 1 = shown in dropdowns/filters, 0 = hidden
}

export interface BacktestRecord extends TradeRecord {
  backtest_id: number;
  batch_id: string;
  trade_number: number;
  duration_min: number;
}

export interface BacktestBatch {
  id: number;
  batch_id: string;
  account: number;
  symbol: string;
  strategy_id: number | null;
  strategy_name: string | null;
  strategy_color: string | null;
  created_at: string;
  trade_count: number;
  /** trades already present in an earlier batch of the same strategy + symbol */
  duplicate_count: number;
}

export interface TradeExtreme {
  profit: number;
  symbol: string;
  date: string;
}

export interface LossStreak {
  count: number; // consecutive losing trades
  profit: number; // money lost over the streak (negative)
  r: number; // R lost over the streak, from the trades that have an R
  rTrades: number; // how many of the streak's trades have an R
  from: string; // first trade's close time
  to: string; // last trade's close time
}

export interface Summary {
  totalTrades: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number; // 0..100
  netProfit: number;
  grossProfit: number;
  grossLoss: number; // negative
  profitFactor: number | null;
  expectancy: number; // avg profit per trade
  avgWin: number;
  avgLoss: number; // negative
  payoffRatio: number | null; // avgWin / |avgLoss|
  biggestWin: TradeExtreme | null;
  biggestLoss: TradeExtreme | null;
  avgPlannedRR: number | null;
  maxDrawdown: number; // positive money amount
  longestWinStreak: number;
  longestLossStreak: number;
  worstLossStreak: LossStreak | null; // longest run of losses (ties: bigger loss)
  netR: number; // sum of R over trades with an R
  rTrades: number; // trades with an R (SL set and not at entry)
  maxDrawdownR: number | null; // peak-to-trough of the cumulative R curve
  currentStreak: number; // positive = wins, negative = losses
  activeDays: number;
  avgTradesPerDay: number;
}

export interface BreakdownGroup {
  key: string;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  avgProfit: number;
  biggestWin: number;
  biggestLoss: number;
  color?: string;
}

export interface MonthWinRate {
  key: string; // "2026-07"
  label: string; // "Jul 2026"
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null; // 0..100, null when the month has no decided trades
  netProfit: number;
}

export interface EquityPoint {
  time: string;
  equity: number;
  profit: number;
  symbol: string;
}

export type GroupDimension =
  | "strategy"
  | "symbol"
  | "month"
  | "monthOfYear"
  | "week"
  | "weekday"
  | "session"
  | "direction"
  | "mistake";

export interface TradeFilters {
  from?: string;
  to?: string;
  account?: string; // number, as string
  symbol?: string;
  strategyId?: string; // number, or "none" for unassigned
  direction?: string; // Buy / Sell
  noteIds?: string; // comma-separated note ids
  noteMatch?: string; // "all" = linked to every selected note, otherwise any
}

export interface NewsEvent {
  title: string;
  country: string; // currency code, e.g. "USD"
  date: string; // ISO 8601, UTC
  impact: string; // High / Medium
}
