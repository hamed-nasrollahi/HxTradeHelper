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
}

export interface Strategy {
  id: number;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
}

export interface TradeExtreme {
  profit: number;
  symbol: string;
  date: string;
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
  | "week"
  | "weekday"
  | "hour"
  | "direction";

export interface TradeFilters {
  from?: string;
  to?: string;
  symbol?: string;
  strategyId?: string; // number, or "none" for unassigned
  direction?: string; // Buy / Sell
}
