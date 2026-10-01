/**
 * Sub-sessions between the vertical session lines hx_trade_helper.mq5 draws
 * (UpdateLines). Times are chart/server time as stored for trades, i.e. the
 * indicator's GMT times shifted +3h (13:30 GMT NY open -> 16:30 on chart;
 * its SummerTime input keeps that offset constant through the year).
 *
 * Lines:  Tokyo 04:00-09:00, London 10:00-18:30, New York 16:30-23:00,
 *         extra 02:30 03:00 07:00 08:00 08:30 18:00 20:00 20:30 21:00.
 * Each entry starts at a line and runs to the next one.
 */
const SESSIONS: { start: string; name: string }[] = [
  { start: "02:30", name: "Asia pre" },
  { start: "03:00", name: "Asia pre" },
  { start: "04:00", name: "Tokyo" },
  { start: "07:00", name: "Tokyo" },
  { start: "08:00", name: "Tokyo" },
  { start: "08:30", name: "Tokyo" },
  { start: "09:00", name: "London pre" },
  { start: "10:00", name: "London" },
  { start: "16:30", name: "London/NY" },
  { start: "18:00", name: "London/NY" },
  { start: "18:30", name: "New York" },
  { start: "20:00", name: "New York" },
  { start: "20:30", name: "New York" },
  { start: "21:00", name: "New York" },
  { start: "23:00", name: "After NY" }, // runs past midnight to 02:30
];

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Sub-session of a "YYYY-MM-DD HH:MM[:SS]" chart time; key sorts by start. */
export function sessionOf(time: string): { key: string; label: string } {
  const minute = toMin(time.slice(11, 16) || "00:00");
  // before the first line of the day it still belongs to the overnight block
  let idx = SESSIONS.length - 1;
  for (let i = 0; i < SESSIONS.length; i++)
    if (minute >= toMin(SESSIONS[i].start)) idx = i;
  const s = SESSIONS[idx];
  const end = SESSIONS[(idx + 1) % SESSIONS.length].start;
  return { key: s.start, label: `${s.name} ${s.start}–${end}` };
}
