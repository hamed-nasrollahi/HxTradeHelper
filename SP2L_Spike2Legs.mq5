//+------------------------------------------------------------------+
//|                                             SP2L_Spike2Legs.mq5 |
//|                                Copyright 2026, Hamed Nasrollahi. |
//|                 https://github.com/hamed-nasrollahi/HxTradeHelper |
//+------------------------------------------------------------------+
//  SP2L "Spike 2 Legs" price-action setup indicator for MetaTrader 5.
//
//  Rebuilt from scratch by reverse-engineering the drawing data of the
//  TradingView "SP2L Pour Samadi [TradingFinder]" indicator against
//  1-minute US30 price data (125/125 exported setups reproduced with
//  exact entry / stop / target prices). See SP2L_README.md for the
//  derivation and for which parts are exact vs. approximated.
//
//  Core algorithm (all verified exactly against the reference data):
//    * A "leg" is a maximal sequence of strictly LOWER HIGHS (sell)
//      or strictly HIGHER LOWS (buy) ending at the entry bar.
//    * Entry     = high (sell) / low (buy) of the last bar of the
//      sequence; the signal fires on the next bar, when price touches
//      that level (which is also what breaks the sequence).
//    * Wave (A)  = highest high (sell) / lowest low (buy) of the first
//      bar of the sequence and the bar before it.
//    * Stop-loss = A +/- SLThreshold * ATR(AtrPeriod)  (Wilder ATR,
//      sampled on the signal bar).
//    * Take-profit = entry -/+ risk * RiskReward, where risk includes
//      the threshold when IncludeThresholdInRR is set.
//    * Validity  = sequence length >= MinSpikeBars and
//      |A - sequence extreme| >= MovementPower * ATR(AtrPeriod)
//      sampled at the sequence start bar.
#property copyright "Copyright 2026, Hamed Nasrollahi. CC BY-NC-SA 4.0"
#property link      "https://github.com/hamed-nasrollahi/HxTradeHelper"
#property description "SP2L Spike-2-Legs setup detector (entry / SL / TP lines)"
#property version   "1.0"
#property strict
#property indicator_chart_window
#property indicator_buffers 0
#property indicator_plots   0

//--- gap handling inside the sequence
enum ENUM_SP2L_GAP_MODE
  {
   SP2L_GAP_ALL = 0,     // All Gaps (no gap restriction)
   SP2L_GAP_REQUIRED = 1 // Require a gap inside the sequence
  };

//--- what is displayed
enum ENUM_SP2L_DISPLAY
  {
   SP2L_DISPLAY_SETUP = 0, // Setup (entry + SL + TP + 50% lines)
   SP2L_DISPLAY_SIGNAL = 1 // Signal (arrow only)
  };

//=== Spike filter | movement ==========================================
input int    MinSpikeBars        = 3;     // Minimum Spike Bars
input bool   UseMovementPower    = true;  // Movement Power filter
input double MovementPower       = 3.5;   // Movement Power (x ATR)

//=== Spike filter | gap ===============================================
input bool   UseGapFilter        = true;              // Gap Filter
input ENUM_SP2L_GAP_MODE GapMode = SP2L_GAP_ALL;      // Gap mode

//=== Spike filter | doji ==============================================
input bool   DojiTolerance       = true;  // Doji Tolerance
input double MaxDojiBodyRatio    = 0.35;  // Max Doji Body Ratio (body/range)
input double MaxDojiInSpikeRatio = 0.5;   // Max Doji in Spike Ratio

//=== Trend detection ==================================================
input bool   TrendDetection      = false; // Trend Detection
input double TrendMaxDojiBody    = 0.5;   // Max Doji Body Ratio (trend)
input int    TrendLookback       = 35;    // Candle Lookback
input double TrendMaxDojiRatio   = 0.5;   // Max Doji in Trend Ratio

//=== Position management ==============================================
input bool   UseSLThreshold      = true;  // Stop-Loss Threshold
input double SLThreshold         = 0.2;   // Stop-Loss Threshold (x ATR)
input double RiskReward          = 1.0;   // Risk-Reward Ratio
input bool   IncludeThresholdInRR= true;  // Include Stop-Loss Threshold in R:R
input bool   OnePositionAtATime  = false; // Suppress new setups while one is active

//=== Display ==========================================================
input ENUM_SP2L_DISPLAY DisplayMode = SP2L_DISPLAY_SETUP; // Display Mode
input bool   OnlyLastPosition    = false;         // Only Display the Last Position
input int    AtrPeriod           = 100;           // ATR period (Wilder)
input int    HistoryBars         = 3000;          // Bars to scan on attach
input int    MaxSequenceBars     = 60;            // Safety cap on sequence walk-back
input color  EntryColor          = clrDodgerBlue; // Entry line
input color  HalfColor           = clrGray;       // 50% line
input color  SlColor             = clrOrangeRed;  // Stop-loss line
input color  TpColor             = clrLimeGreen;  // Take-profit line
input int    LineWidth           = 1;             // Line width
input bool   ShowLabels          = true;          // Price labels on lines

//=== Alert ============================================================
input bool   AlertsOn            = true;  // Alert (live bars only)
input bool   PushOn              = false; // Push notification

//----------------------------------------------------------------------
#define SP2L_PREFIX "SP2L_"

struct SP2LSetup
  {
   bool              active;     // still extending / position unresolved
   bool              isSell;
   datetime          startTime;
   double            entry;
   double            half;
   double            sl;
   double            tp;
   string            tag;        // object-name suffix
  };

int        g_atrHandle   = INVALID_HANDLE;
datetime   g_lastBarTime = 0;
bool       g_history     = false; // backfill done
SP2LSetup  g_setups[];

//+------------------------------------------------------------------+
int OnInit()
  {
   g_atrHandle = iATR(_Symbol, _Period, AtrPeriod);
   if(g_atrHandle == INVALID_HANDLE)
     {
      Print("SP2L: failed to create ATR handle");
      return(INIT_FAILED);
     }
   return(INIT_SUCCEEDED);
  }
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(0, SP2L_PREFIX);
   if(g_atrHandle != INVALID_HANDLE)
      IndicatorRelease(g_atrHandle);
  }
//+------------------------------------------------------------------+
double Atr(const int shift)
  {
   double buf[1];
   if(CopyBuffer(g_atrHandle, 0, shift, 1, buf) != 1)
      return(0.0);
   return(buf[0]);
  }
//+------------------------------------------------------------------+
bool IsDoji(const int shift, const double maxBodyRatio)
  {
   double rng = iHigh(_Symbol, _Period, shift) - iLow(_Symbol, _Period, shift);
   if(rng <= 0.0)
      return(true);
   double body = MathAbs(iClose(_Symbol, _Period, shift) - iOpen(_Symbol, _Period, shift));
   return(body <= maxBodyRatio * rng);
  }
//+------------------------------------------------------------------+
//| Gap between bar `shift` and the previous bar (shift+1)            |
//+------------------------------------------------------------------+
bool HasGap(const int shift)
  {
   double o  = iOpen(_Symbol, _Period, shift);
   double pc = iClose(_Symbol, _Period, shift + 1);
   return(MathAbs(o - pc) > _Point / 2.0);
  }
//+------------------------------------------------------------------+
//| Optional trend filter: net direction over TrendLookback bars      |
//| before the signal bar. Bars whose body is below TrendMaxDojiBody  |
//| count as neutral; the signal direction must match the majority    |
//| direction and neutral bars must stay below TrendMaxDojiRatio.     |
//+------------------------------------------------------------------+
bool TrendAllows(const bool isSell, const int sigShift)
  {
   if(!TrendDetection)
      return(true);
   int up = 0, dn = 0, doji = 0;
   for(int i = sigShift; i < sigShift + TrendLookback; i++)
     {
      if(IsDoji(i, TrendMaxDojiBody)) { doji++; continue; }
      if(iClose(_Symbol, _Period, i) > iOpen(_Symbol, _Period, i)) up++;
      else dn++;
     }
   if(doji > TrendMaxDojiRatio * TrendLookback)
      return(false);
   return(isSell ? dn > up : up > dn);
  }
//+------------------------------------------------------------------+
//| Detect a setup with signal bar at `sigShift` (its previous bar,   |
//| sigShift+1, is the entry-level bar). Fills `st` on success.       |
//+------------------------------------------------------------------+
bool Detect(const bool isSell, const int sigShift, SP2LSetup &st)
  {
   const int entryShift = sigShift + 1; // last bar of the HL/LH sequence

   // trigger: the signal bar must touch the entry level (which also
   // means the strict lower-high / higher-low sequence just ended)
   if(isSell)
     {
      if(iHigh(_Symbol, _Period, sigShift) < iHigh(_Symbol, _Period, entryShift))
         return(false);
     }
   else
     {
      if(iLow(_Symbol, _Period, sigShift) > iLow(_Symbol, _Period, entryShift))
         return(false);
     }

   // walk back the strict sequence: bar k belongs while its high is
   // below the previous bar's high (sell) / its low above the previous
   // bar's low (buy)
   int k = entryShift;
   while(k - entryShift < MaxSequenceBars)
     {
      if(isSell)
        {
         if(iHigh(_Symbol, _Period, k) < iHigh(_Symbol, _Period, k + 1))
            k++;
         else
            break;
        }
      else
        {
         if(iLow(_Symbol, _Period, k) > iLow(_Symbol, _Period, k + 1))
            k++;
         else
            break;
        }
     }
   const int seqStart = k;                    // first bar of the sequence
   const int nBars    = seqStart - entryShift + 1;
   if(nBars < MinSpikeBars)
      return(false);

   // wave point A: extreme of the sequence's first bar and the bar before
   double A;
   if(isSell)
      A = MathMax(iHigh(_Symbol, _Period, seqStart), iHigh(_Symbol, _Period, seqStart + 1));
   else
      A = MathMin(iLow(_Symbol, _Period, seqStart), iLow(_Symbol, _Period, seqStart + 1));

   // movement power: |A - sequence extreme| vs ATR at the sequence start
   double extreme = isSell ? DBL_MAX : -DBL_MAX;
   for(int i = entryShift; i <= seqStart; i++)
     {
      if(isSell) extreme = MathMin(extreme, iLow(_Symbol, _Period, i));
      else       extreme = MathMax(extreme, iHigh(_Symbol, _Period, i));
     }
   if(UseMovementPower)
     {
      double atrStart = Atr(seqStart);
      if(atrStart <= 0.0 || MathAbs(A - extreme) < MovementPower * atrStart)
         return(false);
     }

   // doji filter over the sequence
   if(DojiTolerance)
     {
      int dojis = 0;
      for(int i = entryShift; i <= seqStart; i++)
         if(IsDoji(i, MaxDojiBodyRatio))
            dojis++;
      if(dojis > MaxDojiInSpikeRatio * nBars)
         return(false);
     }
   else
     {
      for(int i = entryShift; i <= seqStart; i++)
         if(IsDoji(i, MaxDojiBodyRatio))
            return(false);
     }

   // gap filter
   if(UseGapFilter && GapMode == SP2L_GAP_REQUIRED)
     {
      bool gap = false;
      for(int i = entryShift; i < seqStart; i++)
         if(HasGap(i)) { gap = true; break; }
      if(!gap)
         return(false);
     }

   if(!TrendAllows(isSell, sigShift))
      return(false);

   // levels
   double entry = isSell ? iHigh(_Symbol, _Period, entryShift)
                         : iLow(_Symbol, _Period, entryShift);
   double th    = UseSLThreshold ? SLThreshold * Atr(sigShift) : 0.0;
   double sl    = isSell ? A + th : A - th;
   double riskForRR = IncludeThresholdInRR ? MathAbs(entry - sl)
                                           : MathAbs(entry - A);
   double tp    = isSell ? entry - riskForRR * RiskReward
                         : entry + riskForRR * RiskReward;

   st.active    = true;
   st.isSell    = isSell;
   st.startTime = iTime(_Symbol, _Period, entryShift);
   st.entry     = entry;
   st.half      = (entry + sl) / 2.0;
   st.sl        = sl;
   st.tp        = tp;
   st.tag       = TimeToString(st.startTime, TIME_DATE | TIME_MINUTES) + (isSell ? "_S" : "_B");
   StringReplace(st.tag, ":", "");
   StringReplace(st.tag, ".", "");
   StringReplace(st.tag, " ", "_");
   return(true);
  }
//+------------------------------------------------------------------+
void DrawLine(const string name, const datetime t1, const datetime t2,
              const double price, const color clr, const string label)
  {
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_TREND, 0, t1, price, t2, price);
      ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, LineWidth);
      ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_BACK, true);
      ObjectSetString(0, name, OBJPROP_TOOLTIP, label + " " + DoubleToString(price, _Digits));
     }
   else
      ObjectSetInteger(0, name, OBJPROP_TIME, 1, t2);
  }
//+------------------------------------------------------------------+
void DrawLabel(const string name, const datetime t, const double price,
               const color clr, const string text)
  {
   if(!ShowLabels)
      return;
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_TEXT, 0, t, price);
      ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
      ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 7);
      ObjectSetInteger(0, name, OBJPROP_ANCHOR, ANCHOR_LEFT);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetString(0, name, OBJPROP_TEXT, text);
     }
   else
      ObjectMove(0, name, 0, t, price);
  }
//+------------------------------------------------------------------+
void DrawArrow(const SP2LSetup &st)
  {
   string name = SP2L_PREFIX + st.tag + "_arw";
   if(ObjectFind(0, name) >= 0)
      return;
   ObjectCreate(0, name, OBJ_ARROW, 0, st.startTime, st.entry);
   ObjectSetInteger(0, name, OBJPROP_ARROWCODE, st.isSell ? 234 : 233);
   ObjectSetInteger(0, name, OBJPROP_COLOR, st.isSell ? SlColor : TpColor);
   ObjectSetInteger(0, name, OBJPROP_ANCHOR, st.isSell ? ANCHOR_BOTTOM : ANCHOR_TOP);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
  }
//+------------------------------------------------------------------+
void DrawSetup(const SP2LSetup &st, const datetime endTime)
  {
   if(DisplayMode == SP2L_DISPLAY_SIGNAL)
     {
      DrawArrow(st);
      return;
     }
   string base = SP2L_PREFIX + st.tag;
   DrawLine(base + "_ent",  st.startTime, endTime, st.entry, EntryColor, "Entry");
   DrawLine(base + "_half", st.startTime, endTime, st.half,  HalfColor,  "50%");
   DrawLine(base + "_sl",   st.startTime, endTime, st.sl,    SlColor,    "SL");
   DrawLine(base + "_tp",   st.startTime, endTime, st.tp,    TpColor,    "TP");
   DrawLabel(base + "_lent", endTime, st.entry, EntryColor, "E");
   DrawLabel(base + "_lsl",  endTime, st.sl,    SlColor,    "SL");
   DrawLabel(base + "_ltp",  endTime, st.tp,    TpColor,    "TP");
  }
//+------------------------------------------------------------------+
void DeleteSetupObjects(const SP2LSetup &st)
  {
   ObjectsDeleteAll(0, SP2L_PREFIX + st.tag);
  }
//+------------------------------------------------------------------+
void Notify(const SP2LSetup &st)
  {
   string msg = StringFormat("SP2L %s %s @%s | SL %s | TP %s",
                             st.isSell ? "SELL" : "BUY", _Symbol,
                             DoubleToString(st.entry, _Digits),
                             DoubleToString(st.sl, _Digits),
                             DoubleToString(st.tp, _Digits));
   if(AlertsOn)
      Alert(msg);
   if(PushOn)
      SendNotification(msg);
  }
//+------------------------------------------------------------------+
//| Resolve running setups and look for a new one, with the signal    |
//| bar at `sigShift`. `live` gates alerts (no alerts on backfill).   |
//+------------------------------------------------------------------+
void ProcessBar(const int sigShift, const bool live)
  {
   datetime barTime = iTime(_Symbol, _Period, sigShift);
   double   h = iHigh(_Symbol, _Period, sigShift);
   double   l = iLow(_Symbol, _Period, sigShift);

   bool anyActive = false;
   for(int i = 0; i < ArraySize(g_setups); i++)
     {
      if(!g_setups[i].active)
         continue;
      bool hitSl = g_setups[i].isSell ? (h >= g_setups[i].sl) : (l <= g_setups[i].sl);
      bool hitTp = g_setups[i].isSell ? (l <= g_setups[i].tp) : (h >= g_setups[i].tp);
      if(hitSl || hitTp)
         g_setups[i].active = false;
      else
        {
         DrawSetup(g_setups[i], barTime); // extend lines to the current bar
         anyActive = true;
        }
     }

   if(OnePositionAtATime && anyActive)
      return;

   SP2LSetup st;
   bool found = Detect(true, sigShift, st) || Detect(false, sigShift, st);
   if(!found)
      return;

   // avoid a duplicate for the same entry bar / direction
   for(int i = 0; i < ArraySize(g_setups); i++)
      if(g_setups[i].tag == st.tag)
         return;

   if(OnlyLastPosition)
     {
      for(int i = 0; i < ArraySize(g_setups); i++)
         DeleteSetupObjects(g_setups[i]);
      ArrayResize(g_setups, 0);
     }

   int sz = ArraySize(g_setups);
   ArrayResize(g_setups, sz + 1);
   g_setups[sz] = st;
   DrawSetup(st, barTime);
   if(live)
      Notify(st);
  }
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total, const int prev_calculated,
                const datetime &time[], const double &open[],
                const double &high[], const double &low[],
                const double &close[], const long &tick_volume[],
                const long &volume[], const int &spread[])
  {
   int minBars = AtrPeriod + MaxSequenceBars + 5;
   if(rates_total < minBars)
      return(rates_total);

   // one-time backfill over recent history
   if(!g_history)
     {
      int start = MathMin(HistoryBars, rates_total - minBars);
      for(int s = start; s >= 1; s--)
         ProcessBar(s, false);
      g_history = true;
      g_lastBarTime = iTime(_Symbol, _Period, 0);
      return(rates_total);
     }

   // then act once per newly closed bar
   datetime cur = iTime(_Symbol, _Period, 0);
   if(cur == g_lastBarTime)
      return(rates_total);
   g_lastBarTime = cur;
   ProcessBar(1, true);
   return(rates_total);
  }
//+------------------------------------------------------------------+
