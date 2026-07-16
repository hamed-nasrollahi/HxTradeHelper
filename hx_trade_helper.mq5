//+------------------------------------------------------------------+
//|                                              hx_trade_helper.mq5 |
//|                                Copyright 2024, Hamed Nasrollahi. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2023, Hamed Nasrollahi. CC BY-NC-SA 4.0"
#property link      "https://github.com/hamed-nasrollahi/HxTradeHelper"
#property description "nasrollahi.hamed@gmail.com"
#property version   "1.2"
#property strict
#property indicator_chart_window
#property indicator_buffers 0
#property indicator_plots   0


#include "DialogHx.mqh"
#include <Controls\Button.mqh>
#include <Controls\Label.mqh>
#include <Arrays\ArrayObj.mqh> // For dynamic object arrays
#include "TradeElement.mqh"

// Native library built with .NET 8 Native AOT (see dotnet/README.md):
// publish HxTradeUploader.dll and put it in MQL5\Libraries
#import "HxTradeUploader.dll"
int UploadJson(string apiUrl, string apiKey, string json, int timeoutMs);
int HttpGet(string url, string apiKey, int timeoutMs);
int GetLastResponse(string &buffer, int capacity);
#import

// Base folder for storing screenshots
input string JournalBasePath = "TradesHistory";

// Journal upload to the dashboard (MariaDB backend, see dashboard/README.md)
input string ApiUrl = "http://127.0.0.1:3000/api/import"; // Dashboard import endpoint
// /api/news, which itself caches/refreshes the ForexFactory feed hourly)
input string NewsFeedUrl = "http://127.0.0.1:3000/api/news"; // Dashboard news endpoint

input string ApiKey = "";                                 // Import API key (X-Api-Key header)

input bool UploadToApi = true;                            // Upload today's trades to the dashboard

input bool showCandleTime = true;
input bool showSessions = false;
input bool showSlipage = true;

// News calendar (fetched through HxTradeUploader.dll from the dashboard's
input bool ShowNews = false;              // Fetch calendar (orange + red events)
input string NewsCurrencies = "USD";         // CSV filter e.g. "USD,EUR"; empty = chart symbol currencies
input int NewsWindowMinutes = 2;          // Turn an event red/orange (from gray) this many minutes before it fires
input int NewsDurationMinutes = 15;       // How long an event counts as "in progress" after release
input int NewsAlertMinutes = 15;          // Alert this many minutes before a major (High impact) event
input int NewsCloseMinutes = 11;          // "Close trades" alert this many minutes before a major event

input bool SummerTime = false;

input color ATR_Color = clrYellow;
input int ATR_Period = 14;  // ATR period
input ENUM_LINE_STYLE ATR_Style = STYLE_DOT;

// Inputs for Yesterday's New York session close
input color Color_Yesterday = clrRed;    // Line color
input color Color_YesterdayOpen = clrWhite;
input color Color_YesterdayHigh = clrBlue;
input color Color_YesterdayLow = clrBlue;
input ENUM_LINE_STYLE Style_Yesterday = STYLE_SOLID; // Line style
input int Width_Yesterday = 1;           // Line width

// Inputs for the Day Before Yesterday's New York session close
input color Color_DayBefore = clrGreen;    // Line color
input ENUM_LINE_STYLE Style_DayBefore = STYLE_SOLID;   // Line style
input int Width_DayBefore = 1;             // Line width

// Inputs for Last Week's close
input color Color_LastWeek = clrYellow;    // Line color
input ENUM_LINE_STYLE Style_LastWeek = STYLE_SOLID;  // Line style
input int Width_LastWeek = 1;            // Line width

//optimized for XAU/USD
input double Level1 = 1.25;
input double Level2 = 2.50;
input double Level3 = 5.00;

input bool UsePips = true;

input color Color_Level1 = clrGray;
input ENUM_LINE_STYLE Style_Level1 = STYLE_SOLID;
input int Width_Level1 = 1;

input color Color_Level2 = clrGray;
input ENUM_LINE_STYLE Style_Level2 = STYLE_DASH;
input int Width_Level2 = 1;

input color Color_Level3 = clrGray;
input ENUM_LINE_STYLE Style_Level3 = STYLE_DOT;
input int Width_Level3 = 1;

input color Color_HighLow = clrBlue;
input ENUM_LINE_STYLE Style_HighLow = STYLE_SOLID;
input int Width_HighLow = 2;

input color Color_MidLevels = clrBlue;
input ENUM_LINE_STYLE Style_MidLevels = STYLE_DOT;
input int Width_MidLevels = 1;

input bool ShowTokyoSession = true;
input color Color_TokyoSession = clrYellow;
input bool ShowLondonSession = true;
input color Color_LondonSession = clrGreen;
input bool ShowNewYorkSession = true;
input color Color_NewYorkSession = clrBlue;
input bool ShowNewYorkPreSession = true;
input color Color_NewYorkPreSession = clrBlueViolet;

input ENUM_LINE_STYLE Style_Session = STYLE_DOT;
input int Width_Session = 1;

input double tradeRisk   = 1.0;              // Risk per trade (R)


// Dialog tabs
#define TAB_TRADE    0
#define TAB_BACKTEST 1
#define TAB_JOURNAL  2

DialogHx  AppWindow;
CButton  btnTabTrade, btnTabTest, btnTabJournal;
CButton  btnJournal, btnJournalAll, btnYesterday, btnDayBefore, btnLastWeek, btnWeeklyMap, btnLevel1, btnLevel2, btnLevel3, btnSessions, btnATR, btnDOB,
btnH4OB, btnH1OB, btnSROB, btnMA200, btnMA60, btnMA20, btnBuy, btnSell, btnCLR, btnFib1, btnFib2, btnFib3, btnWB, btnLB, btnWS, btnLS, btnExp, btnExpApi, btnEnbl, btnReCalc, btnReset;
CLabel   lblRepo;

bool verticalSessionEnable = false, level3Enable = false, level2Enable = false, level1Enable = false, lastWeekEnable = false, dayBeforeEnable = false, 
yesterdayEnable = false, atrEnable = true, lastWeekMapEnable = false;
// Global variable to store the date of the last update
int lastUpdateDate = 0;
double lastHigh = 0;
double lastLow = DBL_MAX;
datetime GMTOffset;

CArrayObj *tradeElements= NULL; // Dynamic list to hold CTradeElement instances
int ma20Handle=INVALID_HANDLE, ma60Handle=INVALID_HANDLE, ma200Handle=INVALID_HANDLE;
bool ma20Enable = false, ma60Enable = false, ma200Enable = false, statEnable = false;

int dialog_tab=0;
int winTrades = 0, loseTrades=0;

//+------------------------------------------------------------------+
//| ForexFactory calendar event (orange/red only)                    |
//+------------------------------------------------------------------+
struct NewsEvent
{
   datetime time;     // event time in GMT
   string   currency; // e.g. "USD"
   string   title;
   bool     isRed;    // true = High impact, false = Medium (orange)
};
NewsEvent newsEvents[];
datetime lastNewsFetch = 0;
int newsListRows = 0; // rows currently drawn by UpdateNewsList(), so shrinking lists clean up after themselves

// Event times we've already fired the heads-up / close-trades alert for,
// kept separate from newsEvents[] so an hourly recalendar refetch (which
// rebuilds newsEvents[] from scratch) can't cause a duplicate Alert()
datetime alertedNewsTimes[];
datetime closeAlertedNewsTimes[];

//+------------------------------------------------------------------+
//| Journal trade record built from the account trade history        |
//+------------------------------------------------------------------+
struct JournalTrade
{
   long     positionId;
   string   symbol;
   string   type;        // "Buy" / "Sell"
   datetime openTime;
   datetime closeTime;   // 0 while the position is still open
   double   entryPrice;
   double   stopLoss;    // 0 if never set
   double   takeProfit;  // 0 if never set
   double   closePrice;  // 0 while the position is still open
   double   profit;      // profit incl. swap and commission
   bool     isOpen;
};
//+------------------------------------------------------------------+
//| Custom indicator initialization function                         |
//+------------------------------------------------------------------+
int OnInit()
{       
   GMTOffset = TimeTradeServer() - TimeGMT();
   
   if (!CreateFolder(JournalBasePath, false))
   {
      Print("Error: Cannot create base directory: ", JournalBasePath);
   }
   
   int chartWidth = ChartGetInteger(0, CHART_WIDTH_IN_PIXELS, 0) - 120;
   //--- create application dialog
   CleanAppWindows();
   if(!AppWindow.Create(0,"Hx Helper",0,chartWidth,100,chartWidth+110,630))
      return(INIT_FAILED);


   PopulateTabs();

   //--- run application
   AppWindow.Run();
   ApplyTabVisibility();
   
   // Initialize the dynamic list
   tradeElements = new CArrayObj();
   // Reconstruct existing trade elements
   ReconstructTradeElements();

   if(showCandleTime || showSlipage || showSessions || ShowNews)
      EventSetTimer(1);

   return(INIT_SUCCEEDED);
}

void PopulateTabs()
{
  // Tab selectors, always visible - not subject to the 2-per-row rule, and
  // colored to stand out from the ordinary tool buttons below them
  CreateButton(btnTabTrade, "btnTabTrade", "TR",10,10,38,32);
  CreateButton(btnTabTest, "btnTabTest", "TE",41,10,69,32);
  CreateButton(btnTabJournal, "btnTabJournal", "JR",72,10,100,32);
  btnTabTrade.Locking(true);
  btnTabTest.Locking(true);
  btnTabJournal.Locking(true);
  btnTabTrade.ColorBackground(clrSteelBlue);
  btnTabTest.ColorBackground(clrSteelBlue);
  btnTabJournal.ColorBackground(clrSteelBlue);
  btnTabTrade.Color(clrWhite);
  btnTabTest.Color(clrWhite);
  btnTabJournal.Color(clrWhite);

  // Trade tab
  CreateButton(btnYesterday, "btnYesterday", "Yesterday",10,40,100,60);
  CreateButton(btnDayBefore, "btnDayBefore", "Day Before",10,70,100,90);
  CreateButton(btnLastWeek, "btnLastWeek", "Last Week",10,100,100,120);
  CreateButton(btnWeeklyMap, "btnWeeklyMap", "Week Map",10,130,100,150);
  CreateButton(btnLevel1, "btnLevel1", "L1",10,160,53,180);
  CreateButton(btnLevel2, "btnLevel2", "L2",57,160,100,180);
  CreateButton(btnLevel3, "btnLevel3", "L3",10,190,53,210);
  CreateButton(btnATR, "btnATR", "ATR",57,190,100,210);
  CreateButton(btnSessions, "btnSessions", "Sessions",10,220,100,240);
  CreateButton(btnDOB, "btnDOB", "DOB",10,250,53,270);
  CreateButton(btnH4OB, "btnH4OB", "H4OB",57,250,100,270);
  CreateButton(btnH1OB, "btnH1OB", "H1OB",10,280,53,300);
  CreateButton(btnSROB, "btnSROB", "SROB",57,280,100,300);
  CreateButton(btnMA20, "btnMA20", "M20",10,310,53,330);
  CreateButton(btnMA60, "btnMA60", "M60",57,310,100,330);
  CreateButton(btnMA200, "btnMA200", "M200",10,340,100,360);
  CreateButton(btnFib1, "btnFib1", "Fib1",10,370,53,390);
  CreateButton(btnFib2, "btnFib2", "Fib2",57,370,100,390);
  CreateButton(btnFib3, "btnFib3", "Fib3",10,400,100,420);

  // Back test tab
  CreateButton(btnSell, "btnSell", "Sell",10,40,53,60);
  CreateButton(btnBuy, "btnBuy", "Buy",57,40,100,60);
  CreateButton(btnLB, "btnLB", "L-B",10,70,53,90);
  CreateButton(btnWB, "btnWB", "W-B",57,70,100,90);
  CreateButton(btnLS, "btnLS", "L-S",10,100,53,120);
  CreateButton(btnWS, "btnWS", "W-S",57,100,100,120);
  CreateButton(btnEnbl, "btnEnbl", "Stats",10,130,100,150);
  CreateButton(btnReset, "btnReset", "Rst",10,160,53,180);
  CreateButton(btnReCalc, "btnReCalc", "CLC",57,160,100,180);
  CreateButton(btnExp, "btnExp", "Export",10,190,100,210);
  CreateButton(btnExpApi, "btnExpApi", "Export API",10,220,100,240);

  // Journal tab
  CreateButton(btnJournal, "btnJournal", "Export Journal",10,40,100,70);
  CreateButton(btnJournalAll, "btnJournalAll", "Export to API",10,80,100,110);
  CreateButton(btnCLR, "btnCLR", "CLR",10,120,100,140);

  // Footer credit, always visible regardless of the active tab. Full URL
  // is on the tooltip since the panel is too narrow for it to fit as text
  lblRepo.Create(0, "lblRepo", 0, 20, 485, 100, 500);
  lblRepo.Text("HxTradeHelper");
  lblRepo.FontSize(7);
  lblRepo.Color(clrSteelBlue);
  AppWindow.Add(lblRepo);
  ObjectSetString(0, "lblRepo", OBJPROP_TOOLTIP, "https://github.com/hamed-nasrollahi/HxTradeHelper");
}

//+------------------------------------------------------------------+
//| Show/hide buttons according to the active tab                    |
//+------------------------------------------------------------------+
void ApplyTabVisibility()
{
   bool trade   = (dialog_tab == TAB_TRADE);
   bool test    = (dialog_tab == TAB_BACKTEST);
   bool journal = (dialog_tab == TAB_JOURNAL);

   btnTabTrade.Pressed(trade);
   btnTabTest.Pressed(test);
   btnTabJournal.Pressed(journal);

   // Trade tab
   ShowButton(btnYesterday, trade);
   ShowButton(btnDayBefore, trade);
   ShowButton(btnLastWeek, trade);
   ShowButton(btnWeeklyMap, trade);
   ShowButton(btnLevel1, trade);
   ShowButton(btnLevel2, trade);
   ShowButton(btnLevel3, trade);
   ShowButton(btnATR, trade);
   ShowButton(btnSessions, trade);
   ShowButton(btnDOB, trade);
   ShowButton(btnH4OB, trade);
   ShowButton(btnH1OB, trade);
   ShowButton(btnSROB, trade);
   ShowButton(btnMA20, trade);
   ShowButton(btnMA60, trade);
   ShowButton(btnMA200, trade);
   ShowButton(btnFib1, trade);
   ShowButton(btnFib2, trade);
   ShowButton(btnFib3, trade);

   // Back test tab
   ShowButton(btnSell, test);
   ShowButton(btnBuy, test);
   ShowButton(btnLB, test);
   ShowButton(btnWB, test);
   ShowButton(btnLS, test);
   ShowButton(btnWS, test);
   ShowButton(btnEnbl, test);
   ShowButton(btnReset, test);
   ShowButton(btnReCalc, test);
   ShowButton(btnExp, test);
   ShowButton(btnExpApi, test);

   // Journal tab
   ShowButton(btnJournal, journal);
   ShowButton(btnJournalAll, journal);
   ShowButton(btnCLR, journal);
}

void ShowButton(CButton &btn, const bool visible)
{
   if(visible)
      btn.Show();
   else
      btn.Hide();
}

void SelectTab(const int tab)
{
   dialog_tab = tab;
   ApplyTabVisibility();
}

//+------------------------------------------------------------------+
//| Indicator deinitialization function                              |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   //--- destroy dialog
   AppWindow.Destroy(reason);
   // Remove all lines when the indicator is removed
   DeleteLines();

   //RemoveAllTradeElements();
   delete tradeElements; // Delete the dynamic list
}

//+------------------------------------------------------------------+
//| Second-based displays (countdowns, spread) run on a timer instead |
//| of every tick, and keep updating even when no ticks arrive        |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(showCandleTime)
   {
      InitCandleTimer();
   }
   if(showSlipage)
   {
      InitSpreadIndicator();
   }

   if(showSessions)
   {
      InitSessionsIndicator();
   }
   if(ShowNews)
   {
      UpdateNews();
   }
   ChartRedraw();
}

//+------------------------------------------------------------------+
//| Refresh the calendar hourly and the countdown label every second |
//+------------------------------------------------------------------+
void UpdateNews()
{
   if(TimeGMT() - lastNewsFetch >= 3600)
      FetchNewsEvents();
   CheckNewsAlerts();
   UpdateNewsList();
}

//+------------------------------------------------------------------+
//| True if t is already present in a datetime array                 |
//+------------------------------------------------------------------+
bool TimeInArray(const datetime &arr[], const datetime t)
{
   for(int i = 0; i < ArraySize(arr); i++)
      if(arr[i] == t)
         return true;
   return false;
}

//+------------------------------------------------------------------+
//| Drop entries whose event has already passed - keeps the alerted  |
//| trackers from growing forever                                    |
//+------------------------------------------------------------------+
void PruneAlerted(datetime &arr[], const datetime now)
{
   datetime kept[];
   for(int i = 0; i < ArraySize(arr); i++)
   {
      if(arr[i] >= now - 3600)
      {
         int k = ArraySize(kept);
         ArrayResize(kept, k + 1);
         kept[k] = arr[i];
      }
   }
   ArrayCopy(arr, kept);
}

//+------------------------------------------------------------------+
//| Alert once, NewsAlertMinutes before a major (High impact) event, |
//| and again, NewsCloseMinutes before it, as a reminder to close    |
//| open trades. Each event fires each alert at most once.           |
//+------------------------------------------------------------------+
void CheckNewsAlerts()
{
   datetime now = TimeGMT();
   PruneAlerted(alertedNewsTimes, now);
   PruneAlerted(closeAlertedNewsTimes, now);

   for(int i = 0; i < ArraySize(newsEvents); i++)
   {
      if(!newsEvents[i].isRed)
         continue; // major = High impact only

      datetime t = newsEvents[i].time;
      if(t <= now)
         continue;

      int secondsToGo = (int)(t - now);

      if(secondsToGo <= NewsAlertMinutes * 60 && !TimeInArray(alertedNewsTimes, t))
      {
         int sz = ArraySize(alertedNewsTimes);
         ArrayResize(alertedNewsTimes, sz + 1);
         alertedNewsTimes[sz] = t;
         Alert(StringFormat("Major news in %d min: %s %s", NewsAlertMinutes,
                             newsEvents[i].currency, newsEvents[i].title));
      }

      if(secondsToGo <= NewsCloseMinutes * 60 && !TimeInArray(closeAlertedNewsTimes, t)
         && PositionsTotal() > 0)
      {
         int sz = ArraySize(closeAlertedNewsTimes);
         ArrayResize(closeAlertedNewsTimes, sz + 1);
         closeAlertedNewsTimes[sz] = t;
         Alert(StringFormat("Close trades: major news in %d min: %s %s", NewsCloseMinutes,
                             newsEvents[i].currency, newsEvents[i].title));
      }
   }
}

//+------------------------------------------------------------------+
//| Ask the dashboard for its cached calendar (it fetches/refreshes  |
//| from ForexFactory itself, at most once an hour) and keep         |
//| orange/red events for the configured currencies                  |
//+------------------------------------------------------------------+
void FetchNewsEvents()
{
   lastNewsFetch = TimeGMT();

   string filterCsv = NewsCurrencies;
   if(filterCsv == "")
      filterCsv = SymbolInfoString(Symbol(), SYMBOL_CURRENCY_BASE) + "," +
                  SymbolInfoString(Symbol(), SYMBOL_CURRENCY_PROFIT);
   StringToUpper(filterCsv);
   string filters[];
   int filterCount = StringSplit(filterCsv, ',', filters);
   for(int i = 0; i < filterCount; i++)
   {
      StringTrimLeft(filters[i]);
      StringTrimRight(filters[i]);
   }

   // The dashboard also filters server-side (fewer bytes over the wire),
   // but the client-side match below stays as a defensive second pass
   string sep = (StringFind(NewsFeedUrl, "?") >= 0) ? "&" : "?";
   string url = NewsFeedUrl + sep + "currencies=" + filterCsv;

   int status = HttpGet(url, ApiKey, 10000);
   string body;
   StringInit(body, 262144);
   int len = GetLastResponse(body, 262144);
   body = StringSubstr(body, 0, len);

   if(status != 200)
   {
      Print("News fetch failed (HTTP ", status, "): ", StringSubstr(body, 0, 200));
      lastNewsFetch = TimeGMT() - 3600 + 600; // retry in 10 minutes
      return;
   }

   ArrayResize(newsEvents, 0);
   int pos = 0;
   while(true)
   {
      int start = StringFind(body, "{", pos);
      if(start < 0)
         break;
      int end = StringFind(body, "}", start);
      if(end < 0)
         break;
      pos = end + 1;
      string obj = StringSubstr(body, start, end - start + 1);

      string impact = JsonField(obj, "impact");
      bool isRed = (impact == "High");
      if(!isRed && impact != "Medium")
         continue; // orange + red only

      string country = JsonField(obj, "country");
      StringToUpper(country);
      bool match = false;
      for(int i = 0; i < filterCount; i++)
      {
         if(filters[i] != "" && filters[i] == country)
         {
            match = true;
            break;
         }
      }
      if(!match)
         continue;

      datetime eventTime = ParseIso8601(JsonField(obj, "date"));
      if(eventTime == 0)
         continue;

      int sz = ArraySize(newsEvents);
      ArrayResize(newsEvents, sz + 1);
      newsEvents[sz].time = eventTime;
      newsEvents[sz].currency = country;
      newsEvents[sz].title = JsonField(obj, "title");
      newsEvents[sz].isRed = isRed;
   }
   PrintFormat("News calendar: %d orange/red event(s) for %s", ArraySize(newsEvents), filterCsv);
}

//+------------------------------------------------------------------+
//| Build one list row's text/color. Gray until NewsWindowMinutes    |
//| before release (or while in progress), then red (High impact) or |
//| orange (Medium); red titles get a leading '*' while highlighted. |
//+------------------------------------------------------------------+
string BuildNewsLine(const NewsEvent &ev, const datetime now, const int window, const int duration, color &outClr)
{
   datetime t = ev.time;
   bool live = (t <= now && now < t + duration);
   bool imminent = (!live && t > now && t - now <= window);

   string title = ev.title;
   if(ev.isRed && (live || imminent))
      title = "*" + title;
   outClr = (live || imminent) ? (ev.isRed ? clrRed : clrOrange) : clrGray;

   if(live)
   {
      int remain = (int)(t + duration - now);
      return StringFormat("LIVE %02d:%02d  %s %s", remain / 60, remain % 60, ev.currency, title);
   }
   int togo = (int)(t - now);
   return StringFormat("%02d:%02d:%02d  %s %s", togo / 3600, (togo % 3600) / 60, togo % 60, ev.currency, title);
}

//+------------------------------------------------------------------+
//| List every red/orange event that hasn't fully passed yet, in a   |
//| column on the right of the chart, below the Hx Helper panel and  |
//| above the bottom of the chart. Soonest first; an event drops off |
//| the list once it's NewsDurationMinutes past its release time.    |
//+------------------------------------------------------------------+
void UpdateNewsList()
{
   string prefix = "NewsList_";
   datetime now = TimeGMT();
   int window = NewsWindowMinutes * 60;
   int duration = NewsDurationMinutes * 60;

   int order[];
   for(int i = 0; i < ArraySize(newsEvents); i++)
   {
      if(now >= newsEvents[i].time + duration)
         continue; // fully passed - drop from the list
      int sz = ArraySize(order);
      ArrayResize(order, sz + 1);
      order[sz] = i;
   }
   // newsEvents[] arrives time-sorted from the dashboard, but sort
   // defensively since FetchNewsEvents() doesn't guarantee it itself
   for(int i = 1; i < ArraySize(order); i++)
   {
      int cur = order[i];
      datetime curT = newsEvents[cur].time;
      int j = i - 1;
      while(j >= 0 && newsEvents[order[j]].time > curT)
      {
         order[j + 1] = order[j];
         j--;
      }
      order[j + 1] = cur;
   }

   const int rowHeight = 16;
   const int startY = 640; // just below the Hx Helper panel (bottom edge at y=630, see OnInit)
   int chartHeight = (int)ChartGetInteger(0, CHART_HEIGHT_IN_PIXELS, 0);
   int maxRows = (chartHeight - startY - 20) / rowHeight;
   if(maxRows < 0)
      maxRows = 0;
   int shown = MathMin(ArraySize(order), maxRows);

   for(int i = 0; i < shown; i++)
   {
      color clr;
      string text = BuildNewsLine(newsEvents[order[i]], now, window, duration, clr);
      string name = prefix + IntegerToString(i);
      CreateIndicator(500, startY + i * rowHeight, name, clr);
      ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 9);
      SetIndicatorText(name, text, clr);
   }
   for(int i = shown; i < newsListRows; i++)
      ObjectDelete(0, prefix + IntegerToString(i));
   newsListRows = shown;
}

//+------------------------------------------------------------------+
//| Extract a top-level field from a flat JSON object string         |
//+------------------------------------------------------------------+
string JsonField(const string obj, const string key)
{
   string pattern = "\"" + key + "\":";
   int p = StringFind(obj, pattern);
   if(p < 0)
      return "";
   p += StringLen(pattern);
   int n = StringLen(obj);
   while(p < n && StringGetCharacter(obj, p) == ' ')
      p++;
   if(p >= n)
      return "";
   if(StringGetCharacter(obj, p) != '"')
   {
      int e = StringFind(obj, ",", p);
      if(e < 0)
         e = n - 1;
      return StringSubstr(obj, p, e - p);
   }
   p++;
   int e = p;
   while(e < n)
   {
      ushort c = StringGetCharacter(obj, e);
      if(c == '\\')
      {
         e += 2;
         continue;
      }
      if(c == '"')
         break;
      e++;
   }
   string value = StringSubstr(obj, p, e - p);
   StringReplace(value, "\\/", "/");
   StringReplace(value, "\\\"", "\"");
   return value;
}

//+------------------------------------------------------------------+
//| Parse "2026-07-02T08:30:00-04:00" to a GMT datetime              |
//+------------------------------------------------------------------+
datetime ParseIso8601(const string s)
{
   if(StringLen(s) < 19)
      return 0;
   MqlDateTime dt = {};
   dt.year = (int)StringToInteger(StringSubstr(s, 0, 4));
   dt.mon  = (int)StringToInteger(StringSubstr(s, 5, 2));
   dt.day  = (int)StringToInteger(StringSubstr(s, 8, 2));
   dt.hour = (int)StringToInteger(StringSubstr(s, 11, 2));
   dt.min  = (int)StringToInteger(StringSubstr(s, 14, 2));
   dt.sec  = (int)StringToInteger(StringSubstr(s, 17, 2));
   datetime local = StructToTime(dt);
   if(local == 0)
      return 0;

   int offset = 0;
   if(StringLen(s) >= 25)
   {
      string sign = StringSubstr(s, 19, 1);
      if(sign == "+" || sign == "-")
      {
         int oh = (int)StringToInteger(StringSubstr(s, 20, 2));
         int om = (int)StringToInteger(StringSubstr(s, 23, 2));
         offset = (oh * 3600 + om * 60) * (sign == "-" ? -1 : 1);
      }
   }
   return local - offset; // to GMT
}

void DrawStats()
{
   string objName = "StatsLabel";

   if(!statEnable)
   {
      ObjectDelete(0, objName);
      return;
   }

   int totalTrades = winTrades + loseTrades;
   double winPct    = (totalTrades > 0) ? (winTrades * 100.0 / totalTrades) : 0.0;
   double totalSum  = tradeRisk * winTrades - loseTrades;

   color sumColor = (totalSum >= 0) ? clrLimeGreen : clrRed;

   string statsText = StringFormat("W:%d  L:%d  |  Win%%: %.1f%%  |  Sum: %.0fR",
                                   winTrades, loseTrades, winPct, totalSum);

   if(ObjectFind(0, objName) == -1)
   {
      ObjectCreate(0, objName, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, objName, OBJPROP_CORNER,    CORNER_RIGHT_UPPER);
      ObjectSetInteger(0, objName, OBJPROP_XDISTANCE, 450);
      ObjectSetInteger(0, objName, OBJPROP_YDISTANCE, 20);
      ObjectSetInteger(0, objName, OBJPROP_FONTSIZE,  12);
      ObjectSetInteger(0, objName, OBJPROP_SELECTABLE, false);
   }
   ObjectSetString (0, objName, OBJPROP_TEXT,  statsText);
   ObjectSetInteger(0, objName, OBJPROP_COLOR, sumColor);
}

//+------------------------------------------------------------------+
//| Indicator Calculation Function                                   |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
{
   if(rates_total <= 0)
      return(0);

   // OnCalculate arrays are plain arrays (index 0 = the oldest bar), flip
   // them so index 0 is the current bar as the logic below expects
   ArraySetAsSeries(time, true);
   ArraySetAsSeries(high, true);
   ArraySetAsSeries(low, true);

   MqlDateTime tm  ={};
   if(!TimeToStruct(time[0],tm))
   Print("TimeToStruct() failed. Error ", GetLastError());

   // Check if the date has changed
   if (tm.day != lastUpdateDate)
   {
     // Ensure old lines are removed before creating new ones
     DeleteLines();
     lastHigh = 0;
     lastLow = DBL_MAX;
     UpdateLines();
     lastUpdateDate = tm.day; // Update the last update date
   }

   if(high[0] > lastHigh)
   {
      lastHigh = high[0];
      GenerateLevelNumbers();
   }
   if(low[0] < lastLow)
   {
      lastLow = low[0];
      GenerateLevelNumbers();
   }
   return(rates_total);
}

//+------------------------------------------------------------------+
//| ChartEvent function                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   datetime current_time = TimeLocal(); // Get the current system time
   if(id == CHARTEVENT_OBJECT_CHANGE || id == CHARTEVENT_OBJECT_DRAG)
   {
      if (StringFind(sparam, "SELL_") == 0 || StringFind(sparam, "BUY_") == 0)
      {
         // Extract the instance name
         int pos = 0;
         if(StringFind(sparam, "_MainRectangle") != -1)
         {
            pos = StringFind(sparam, "_MainRectangle");
         }
         else if(StringFind(sparam, "_Arrow") != -1)
         {
            pos = StringFind(sparam, "_Arrow");
         }
         string instanceName = StringSubstr(sparam, 0, pos);
         UpdateTradeElement(instanceName);
      }
   }
   else if(id == CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam == "btnTabTrade")
      {
         SelectTab(TAB_TRADE);
      }
      else if(sparam == "btnTabTest")
      {
         SelectTab(TAB_BACKTEST);
      }
      else if(sparam == "btnTabJournal")
      {
         SelectTab(TAB_JOURNAL);
      }
      else if(sparam == "btnJournal")
      {
         ExportTodaysTrades();
      }
      else if(sparam == "btnJournalAll")
      {
         ExportAllTrades();
      }
      else if(sparam == "btnYesterday")
      {
         yesterdayEnable = ! yesterdayEnable;
         RefreshLines();
      }
      else if(sparam == "btnDayBefore")
      {
         dayBeforeEnable = ! dayBeforeEnable;
         RefreshLines();
      }
      else if(sparam == "btnLastWeek")
      {
         lastWeekEnable = ! lastWeekEnable;
         RefreshLines();
      }
      else if(sparam == "btnWeeklyMap")
      {
         lastWeekMapEnable = ! lastWeekMapEnable;
         RefreshLines();
      }
      else if(sparam == "btnLevel1")
      {
         level1Enable = ! level1Enable;
         RefreshLines();
      }
      else if(sparam == "btnLevel2")
      {
         level2Enable = ! level2Enable;
         RefreshLines();
      }
      else if(sparam == "btnLevel3")
      {
         level3Enable = ! level3Enable;
         RefreshLines();
      }
      else if(sparam == "btnATR")
      {
         atrEnable = ! atrEnable;
         RefreshLines();
      }
      else if(sparam == "btnEnbl")
      {
        statEnable = !statEnable;
        DrawStats();
      }
      else if(sparam == "btnWB")
      {
        winTrades ++;
        long firstVisibleBar, visibleBars;
        ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
        ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
        long middleBar = firstVisibleBar - (visibleBars / 2);

        datetime time_start = iTime(NULL, 0, middleBar + 5);
        datetime time_end = iTime(NULL, 0, middleBar);
        double price_top = iHigh(NULL, 0, middleBar);
        double price_bottom = iLow(NULL, 0, middleBar);
        CreateFibo("WB_" + TimeToString(current_time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), true, clrDarkGreen, time_start, price_top, time_end, price_bottom);
      }
      else if(sparam == "btnLB")
      {
        loseTrades ++;
        long firstVisibleBar, visibleBars;
        ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
        ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
        long middleBar = firstVisibleBar - (visibleBars / 2);

        datetime time_start = iTime(NULL, 0, middleBar + 5);
        datetime time_end = iTime(NULL, 0, middleBar);
        double price_top = iHigh(NULL, 0, middleBar);
        double price_bottom = iLow(NULL, 0, middleBar);
        CreateFibo("LB_" + TimeToString(current_time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), true, clrMaroon, time_start, price_top, time_end, price_bottom);
      }
      else if(sparam == "btnWS")
      {
        winTrades ++;
        long firstVisibleBar, visibleBars;
        ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
        ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
        long middleBar = firstVisibleBar - (visibleBars / 2);

        datetime time_start = iTime(NULL, 0, middleBar + 5);
        datetime time_end = iTime(NULL, 0, middleBar);
        double price_top = iHigh(NULL, 0, middleBar);
        double price_bottom = iLow(NULL, 0, middleBar);
        CreateFibo("WS_" + TimeToString(current_time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), true, clrDarkGreen, time_start, price_bottom, time_end, price_top);
      }
      else if(sparam == "btnLS")
      {
        loseTrades ++;
        long firstVisibleBar, visibleBars;
        ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
        ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
        long middleBar = firstVisibleBar - (visibleBars / 2);

        datetime time_start = iTime(NULL, 0, middleBar + 5);
        datetime time_end = iTime(NULL, 0, middleBar);
        double price_top = iHigh(NULL, 0, middleBar);
        double price_bottom = iLow(NULL, 0, middleBar);
        CreateFibo("LS_" + TimeToString(current_time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), true, clrMaroon, time_start, price_bottom, time_end, price_top);
      }
      else if(sparam == "btnExp")
      {
         // Collect all trade fibo names
         string tradeNames[];
         int total = ObjectsTotal(0, 0, OBJ_FIBO);
         for(int i = 0; i < total; i++)
         {
            string name = ObjectName(0, i, 0, OBJ_FIBO);
            string pfx = StringSubstr(name, 0, 3);
            if(pfx == "WB_" || pfx == "WS_" || pfx == "LB_" || pfx == "LS_")
            {
               int sz = ArraySize(tradeNames);
               ArrayResize(tradeNames, sz + 1);
               tradeNames[sz] = name;
            }
         }

         // Sort by embedded datetime string (lexicographic = chronological)
         int n = ArraySize(tradeNames);
         for(int a = 0; a < n - 1; a++)
            for(int b = a + 1; b < n; b++)
               if(StringSubstr(tradeNames[a], 3) > StringSubstr(tradeNames[b], 3))
               {
                  string tmp = tradeNames[a];
                  tradeNames[a] = tradeNames[b];
                  tradeNames[b] = tmp;
               }

         // Write CSV
         FolderCreate(JournalBasePath);
         string fileName = JournalBasePath + "\\backTest_" + TimeToString(TimeCurrent(), TIME_DATE) + ".csv";
         int fh = FileOpen(fileName, FILE_WRITE | FILE_ANSI | FILE_CSV, ',');
         if(fh == INVALID_HANDLE)
         {
            Print("btnExp: failed to open file ", fileName, "  error=", GetLastError());
         }
         else
         {
            FileWrite(fh, "Trade #", "Date", "Time", "Type", "Win/Lose", "Duration (min)", "Strategy", "correctTrade", "5m bias", "1h bias", "desc");
            for(int i = 0; i < n; i++)
            {
               string pfx      = StringSubstr(tradeNames[i], 0, 3);
               string dtStr    = StringSubstr(tradeNames[i], 3);          // "2024.01.15 14:30:00"
               string datePart = StringSubstr(dtStr, 0, 10);              // "2024.01.15"
               string timePart = StringSubstr(dtStr, 11);                 // "14:30:00"
               string type     = (pfx == "WB_" || pfx == "LB_") ? "Buy"  : "Sell";
               string result   = (pfx == "WB_" || pfx == "WS_") ? "Win"  : "Lose";
               datetime t1     = (datetime)ObjectGetInteger(0, tradeNames[i], OBJPROP_TIME, 0);
               datetime t2     = (datetime)ObjectGetInteger(0, tradeNames[i], OBJPROP_TIME, 1);
               int durationMin = (int)(MathAbs((double)(t2 - t1)) / 60);
               FileWrite(fh, i + 1, datePart, timePart, type, result, durationMin, "", "", "", "", "");
            }
            FileClose(fh);
            Print("Trades exported to: ", TerminalInfoString(TERMINAL_DATA_PATH), "\\MQL5\\Files\\", fileName);

            // Write JSON sidecar for the Python importer
            string jsonFile = JournalBasePath + "\\backTest_" + TimeToString(TimeCurrent(), TIME_DATE) + ".json";
            int jh = FileOpen(jsonFile, FILE_WRITE | FILE_ANSI | FILE_TXT);
            if(jh != INVALID_HANDLE)
            {
               string symbol = Symbol();
               string json = "{\"symbol\":\"" + symbol + "\",\"trades\":[";
               for(int i = 0; i < n; i++)
               {
                  string pfx2      = StringSubstr(tradeNames[i], 0, 3);
                  string dtStr2    = StringSubstr(tradeNames[i], 3);
                  string datePart2 = StringSubstr(dtStr2, 0, 10);
                  string timePart2 = StringSubstr(dtStr2, 11);
                  string type2     = (pfx2 == "WB_" || pfx2 == "LB_") ? "Buy"  : "Sell";
                  string result2   = (pfx2 == "WB_" || pfx2 == "WS_") ? "Win"  : "Lose";
                  datetime t1b     = (datetime)ObjectGetInteger(0, tradeNames[i], OBJPROP_TIME, 0);
                  datetime t2b     = (datetime)ObjectGetInteger(0, tradeNames[i], OBJPROP_TIME, 1);
                  int dur2         = (int)(MathAbs((double)(t2b - t1b)) / 60);
                  if(i > 0) json += ",";
                  json += "{\"trade_number\":" + IntegerToString(i + 1)
                        + ",\"trade_date\":\""  + datePart2 + "\""
                        + ",\"trade_time\":\""  + timePart2 + "\""
                        + ",\"type\":\""        + type2     + "\""
                        + ",\"result\":\""      + result2   + "\""
                        + ",\"duration_min\":"  + IntegerToString(dur2)
                        + "}";
               }
               json += "]}";
               FileWriteString(jh, json);
               FileClose(jh);
               Print("JSON sidecar written: ", jsonFile);
            }

            Alert("Export Complete: " + IntegerToString(n) + " trade(s) to MQL5\\Files\\" + fileName);
         }
      }
      else if(sparam == "btnExpApi")
      {
         ExportBacktestToApi();
      }
      else if(sparam == "btnReset")
      {
         ObjectsDeleteAll(0, "WB_", 0, OBJ_FIBO);
         ObjectsDeleteAll(0, "WS_", 0, OBJ_FIBO);
         ObjectsDeleteAll(0, "LB_", 0, OBJ_FIBO);
         ObjectsDeleteAll(0, "LS_", 0, OBJ_FIBO);
         winTrades  = 0;
         loseTrades = 0;
         DrawStats();
      }
      else if(sparam == "btnReCalc")
      {
         winTrades  = 0;
         loseTrades = 0;
         int total = ObjectsTotal(0, 0, OBJ_FIBO);
         for(int i = 0; i < total; i++)
         {
            string name = ObjectName(0, i, 0, OBJ_FIBO);
            if(StringFind(name, "WB_") == 0 || StringFind(name, "WS_") == 0)
               winTrades++;
            else if(StringFind(name, "LB_") == 0 || StringFind(name, "LS_") == 0)
               loseTrades++;
         }
         DrawStats();
      }
      else if(sparam == "btnSessions")
      {
         verticalSessionEnable = ! verticalSessionEnable;
         RefreshLines();
      }
      else if(sparam == "btnDOB")
      {
         long firstVisibleBar, visibleBars;
         ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
         ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
         long middleBar = firstVisibleBar - (visibleBars / 2);
         
         datetime time_start = iTime(NULL, 0, middleBar + 5);
         datetime time_end = iTime(NULL, 0, middleBar);
         double price_top = iHigh(NULL, 0, middleBar);
         double price_bottom = iLow(NULL, 0, middleBar);
         CreateRectangle("D-OB_" + TimeToString(current_time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), true, clrPurple, time_start, price_top, time_end, price_bottom);
      }
      else if(sparam == "btnH4OB")
      {
         long firstVisibleBar, visibleBars;
         ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
         ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
         long middleBar = firstVisibleBar - (visibleBars / 2);
         
         datetime time_start = iTime(NULL, 0, middleBar + 5);
         datetime time_end = iTime(NULL, 0, middleBar);
         double price_top = iHigh(NULL, 0, middleBar);
         double price_bottom = iLow(NULL, 0, middleBar);
         CreateRectangle("H4-OB_" + TimeToString(current_time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), true, clrDarkBlue, time_start, price_top, time_end, price_bottom);
      }
      else if(sparam == "btnH1OB")
      {
         long firstVisibleBar, visibleBars;
         ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
         ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
         long middleBar = firstVisibleBar - (visibleBars / 2);
         
         datetime time_start = iTime(NULL, 0, middleBar + 5);
         datetime time_end = iTime(NULL, 0, middleBar);
         double price_top = iHigh(NULL, 0, middleBar);
         double price_bottom = iLow(NULL, 0, middleBar);
         CreateRectangle("H1-OB_" + TimeToString(current_time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), true, clrDarkGreen, time_start, price_top, time_end, price_bottom);
      }
      else if(sparam == "btnSROB")
      {
         long firstVisibleBar, visibleBars;
         ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
         ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
         long middleBar = firstVisibleBar - (visibleBars / 2);
         
         datetime time_start = iTime(NULL, 0, middleBar + 5);
         datetime time_end = iTime(NULL, 0, middleBar);
         double price_top = iHigh(NULL, 0, middleBar);
         double price_bottom = iLow(NULL, 0, middleBar);
         CreateRectangle("SR-OB_" + TimeToString(current_time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), true, clrDarkSlateGray, time_start, price_top, time_end, price_bottom);
      }
      else if(sparam == "btnSell")
      {
         long firstVisibleBar, visibleBars;
         ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
         ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
         long middleBar = firstVisibleBar - (visibleBars / 2);
         double price = iHigh(NULL, 0, middleBar);
         double sl = price * 1.001;
         double tp = price * 0.998;
         double current_bid = SymbolInfoDouble(Symbol(), SYMBOL_BID);
         datetime time = iTime(NULL, 0, middleBar);
         //double current_ask = SymbolInfoDouble(Symbol(), SYMBOL_ASK); 
         AddTradeElement("SELL_" + TimeToString(time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), price, 1.0, sl, tp, false, time);
         
      }
      else if(sparam == "btnBuy")
      {
         long firstVisibleBar, visibleBars;
         ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
         ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
         long middleBar = firstVisibleBar - (visibleBars / 2);
         double price = iHigh(NULL, 0, middleBar);
         double sl = price * 0.998;
         double tp = price * 1.002;
         double current_ask = SymbolInfoDouble(Symbol(), SYMBOL_ASK); 
         datetime time = iTime(NULL, 0, middleBar);
         AddTradeElement("BUY_" + TimeToString(time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), price, 1.0, tp, sl, true, time);
         
      }
      else if(sparam == "btnMA20")
      {
         ma20Enable = !ma20Enable;
         if(ma20Enable)
         {
            ma20Handle = iMA(NULL, 0, 20, 0, MODE_EMA, PRICE_CLOSE);
            //ma20Handle = iCustom(NULL, PERIOD_CURRENT, "CustomMovingAverage", 20, 0, MODE_EMA, PRICE_CLOSE, clrBlue);
            ChartIndicatorAdd(0, 0, ma20Handle);
         }
         else
         {
            DeleteIndicatorByHandleId(ma20Handle);
         }
         
      }
      else if(sparam == "btnMA60")
      {
         ma60Enable = !ma60Enable;
         if(ma60Enable)
         {
            ma60Handle = iMA(NULL, 0, 60, 0, MODE_EMA, PRICE_CLOSE);
            ChartIndicatorAdd(0, 0, ma60Handle);
         }
         else
         {
            DeleteIndicatorByHandleId(ma60Handle);
         }
      }
      else if(sparam == "btnMA200")
      {
         ma200Enable = !ma200Enable;
         if(ma200Enable)
         {
            ma200Handle = iMA(NULL, 0, 200, 0, MODE_EMA, PRICE_CLOSE);
            ChartIndicatorAdd(0, 0, ma200Handle);
         }
         else
         {
            DeleteIndicatorByHandleId(ma200Handle);
         }
      }
      else if (StringFind(sparam, "_CloseButton") > -1)
      {
         // Extract instance name
         string instanceName = StringSubstr(sparam, 0, StringFind(sparam, "_CloseButton"));
         ObjectsDeleteAll(0, instanceName, 0, OBJ_TEXT);
         ObjectsDeleteAll(0, instanceName, 0, OBJ_RECTANGLE);
         ObjectsDeleteAll(0, instanceName, 0, OBJ_ARROW_LEFT_PRICE);
         ObjectsDeleteAll(0, instanceName, 0, OBJ_TREND);
         //Locate and remove the corresponding trade element
         for (int i = 0; i < tradeElements.Total(); i++)
         {
            CTradeElement *element = (CTradeElement *)tradeElements.At(i);
            if (element != NULL && element.GetInstanceName() == instanceName)
            {
               element.remove();  // Remove objects
               delete element;    // Delete the element
               tradeElements.Delete(i); // Remove from the array
               break;
            }
         }
      }
      else if(sparam == "btnCLR")
      {
         ObjectsDeleteAll(0, "D-OB_", 0, OBJ_RECTANGLE);
         ObjectsDeleteAll(0, "H4-OB_", 0, OBJ_RECTANGLE);
         ObjectsDeleteAll(0, "H1-OB_", 0, OBJ_RECTANGLE);
         ObjectsDeleteAll(0, "SR-OB_", 0, OBJ_RECTANGLE);
         ObjectsDeleteAll(0, "Fib1_", 0, OBJ_FIBO);
         ObjectsDeleteAll(0, "Fib2_", 0, OBJ_FIBO);
         ObjectsDeleteAll(0, "Fib3_", 0, OBJ_FIBO);
         ObjectsDeleteAll(0, "WB_", 0, OBJ_FIBO);
         ObjectsDeleteAll(0, "WS_", 0, OBJ_FIBO);
         ObjectsDeleteAll(0, "LB_", 0, OBJ_FIBO);
         ObjectsDeleteAll(0, "LS_", 0, OBJ_FIBO);
      }
      else if(sparam == "btnFib1")
      {
         long firstVisibleBar, visibleBars;
         ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
         ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
         long middleBar = firstVisibleBar - (visibleBars / 2);
         
         datetime time_start = iTime(NULL, 0, middleBar + 5);
         datetime time_end = iTime(NULL, 0, middleBar);
         double price_top = iHigh(NULL, 0, middleBar);
         double price_bottom = iLow(NULL, 0, middleBar);
         CreateFibo("Fib1_" + TimeToString(current_time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), true, C'53,53,53', time_start, price_top, time_end, price_bottom);
      }
      else if(sparam == "btnFib2")
      {
         long firstVisibleBar, visibleBars;
         ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
         ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
         long middleBar = firstVisibleBar - (visibleBars / 2);
         
         datetime time_start = iTime(NULL, 0, middleBar + 5);
         datetime time_end = iTime(NULL, 0, middleBar);
         double price_top = iHigh(NULL, 0, middleBar);
         double price_bottom = iLow(NULL, 0, middleBar);
         CreateFibo("Fib2_" + TimeToString(current_time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), true, clrOrange, time_start, price_top, time_end, price_bottom);
      }
      else if(sparam == "btnFib3")
      {
         long firstVisibleBar, visibleBars;
         ChartGetInteger(0, CHART_FIRST_VISIBLE_BAR, 0, firstVisibleBar);
         ChartGetInteger(0, CHART_VISIBLE_BARS, 0, visibleBars);
         long middleBar = firstVisibleBar - (visibleBars / 2);

         datetime time_start = iTime(NULL, 0, middleBar + 5);
         datetime time_end = iTime(NULL, 0, middleBar);
         double price_top = iHigh(NULL, 0, middleBar);
         double price_bottom = iLow(NULL, 0, middleBar);
         CreateFibo("Fib3_" + TimeToString(current_time, TIME_DATE | TIME_MINUTES | TIME_SECONDS), true, clrGray, time_start, price_top, time_end, price_bottom);
      }
   }
    
   AppWindow.ChartEvent(id,lparam,dparam,sparam);
   // Restoring the dialog shows every control and clicking a locking tab
   // button toggles its pressed state, so re-apply the active tab afterwards
   if(id == CHARTEVENT_OBJECT_CLICK && !AppWindow.IsMinimized())
      ApplyTabVisibility();
   // Force immediate redraw
   ChartRedraw();
}

//+-----------------------------------------------------------------------+
//| Function to clean all prev appwindows on init                         |
//+-----------------------------------------------------------------------+
void CleanAppWindows()
{
   // Loop through all Edit objects and collect the {number} prefix of every
   // "Hx Helper" caption. The caption Edit has description (OBJPROP_TEXT)
   // "Hx Helper" and a name in the format {number}Caption, so the {number}
   // prefix is shared by all related objects.
   // Collect prefixes first, then delete, so deleting doesn't shift the indices
   // we are iterating over.
   string instanceNames[];
   int totalObjects = ObjectsTotal(0, 0, OBJ_EDIT);
   for (int i = 0; i < totalObjects; i++)
   {
      string objectName = ObjectName(0, i, 0, OBJ_EDIT);
      string caption;
      ObjectGetString(0, objectName, OBJPROP_TEXT, 0, caption);

      int captionPos = StringFind(objectName, "Caption");
      if (captionPos > 0 && StringFind(caption, "Hx Helper") == 0)
      {
         string instanceName = StringSubstr(objectName, 0, captionPos);
         int size = ArraySize(instanceNames);
         ArrayResize(instanceNames, size + 1);
         instanceNames[size] = instanceName;
      }
   }

   // Remove every object whose name starts with a collected {number} prefix
   for (int i = 0; i < ArraySize(instanceNames); i++)
   {
      PrintFormat("Remove windows %s on %s", instanceNames[i], _Symbol);
      ObjectsDeleteAll(0, instanceNames[i], 0, -1);
   }
}

//+-----------------------------------------------------------------------+
//| Function to Reconstruct TradeElements on init                         |
//+-----------------------------------------------------------------------+
void ReconstructTradeElements()
{
   // Loop through all objects on the chart
   int totalObjects = ObjectsTotal(0);
   for (int i = 0; i < totalObjects; i++)
   {
      string objectName = ObjectName(0, i);
      
      // Check if the object is a MainRectangle for a trade element
      if (StringFind(objectName, "SELL_") == 0 || StringFind(objectName, "BUY_") == 0)
      {
         if (StringFind(objectName, "_MainRectangle") > 0)
         {
            // Extract the instance name
            string instanceName = StringSubstr(objectName, 0, StringFind(objectName, "_MainRectangle"));
            bool isBuy = StringFind(instanceName, "BUY_") == 0;
            double currentPrice = ObjectGetDouble(0, instanceName + "_Arrow", OBJPROP_PRICE, 0);
            
            double highPrice,lowPrice; 
            double redPrice0 = ObjectGetDouble(0, instanceName + "_RedRectangle", OBJPROP_PRICE, 0);
            double redPrice1 = ObjectGetDouble(0, instanceName + "_RedRectangle", OBJPROP_PRICE, 1);
            double greenPrice0 = ObjectGetDouble(0, instanceName + "_GreenRectangle", OBJPROP_PRICE, 0);
            double greenPrice1 = ObjectGetDouble(0, instanceName + "_GreenRectangle", OBJPROP_PRICE, 1);
               
            // Extract prices and other data from related objects
            if(isBuy)
            {
               highPrice = MathMax(greenPrice0, greenPrice1);
               lowPrice = MathMin(redPrice0,redPrice1);
            }
            else
            {
               highPrice = MathMax(redPrice0,redPrice1);
               lowPrice = MathMin(greenPrice0, greenPrice1);
            }
            
            // Create a new trade element
            CTradeElement *element = new CTradeElement(0, instanceName, currentPrice, highPrice, lowPrice, isBuy, 1.0);
            tradeElements.Add(element);
            
            PrintFormat("Reconstructed trade element: %s", instanceName);
         }
      }
   }
}

//+-----------------------------------------------------------------------+
//| Function to Delete Indicator By Handle                                |
//+-----------------------------------------------------------------------+
void DeleteIndicatorByHandleId(int &handleId)
{
   // Iterate backwards: deleting shifts the indices that follow
   int totalIndicators = ChartIndicatorsTotal(0, 0);
   for(int i = totalIndicators - 1; i >= 0; i--)
   {
      string indName = ChartIndicatorName(0,0,i);
      // ChartIndicatorGet adds a reference to the handle, so every handle
      // obtained here must be released again
      int handle = ChartIndicatorGet(0, 0, indName);
      if(handle == handleId)
      {
         if(!ChartIndicatorDelete(0, 0, indName))
            PrintFormat("Failed to remove indicator %s from the chart. Error code  %d", indName, GetLastError());
         IndicatorRelease(handle);   // reference from ChartIndicatorGet
         IndicatorRelease(handleId); // original reference from iMA
         handleId = INVALID_HANDLE;
         return;
      }
      IndicatorRelease(handle);
   }
}

//+------------------------------------------------------------------+
//| Add a new trade element                                          |
//+------------------------------------------------------------------+
void AddTradeElement(string instanceName, double currentPrice, double lotSize, double high, double low, bool isBuy, datetime time)
{
   if (tradeElements == NULL)
      return;

   CTradeElement *newElement = new CTradeElement(0, instanceName, currentPrice, high, low, isBuy, lotSize);
   newElement.create(time);
   tradeElements.Add(newElement);
}

//+------------------------------------------------------------------+
//| Update all trade elements                                        |
//+------------------------------------------------------------------+
void UpdateTradeElement(string instanceName)
{
   if (tradeElements == NULL)
      return;

   // Search for the trade element by instance name
    for (int i = 0; i < tradeElements.Total(); i++)
    {
        CTradeElement *element = (CTradeElement *)tradeElements.At(i);
        if (element != NULL && element.GetInstanceName() == instanceName)
        {
            // Call the update method for the trade element
            element.update();
            return;
        }
    }
}

//+------------------------------------------------------------------+
//| Remove all trade elements                                        |
//+------------------------------------------------------------------+
void RemoveAllTradeElements()
{
   if (tradeElements == NULL)
      return;
      
   for (int i = 0; i < tradeElements.Total(); i++)
   {
      CTradeElement *tradeElement = (CTradeElement *)tradeElements.At(i);
      if (tradeElement != NULL)
      {
         tradeElement.remove();
         delete tradeElement;
      }
   }
   tradeElements.Clear();
}

//+------------------------------------------------------------------+
//| Create the button                                                |
//+------------------------------------------------------------------+
bool CreateButton(CButton &btn, string name, string text, int x1, int y1, int x2, int y2)
{
   //--- create
   if(!btn.Create(0,name,0,x1,y1,x2,y2))
      return(false);
   if(!btn.Text(text))
      return(false);
   if(!AppWindow.Add(btn))
      return(false);
   //--- succeed
   return(true);
}
 
//+------------------------------------------------------------------+
//| Capture screenshots for all required timeframes                  |
//+------------------------------------------------------------------+
void CaptureScreenshots(const string folder)
{
   ENUM_TIMEFRAMES  currentTimeframe = ChartPeriod(0);
   
   // Hide all trade elements
   if (tradeElements != NULL)
   {
      for (int i = 0; i < tradeElements.Total(); i++)
      {
         CTradeElement *element = (CTradeElement *)tradeElements.At(i);
         if (element != NULL)
         {
            element.hide();
         }
      }
   }
   
   long cChartbg = ChartGetInteger(0, CHART_COLOR_BACKGROUND, 0);
   long cChartfg = ChartGetInteger(0, CHART_COLOR_FOREGROUND, 0);
   long cChartu = ChartGetInteger(0, CHART_COLOR_CHART_UP, 0);
   long cChartd = ChartGetInteger(0, CHART_COLOR_CHART_DOWN, 0);
   long cChartbu = ChartGetInteger(0, CHART_COLOR_CANDLE_BULL, 0);
   long cChartbe = ChartGetInteger(0, CHART_COLOR_CANDLE_BEAR, 0);
   bool cChartShift = ChartGetInteger(0, CHART_SHIFT, 0);
   
   ChartSetInteger(0, CHART_COLOR_BACKGROUND, 0, clrWhite);
   ChartSetInteger(0, CHART_COLOR_FOREGROUND, 0, clrBlack);
   ChartSetInteger(0, CHART_COLOR_CHART_UP, 0, clrBlack);
   ChartSetInteger(0, CHART_COLOR_CHART_DOWN, 0, clrBlack);
   ChartSetInteger(0, CHART_COLOR_CANDLE_BULL, 0, clrWhite);
   ChartSetInteger(0, CHART_COLOR_CANDLE_BEAR, 0, clrBlack);
   ChartSetInteger(0, CHART_SHIFT, 0, false);
   
   AppWindow.Minimize();
   AppWindow.Hide();
   
   Sleep(500); // Allow chart to load
   
   SaveChartScreenshot(folder, currentTimeframe);
   
   // Show all trade elements again
   if (tradeElements != NULL)
   {
      for (int i = 0; i < tradeElements.Total(); i++)
      {
         CTradeElement *element = (CTradeElement *)tradeElements.At(i);
         if (element != NULL)
         {
            element.show();
         }
      }
   }
   
   ChartSetInteger(0, CHART_COLOR_BACKGROUND, 0, cChartbg);
   ChartSetInteger(0, CHART_COLOR_FOREGROUND, 0, cChartfg);
   ChartSetInteger(0, CHART_COLOR_CHART_UP, 0, cChartu);
   ChartSetInteger(0, CHART_COLOR_CHART_DOWN, 0, cChartd);
   ChartSetInteger(0, CHART_COLOR_CANDLE_BULL, 0, cChartbu);
   ChartSetInteger(0, CHART_COLOR_CANDLE_BEAR, 0, cChartbe);
   ChartSetInteger(0, CHART_SHIFT, 0, cChartShift);
   
   Sleep(500); // Allow chart to load
   AppWindow.Show();
   AppWindow.Maximize();
   ApplyTabVisibility(); // Maximize shows all controls again
}

//+------------------------------------------------------------------+
//| Save chart screenshot                                            |
//+------------------------------------------------------------------+
bool SaveChartScreenshot(const string filepath, const ENUM_TIMEFRAMES timeframe, const long chartId = 0)
{
   string filename = filepath + "\\" + EnumToString(timeframe) + ".png";
   if (ChartScreenShot(chartId, filename, 1920*2, 1080))
   {
      // screenshot commands are queued on the chart, wait until the file
      // shows up before the caller closes the chart
      uint start = GetTickCount();
      while(!FileIsExist(filename) && GetTickCount() - start < 2000) {}
      Print("Screenshot saved: ", filename);
      return true;
   }
   else
   {
      Print("Error saving screenshot: ", filename);
      return false;
   }
}

//+------------------------------------------------------------------+
//| Export today's trades: CSV summary + clean screenshots           |
//+------------------------------------------------------------------+
void ExportTodaysTrades()
{
   Print("Journal export started...");

   JournalTrade trades[];
   CollectTodaysTrades(trades);

   int total = ArraySize(trades);
   if(total == 0)
   {
      // MessageBox is silently ignored in indicators - use Alert instead
      Alert("Journal Export: no trades found for today.");
      return;
   }

   string currentDate = TimeToString(TimeCurrent(), TIME_DATE);
   string dayFolder = JournalBasePath + "\\" + currentDate;
   if(!CreateFolder(dayFolder, false))
   {
      Print("Error creating folder structure.");
      return;
   }

   string csvFile = WriteTradesCsv(trades, dayFolder, currentDate);
   string json = BuildTradesJson(trades);
   WriteTradesJson(json, dayFolder, currentDate);
   int shots = CaptureTradeScreenshots(trades, dayFolder);

   string uploadNote = "";
   if(UploadToApi)
      uploadNote = UploadTradesToApi(json) ? "\nUploaded to trade API." : "\nAPI upload failed - see Experts log.";

   Alert(StringFormat("Journal Export: exported %d trade(s) to MQL5\\Files\\%s - %d screenshot(s) captured.%s",
         total, csvFile, shots, uploadNote));
}

//+------------------------------------------------------------------+
//| Upload the current Test-tab fibos without writing CSV/JSON files |
//+------------------------------------------------------------------+
void ExportBacktestToApi()
{
   string tradeNames[];
   int total = ObjectsTotal(0, 0, OBJ_FIBO);
   for(int i = 0; i < total; i++)
   {
      string name = ObjectName(0, i, 0, OBJ_FIBO);
      string pfx = StringSubstr(name, 0, 3);
      if(pfx == "WB_" || pfx == "WS_" || pfx == "LB_" || pfx == "LS_")
      {
         int sz = ArraySize(tradeNames);
         ArrayResize(tradeNames, sz + 1);
         tradeNames[sz] = name;
      }
   }

   int n = ArraySize(tradeNames);
   if(n == 0)
   {
      Alert("Backtest API export: no test trades found.");
      return;
   }
   for(int a = 0; a < n - 1; a++)
      for(int b = a + 1; b < n; b++)
         if(StringSubstr(tradeNames[a], 3) > StringSubstr(tradeNames[b], 3))
         {
            string tmp = tradeNames[a];
            tradeNames[a] = tradeNames[b];
            tradeNames[b] = tmp;
         }

   string accountId = StringFormat("%I64d", AccountInfoInteger(ACCOUNT_LOGIN));
   string batchId = accountId + "-"
                  + TimeToString(TimeCurrent(), TIME_DATE | TIME_MINUTES | TIME_SECONDS);
   StringReplace(batchId, ".", "");
   StringReplace(batchId, ":", "");
   StringReplace(batchId, " ", "-");
   string json = "{\"batch_id\":\"" + batchId + "\",\"account\":"
               + accountId
               + ",\"symbol\":\"" + Symbol() + "\",\"trades\":[";
   for(int i = 0; i < n; i++)
   {
      string pfx = StringSubstr(tradeNames[i], 0, 3);
      string dt = StringSubstr(tradeNames[i], 3);
      string type = (pfx == "WB_" || pfx == "LB_") ? "Buy" : "Sell";
      string result = (pfx == "WB_" || pfx == "WS_") ? "Win" : "Lose";
      datetime t1 = (datetime)ObjectGetInteger(0, tradeNames[i], OBJPROP_TIME, 0);
      datetime t2 = (datetime)ObjectGetInteger(0, tradeNames[i], OBJPROP_TIME, 1);
      int duration = (int)(MathAbs((double)(t2 - t1)) / 60);
      if(i > 0) json += ",";
      json += "{\"trade_number\":" + IntegerToString(i + 1)
           + ",\"trade_time\":\"" + dt + "\",\"type\":\"" + type
           + "\",\"result\":\"" + result + "\",\"duration_min\":"
           + IntegerToString(duration) + "}";
   }
   json += "]}";

   string url = ApiUrl;
   int marker = StringFind(url, "/api/import");
   if(marker >= 0)
      url = StringSubstr(url, 0, marker) + "/api/backtests/import";
   else
      url += "/api/backtests/import";

   int status = UploadJson(url, ApiKey, json, 10000);
   string response;
   StringInit(response, 2048);
   GetLastResponse(response, 2048);
   if(status >= 200 && status < 300)
      Alert("Backtest API export complete: " + IntegerToString(n) + " trade(s).");
   else
      Alert("Backtest API export failed (HTTP " + IntegerToString(status) + "): " + response);
}

//+------------------------------------------------------------------+
//| Export the whole account history: JSON + API upload, no shots.   |
//| The payload is flagged skip_existing so the dashboard only       |
//| inserts position ids it does not have yet.                       |
//+------------------------------------------------------------------+
void ExportAllTrades()
{
   Print("Full history export started...");

   JournalTrade trades[];
   CollectTrades(0, trades);

   int total = ArraySize(trades);
   if(total == 0)
   {
      Alert("Journal Export: no trades found in the account history.");
      return;
   }

   string json = BuildTradesJson(trades, true);

   string currentDate = TimeToString(TimeCurrent(), TIME_DATE);
   WriteTradesJson(json, JournalBasePath, "all_" + currentDate);

   string uploadNote = "";
   if(UploadToApi)
      uploadNote = UploadTradesToApi(json) ? " Uploaded to dashboard (existing position ids are skipped there)." : " API upload failed - see Experts log.";

   Alert(StringFormat("Journal Export: %d trade(s) from full history written to MQL5\\Files\\%s.%s",
         total, JournalBasePath + "\\trades_all_" + currentDate + ".json", uploadNote));
}

//+------------------------------------------------------------------+
//| Build the JSON payload the trade API expects                     |
//+------------------------------------------------------------------+
string BuildTradesJson(JournalTrade &trades[], const bool skipExisting = false)
{
   string json = "{\"account\":" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))
               + ",\"export_time\":\"" + TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS) + "\""
               + (skipExisting ? ",\"skip_existing\":true" : "")
               + ",\"trades\":[";
   for(int i = 0; i < ArraySize(trades); i++)
   {
      int digits = (int)SymbolInfoInteger(trades[i].symbol, SYMBOL_DIGITS);
      if(i > 0)
         json += ",";
      json += "{\"position_id\":" + IntegerToString(trades[i].positionId)
            + ",\"symbol\":\""    + trades[i].symbol + "\""
            + ",\"type\":\""      + trades[i].type + "\""
            + ",\"result\":\""    + FormatTradeResult(trades[i]) + "\""
            + ",\"rr\":\""        + FormatTradeRR(trades[i]) + "\""
            + ",\"entry_price\":" + DoubleToString(trades[i].entryPrice, digits)
            + ",\"stop_loss\":"   + DoubleToString(trades[i].stopLoss, digits)
            + ",\"take_profit\":" + DoubleToString(trades[i].takeProfit, digits)
            + ",\"close_price\":" + DoubleToString(trades[i].closePrice, digits)
            + ",\"profit\":"      + DoubleToString(trades[i].profit, 2)
            + ",\"open_time\":\"" + TimeToString(trades[i].openTime, TIME_DATE | TIME_SECONDS) + "\""
            + ",\"close_time\":\"" + (trades[i].isOpen ? "" : TimeToString(trades[i].closeTime, TIME_DATE | TIME_SECONDS)) + "\""
            + ",\"is_open\":"     + (trades[i].isOpen ? "true" : "false")
            + "}";
   }
   json += "]}";
   return json;
}

//+------------------------------------------------------------------+
//| Write the JSON payload next to the CSV as a local record         |
//+------------------------------------------------------------------+
void WriteTradesJson(const string json, const string dayFolder, const string currentDate)
{
   string fileName = dayFolder + "\\trades_" + currentDate + ".json";
   int fh = FileOpen(fileName, FILE_WRITE | FILE_ANSI | FILE_TXT);
   if(fh == INVALID_HANDLE)
   {
      Print("Journal export: failed to open file ", fileName, "  error=", GetLastError());
      return;
   }
   FileWriteString(fh, json);
   FileClose(fh);
   Print("JSON export written: ", fileName);
}

//+------------------------------------------------------------------+
//| POST the trades to the API through the .NET HxTradeUploader.dll. |
//| DLL calls (unlike WebRequest) are allowed in indicators; enable  |
//| "Allow DLL imports" in the terminal and the program properties   |
//+------------------------------------------------------------------+
bool UploadTradesToApi(const string json)
{
   if(ApiUrl == "")
      return false;

   int status = UploadJson(ApiUrl, ApiKey, json, 10000);

   string response;
   StringInit(response, 8192);
   int len = GetLastResponse(response, 8192);
   response = StringSubstr(response, 0, len);

   if(status >= 200 && status < 300)
   {
      Print("Trades uploaded to API: ", response);
      return true;
   }
   if(status == -1)
      Print("API upload failed: ", response, ". Check that the API is running at '", ApiUrl, "'.");
   else
      Print("API returned HTTP ", status, ": ", response);
   return false;
}

//+------------------------------------------------------------------+
//| Collect today's trades from history and open positions           |
//+------------------------------------------------------------------+
void CollectTodaysTrades(JournalTrade &trades[])
{
   datetime now = TimeCurrent();
   MqlDateTime dt = {};
   TimeToStruct(now, dt);
   dt.hour = 0;
   dt.min  = 0;
   dt.sec  = 0;
   CollectTrades(StructToTime(dt), trades);
}

//+------------------------------------------------------------------+
//| Collect trades closed or opened since fromTime (0 = all history) |
//+------------------------------------------------------------------+
void CollectTrades(const datetime fromTime, JournalTrade &trades[])
{
   ArrayResize(trades, 0);

   datetime now = TimeCurrent();

   // Find positions with at least one closing deal in the window
   long closedIds[];
   ArrayResize(closedIds, 0);
   if(HistorySelect(fromTime, now + 60))
   {
      int dealsTotal = HistoryDealsTotal();
      for(int i = 0; i < dealsTotal; i++)
      {
         ulong deal = HistoryDealGetTicket(i);
         if(deal == 0)
            continue;
         long dealType = HistoryDealGetInteger(deal, DEAL_TYPE);
         if(dealType != DEAL_TYPE_BUY && dealType != DEAL_TYPE_SELL)
            continue;
         long entry = HistoryDealGetInteger(deal, DEAL_ENTRY);
         if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_INOUT && entry != DEAL_ENTRY_OUT_BY)
            continue;
         long posId = HistoryDealGetInteger(deal, DEAL_POSITION_ID);
         bool known = false;
         for(int k = 0; k < ArraySize(closedIds); k++)
         {
            if(closedIds[k] == posId)
            {
               known = true;
               break;
            }
         }
         if(!known)
         {
            int sz = ArraySize(closedIds);
            ArrayResize(closedIds, sz + 1);
            closedIds[sz] = posId;
         }
      }
   }

   for(int i = 0; i < ArraySize(closedIds); i++)
   {
      JournalTrade t;
      if(BuildTradeFromHistory(closedIds[i], t))
      {
         int sz = ArraySize(trades);
         ArrayResize(trades, sz + 1);
         trades[sz] = t;
      }
   }

   // Positions opened in the window and still running
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      long posId = (long)PositionGetInteger(POSITION_IDENTIFIER);

      // a partially closed position is already in the list - just flag it as still open
      bool found = false;
      for(int k = 0; k < ArraySize(trades); k++)
      {
         if(trades[k].positionId == posId)
         {
            trades[k].isOpen = true;
            found = true;
            break;
         }
      }
      if(found)
         continue;

      datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
      if(openTime < fromTime)
         continue;

      JournalTrade t;
      t.positionId = posId;
      t.symbol     = PositionGetString(POSITION_SYMBOL);
      t.type       = ((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "Buy" : "Sell";
      t.openTime   = openTime;
      t.closeTime  = 0;
      t.entryPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      t.stopLoss   = PositionGetDouble(POSITION_SL);
      t.takeProfit = PositionGetDouble(POSITION_TP);
      t.closePrice = 0;
      t.profit     = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      t.isOpen     = true;
      int sz = ArraySize(trades);
      ArrayResize(trades, sz + 1);
      trades[sz] = t;
   }
}

//+------------------------------------------------------------------+
//| Build a trade record from the deals of a closed position         |
//+------------------------------------------------------------------+
bool BuildTradeFromHistory(const long positionId, JournalTrade &t)
{
   if(!HistorySelectByPosition(positionId))
      return false;

   t.positionId = positionId;
   t.symbol     = "";
   t.type       = "";
   t.openTime   = 0;
   t.closeTime  = 0;
   t.entryPrice = 0;
   t.stopLoss   = 0;
   t.takeProfit = 0;
   t.closePrice = 0;
   t.profit     = 0;
   t.isOpen     = false;

   bool haveIn = false;
   int dealsTotal = HistoryDealsTotal();
   for(int i = 0; i < dealsTotal; i++)
   {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0)
         continue;
      long dealType = HistoryDealGetInteger(deal, DEAL_TYPE);
      if(dealType != DEAL_TYPE_BUY && dealType != DEAL_TYPE_SELL)
         continue;

      t.profit += HistoryDealGetDouble(deal, DEAL_PROFIT)
                + HistoryDealGetDouble(deal, DEAL_SWAP)
                + HistoryDealGetDouble(deal, DEAL_COMMISSION);

      // deals carry the position SL/TP that was active at execution time
      double dealSl = HistoryDealGetDouble(deal, DEAL_SL);
      double dealTp = HistoryDealGetDouble(deal, DEAL_TP);
      if(dealSl > 0)
         t.stopLoss = dealSl;
      if(dealTp > 0)
         t.takeProfit = dealTp;

      long entry = HistoryDealGetInteger(deal, DEAL_ENTRY);
      if(entry == DEAL_ENTRY_IN && !haveIn)
      {
         haveIn = true;
         t.symbol     = HistoryDealGetString(deal, DEAL_SYMBOL);
         t.type       = (dealType == DEAL_TYPE_BUY) ? "Buy" : "Sell";
         t.openTime   = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
         t.entryPrice = HistoryDealGetDouble(deal, DEAL_PRICE);
      }
      else if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_INOUT || entry == DEAL_ENTRY_OUT_BY)
      {
         t.closeTime  = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
         t.closePrice = HistoryDealGetDouble(deal, DEAL_PRICE);
      }
   }
   return haveIn;
}

//+------------------------------------------------------------------+
//| Win / Lose / BreakEven / Open                                    |
//+------------------------------------------------------------------+
string FormatTradeResult(const JournalTrade &t)
{
   if(t.isOpen)
      return "Open";
   if(t.profit > 0)
      return "Win";
   if(t.profit < 0)
      return "Lose";
   return "BreakEven";
}

//+------------------------------------------------------------------+
//| Planned R:R from entry / SL / TP distances                       |
//+------------------------------------------------------------------+
string FormatTradeRR(const JournalTrade &t)
{
   if(t.stopLoss <= 0 || t.takeProfit <= 0)
      return "";
   double risk   = MathAbs(t.entryPrice - t.stopLoss);
   double reward = MathAbs(t.takeProfit - t.entryPrice);
   if(risk <= 0)
      return "";
   return StringFormat("1:%.2f", reward / risk);
}

//+------------------------------------------------------------------+
//| Write today's trades to a CSV file                               |
//+------------------------------------------------------------------+
string WriteTradesCsv(JournalTrade &trades[], const string dayFolder, const string currentDate)
{
   string fileName = dayFolder + "\\trades_" + currentDate + ".csv";
   int fh = FileOpen(fileName, FILE_WRITE | FILE_ANSI | FILE_CSV, ',');
   if(fh == INVALID_HANDLE)
   {
      Print("Journal export: failed to open file ", fileName, "  error=", GetLastError());
      return fileName;
   }

   FileWrite(fh, "Trade #", "Symbol", "Type", "Result", "R:R", "Entry Price", "SL", "TP", "Close Price", "Profit", "Open Date", "Open Time", "Close Date", "Close Time", "Position ID");
   for(int i = 0; i < ArraySize(trades); i++)
   {
      int digits = (int)SymbolInfoInteger(trades[i].symbol, SYMBOL_DIGITS);
      FileWrite(fh, i + 1,
                trades[i].symbol,
                trades[i].type,
                FormatTradeResult(trades[i]),
                FormatTradeRR(trades[i]),
                DoubleToString(trades[i].entryPrice, digits),
                trades[i].stopLoss   > 0 ? DoubleToString(trades[i].stopLoss, digits)   : "",
                trades[i].takeProfit > 0 ? DoubleToString(trades[i].takeProfit, digits) : "",
                trades[i].isOpen ? "" : DoubleToString(trades[i].closePrice, digits),
                DoubleToString(trades[i].profit, 2),
                TimeToString(trades[i].openTime, TIME_DATE),
                TimeToString(trades[i].openTime, TIME_SECONDS),
                trades[i].isOpen ? "" : TimeToString(trades[i].closeTime, TIME_DATE),
                trades[i].isOpen ? "" : TimeToString(trades[i].closeTime, TIME_SECONDS),
                trades[i].positionId);
   }
   FileClose(fh);
   Print("Trades exported to: ", TerminalInfoString(TERMINAL_DATA_PATH), "\\MQL5\\Files\\", fileName);
   return fileName;
}

//+------------------------------------------------------------------+
//| Capture H1 / M5 / M1 clean screenshots for every trade           |
//+------------------------------------------------------------------+
int CaptureTradeScreenshots(JournalTrade &trades[], const string dayFolder)
{
   ENUM_TIMEFRAMES timeframes[] = {PERIOD_H1, PERIOD_M5, PERIOD_M1};
   int saved = 0;

   for(int i = 0; i < ArraySize(trades); i++)
   {
      string symbolFolder = dayFolder + "\\" + trades[i].symbol;
      string tradeTime = TimeToString(trades[i].openTime, TIME_MINUTES);
      StringReplace(tradeTime, ":", "_");
      string tradeFolder = symbolFolder + "\\" + tradeTime + "_" + IntegerToString(trades[i].positionId);

      if(!CreateFolder(symbolFolder, false) || !CreateFolder(tradeFolder, false))
      {
         Print("Error creating folder structure for trade ", trades[i].positionId);
         continue;
      }

      for(int j = 0; j < ArraySize(timeframes); j++)
      {
         if(CaptureCleanScreenshot(trades[i].symbol, timeframes[j], trades[i].openTime, tradeFolder))
            saved++;
      }
   }
   return saved;
}

//+------------------------------------------------------------------+
//| Screenshot on a freshly opened chart: no user objects on it      |
//+------------------------------------------------------------------+
bool CaptureCleanScreenshot(const string symbol, const ENUM_TIMEFRAMES timeframe, const datetime tradeTime, const string folder)
{
   SymbolSelect(symbol, true);
   WaitForChartData(symbol, timeframe);

   long chartId = ChartOpen(symbol, timeframe);
   if(chartId <= 0)
   {
      Print("Failed to open ", symbol, " ", EnumToString(timeframe), " chart. Error ", GetLastError());
      return false;
   }

   ApplyCleanChartLook(chartId);

   // scroll so the trade bar is visible with some bars of context after it
   int barIndex = iBarShift(symbol, timeframe, tradeTime);
   if(barIndex >= 0)
   {
      int shift = -(barIndex - 20);
      if(shift > 0)
         shift = 0;
      ChartNavigate(chartId, CHART_END, shift);
   }

   ChartSetInteger(chartId, CHART_BRING_TO_TOP, true);
   ChartRedraw(chartId);

   bool ok = SaveChartScreenshot(folder, timeframe, chartId);
   ChartClose(chartId);
   return ok;
}

//+------------------------------------------------------------------+
//| Same black & white scheme btnJournal used on the main chart      |
//+------------------------------------------------------------------+
void ApplyCleanChartLook(const long chartId)
{
   ChartSetInteger(chartId, CHART_MODE, CHART_CANDLES);
   ChartSetInteger(chartId, CHART_COLOR_BACKGROUND, clrWhite);
   ChartSetInteger(chartId, CHART_COLOR_FOREGROUND, clrBlack);
   ChartSetInteger(chartId, CHART_COLOR_CHART_UP, clrBlack);
   ChartSetInteger(chartId, CHART_COLOR_CHART_DOWN, clrBlack);
   ChartSetInteger(chartId, CHART_COLOR_CANDLE_BULL, clrWhite);
   ChartSetInteger(chartId, CHART_COLOR_CANDLE_BEAR, clrBlack);
   ChartSetInteger(chartId, CHART_COLOR_CHART_LINE, clrBlack);
   ChartSetInteger(chartId, CHART_SHOW_GRID, false);
   ChartSetInteger(chartId, CHART_SHOW_VOLUMES, CHART_VOLUME_HIDE);
   ChartSetInteger(chartId, CHART_SHOW_TRADE_LEVELS, false);
   ChartSetInteger(chartId, CHART_SHOW_OHLC, false);
   ChartSetInteger(chartId, CHART_SHOW_ONE_CLICK, false);
   ChartSetInteger(chartId, CHART_SHIFT, false);
   ChartSetInteger(chartId, CHART_AUTOSCROLL, false);
   // the default template may carry objects of its own
   ObjectsDeleteAll(chartId, -1, -1);
}

//+------------------------------------------------------------------+
//| Make sure symbol/timeframe history is built before the shot      |
//+------------------------------------------------------------------+
void WaitForChartData(const string symbol, const ENUM_TIMEFRAMES timeframe)
{
   // Sleep() is not available in indicators, so poll on the clock instead
   uint start = GetTickCount();
   while(GetTickCount() - start < 2000)
   {
      if(SeriesInfoInteger(symbol, timeframe, SERIES_SYNCHRONIZED))
         break;
      iBars(symbol, timeframe); // trigger history download/build
   }
}

//+------------------------------------------------------------------+
//| Try creating a folder and display a message about that           |
//+------------------------------------------------------------------+
bool CreateFolder(string folder_path,bool common_flag)
{
   int flag=common_flag?FILE_COMMON:0;
   string working_folder;
   //--- define the full path depending on the common_flag parameter
   if(common_flag)
      working_folder=TerminalInfoString(TERMINAL_COMMONDATA_PATH)+"\\MQL5\\Files";
   else
      working_folder=TerminalInfoString(TERMINAL_DATA_PATH)+"\\MQL5\\Files";
   //--- debugging message  
   //PrintFormat("folder_path=%s",folder_path);
   //--- attempt to create a folder relative to the MQL5\Files path
   if(FolderCreate(folder_path,flag))
     {
      //--- display the full path for the created folder
      //PrintFormat("Created the folder %s",working_folder+"\\"+folder_path);
      //--- reset the error code
      ResetLastError();
      //--- successful execution
      return true;
     }
   else
      PrintFormat("Failed to create the folder %s. Error code %d",working_folder+folder_path,GetLastError());
   //--- execution failed
   return false;
}

//+------------------------------------------------------------------+
//| Create rectangle order block                                     |
//+------------------------------------------------------------------+
void CreateRectangle(string label, bool fill, color rect_color, datetime x1, double y1, datetime x2, double y2)
{
   // Create the rectangle object
   if(ObjectCreate(0, label, OBJ_RECTANGLE, 0, x1, y1, x2, y2))
   {
      // Set the color of the rectangle
      ObjectSetInteger(0, label, OBJPROP_COLOR, rect_color);

      // Fill the rectangle if 'fill' is true
      ObjectSetInteger(0, label, OBJPROP_STYLE, fill ? STYLE_SOLID : STYLE_DASH);
      ObjectSetInteger(0, label, OBJPROP_FILL, fill);

      // Set the background (whether it should appear behind the chart objects)
      ObjectSetInteger(0, label, OBJPROP_BACK, true);

      // Set the thickness of the border line (for unfilled rectangles)
      ObjectSetInteger(0, label, OBJPROP_WIDTH, 1);

      // Select the rectangle for future manipulation
      ObjectSetInteger(0, label, OBJPROP_SELECTABLE, true);
      ObjectSetInteger(0, label, OBJPROP_SELECTED, true);
   }
   else
   {
      Print("Error creating rectangle: ", GetLastError());
   }
}

//+------------------------------------------------------------------+
//| Create Fib                                  |
//+------------------------------------------------------------------+
void CreateFibo(string label, bool fill, color Fib_color, datetime x1, double y1, datetime x2, double y2)
{
   // Create the rectangle object
   if(ObjectCreate(0, label, OBJ_FIBO, 0, x1, y1, x2, y2))
   {
      // Set the color of the rectangle
      ObjectSetInteger(0, label, OBJPROP_COLOR, Fib_color);

      // Fill the rectangle if 'fill' is true
      ObjectSetInteger(0, label, OBJPROP_STYLE, fill ? STYLE_SOLID : STYLE_DASH);
      ObjectSetInteger(0, label, OBJPROP_FILL, fill);

      // Set the background (whether it should appear behind the chart objects)
      ObjectSetInteger(0, label, OBJPROP_BACK, true);

      // Set the thickness of the border line (for unfilled rectangles)
      ObjectSetInteger(0, label, OBJPROP_WIDTH, 1);

      // Select the rectangle for future manipulation
      ObjectSetInteger(0, label, OBJPROP_SELECTABLE, true);
      ObjectSetInteger(0, label, OBJPROP_SELECTED, true);
      ObjectSetInteger(0, label, OBJPROP_RAY_LEFT,false);
      ObjectSetInteger(0, label, OBJPROP_RAY_RIGHT,false);
      
      string fibLevels[][2] = {{"0","SL"},
                               //{"0.236","78.6%"},
                               //{"0.382","62.8%"},
                               {"0.5","50%"}, 
                               {"1", "E"},
                               {"2","TP1"},
                               {"3","TP2"},
                               {"4","TP3"},
                               {"5","TP4"},
                               {"6","TP5"},
                               {"7","TP6"},
                               {"8","TP7"}};
      int n = ArrayRange(fibLevels, 0);
      ObjectSetInteger(0, label, OBJPROP_LEVELS, n);

      for(int i = 0; i < n; i++)
      {
      //--- level value
      ObjectSetDouble(0, label, OBJPROP_LEVELVALUE, i, StringToDouble(fibLevels[i][0]));
      //--- level color
      ObjectSetInteger(0, label, OBJPROP_LEVELCOLOR, i, Fib_color);
      //--- level style
      ObjectSetInteger(0, label, OBJPROP_LEVELSTYLE, i, fill ? STYLE_SOLID : STYLE_DASH);
      //--- level width
      ObjectSetInteger(0, label, OBJPROP_LEVELWIDTH, i, 1);
      //--- level description
      ObjectSetString(0, label, OBJPROP_LEVELTEXT, i, fibLevels[i][1]);
      }
   }
   else
   {
      Print("Error creating rectangle: ", GetLastError());
   }
}

void RefreshLines()
{
   DeleteLines();
   UpdateLines();
   GenerateLevelNumbers();
}

void DeleteLines()
{
   string lines[] = {"SpreadText", "TimeLeft","Tokyo_indicator","London_indicator","NewYork_indicator","News_indicator"};
   for (int i = 0; i < ArraySize(lines); i++)
   {
      ObjectDelete(0, lines[i]);
   }
   ObjectsDeleteAll(0, "StepLine_", 0, OBJ_TREND);
   ObjectsDeleteAll(0, "LimitLine_", 0, OBJ_TREND);
   ObjectsDeleteAll(0, "Vertical_", 0, OBJ_VLINE);
   ObjectsDeleteAll(0, "NewsList_", 0, OBJ_LABEL);
   newsListRows = 0;
}
 
void InitSpreadIndicator()
{
   CreateIndicator(160, 10, "SpreadText", clrLimeGreen);
   
   double current_bid = SymbolInfoDouble(Symbol(), SYMBOL_BID);
   double current_ask = SymbolInfoDouble(Symbol(), SYMBOL_ASK); 
   long spread = SymbolInfoInteger(Symbol(), SYMBOL_SPREAD);
   string spread_str = StringFormat("%.f(%.2f$) Spread", spread,current_ask-current_bid);
   
   SetIndicatorText("SpreadText", spread_str, clrLimeGreen);
}

void CreateIndicator(int x, int y, string name, color clr)
{
if (ObjectFind(0, name) == -1)
   {
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
      ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
      ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 12);
   }
}

void SetIndicatorText(string name, string text, color clr)
{
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
}

void InitCandleTimer()
{
   if (ObjectFind(0, "TimeLeft") == -1)
   {
      ObjectCreate(0, "TimeLeft", OBJ_TEXT, 0, 0, 0);
      ObjectSetInteger(0, "TimeLeft", OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(0, "TimeLeft", OBJPROP_FONTSIZE, 10);
   }
   datetime curr_time = TimeCurrent();
   datetime candle_close_time = iTime(NULL, PERIOD_CURRENT, 0) + PeriodSeconds(PERIOD_CURRENT);
   int remaining_seconds = int(candle_close_time - curr_time);
   
   int hours = remaining_seconds / 3600;
   int minutes = (remaining_seconds % 3600) / 60;
   int seconds = remaining_seconds % 60;
   string time_str;
   if(hours > 0)
   {
      time_str = StringFormat("<--%02d:%02d:%02d", hours, minutes, seconds);
   }
   else
   {
      time_str = StringFormat("<--%02d:%02d", minutes, seconds);
   }  
   double low = iClose(Symbol(), PERIOD_CURRENT, 0);;  
   ObjectSetDouble(0, "TimeLeft", OBJPROP_PRICE, 0, low);
   ObjectSetInteger(0, "TimeLeft", OBJPROP_TIME, 0, candle_close_time); //3 min forward
   ObjectSetString(0, "TimeLeft", OBJPROP_TEXT, time_str);
}



void InitSessionsIndicator()
{
   if(ShowTokyoSession) DrawSessionLines("Tokyo", 140, 30, 1, 6, Color_TokyoSession);
   if(ShowLondonSession) DrawSessionLines("London", 140, 50, 7, 15.5, Color_LondonSession);
   if(ShowNewYorkSession) DrawSessionLines("NewYork", 140, 70, 13.5, 20, Color_NewYorkSession);
}
//+------------------------------------------------------------------+
//| Draw session lines                                               |
//+------------------------------------------------------------------+
void DrawSessionLines(string sessionName, int x, int y, double sessionStartGMT, double sessionEndGMT, color sessionColor)
  {
   double sessionStart = sessionStartGMT * 3600;
   double sessionEnd = sessionEndGMT * 3600;
   
   MqlDateTime localTime_struct={};
   TimeGMT(localTime_struct);
   int localTime = localTime_struct.hour * 3600 + localTime_struct.min * 60 + localTime_struct.sec;
   
   bool activeSession = localTime >= sessionStart && localTime <= sessionEnd;
   bool preSession = localTime < sessionStart;
   bool postSession = localTime > sessionEnd;
   
   color lineColor = clrWhite;
   string sessionStr = "";
   
   if(activeSession)
   {
      lineColor = sessionColor;
      int remaining_seconds = int(sessionEnd - localTime);
      if(!SummerTime)
        {
         remaining_seconds += 3600;
        }
      int hours = remaining_seconds / 3600;
      int minutes = (remaining_seconds % 3600) / 60;
      int seconds = remaining_seconds % 60;
      sessionStr = StringFormat("%02d:%02d:%02d  " + sessionName, hours, minutes, seconds);
   }
   else
   {
      int remaining_seconds;
      if(sessionStart > localTime)
      {
         remaining_seconds = int(sessionStart - localTime);
      }
      else
      {
         remaining_seconds = int(sessionStart + 86400 - localTime);
      }
      
      if(!SummerTime)
        {
         remaining_seconds += 3600;
        }
      int hours = remaining_seconds / 3600;
      int minutes = (remaining_seconds % 3600) / 60;
      int seconds = remaining_seconds % 60;
      sessionStr = StringFormat("%02d:%02d:%02d  " + sessionName, hours, minutes, seconds);
   }
   
   CreateIndicator(x, y, sessionName + "_indicator", lineColor);  
   SetIndicatorText(sessionName + "_indicator", sessionStr, lineColor);
}

void GenerateLevelNumbers()
{
   double todayHigh = iHigh(Symbol(), PERIOD_D1, 0);
   double todayLow = iLow(Symbol(), PERIOD_D1, 0);
   
   if(level1Enable)
   {
      GenerateRoundNumbers(todayLow, todayHigh, Level1);
   }
   
   if(level2Enable)
   {
      GenerateRoundNumbers(todayLow, todayHigh, Level2);
   }
   
   if(level3Enable)
   {
      GenerateRoundNumbers(todayLow, todayHigh, Level3);
   }
}

//+------------------------------------------------------------------+
//| Function to generate numbers with specified step                 |
//+------------------------------------------------------------------+
void GenerateRoundNumbers(double start, double end, double step)
{
   double firstRound = start - step - fmod(start, step);
   double endRound = end + step - fmod(end, step);
   if (fmod(start, step) == 0) firstRound = start;
   for (double current = firstRound; current <= endRound; current += step)
   {
      
      string name = "StepLine_" + DoubleToString(current);
      if (ObjectFind(0, name) < 0)
      {
         color clr;
         ENUM_LINE_STYLE style;
         int width;
         
         if(step == Level1)
         {
            clr = Color_Level1;
            style = Style_Level1;
            width = Width_Level1;
         }
         else if(step == Level2)
         {
            clr = Color_Level2;
            style = Style_Level2;
            width = Width_Level2;
         }
         //(step == Level3)
         else
         {
            clr = Color_Level3;
            style = Style_Level3;
            width = Width_Level3;
         }
         datetime startTime = iTime(Symbol(), PERIOD_D1, 0);
         datetime endTime = iTime(Symbol(), PERIOD_D1, 0) + 86400;
         DrawLimitLine(name, current, startTime, current, endTime, clr, style, width); // Last week's 25% line for this week
      }
   }
}  
  
//+------------------------------------------------------------------+
//| Function to update lines                                         |
//+------------------------------------------------------------------+
void UpdateLines()
{
   MqlDateTime dt;
   TimeCurrent(dt);
   
   double yesterdayClose= iClose(Symbol(), PERIOD_D1, 1);
   double yesterdayOpen = iOpen(NULL, PERIOD_D1, 1);
   double yesterdayHigh = iHigh(NULL, PERIOD_D1, 1);
   double yesterdayLow = iLow(NULL, PERIOD_D1, 1);
   double dayBeforeYesterdayClose= iClose(Symbol(), PERIOD_D1, 2);
   double lastWeekClose= iClose(Symbol(), PERIOD_D1, dt.day_of_week);
   
   double lastWeekHigh = iHigh(Symbol(), PERIOD_W1, 1);
   double lastWeekLow = iLow(Symbol(), PERIOD_W1, 1);
   double percent25 = lastWeekLow + (lastWeekHigh - lastWeekLow) * 0.25;
   double percent50 = lastWeekLow + (lastWeekHigh - lastWeekLow) * 0.50;
   double percent75 = lastWeekLow + (lastWeekHigh - lastWeekLow) * 0.75;
   
   datetime yesterdayStartTime = iTime(Symbol(), PERIOD_D1, 0);
   datetime yesterdayEndTime = iTime(Symbol(), PERIOD_D1, 0) + 86400;
   
   datetime dayBeforeYesterdayStartTime = iTime(Symbol(), PERIOD_D1, 1);
   datetime dayBeforeYesterdayEndTime = iTime(Symbol(), PERIOD_D1, 0) + 86400;
   
   datetime weekStartTime = iTime(Symbol(), PERIOD_D1, dt.day_of_week);
   datetime weekEndTime = iTime(Symbol(), PERIOD_D1, 0) + 86400; // Current day
   
   // Drawing lines for specific days
   if(atrEnable)
   {
      double dailyATR = CalculateATR(ATR_Period);
      DrawLimitLine("ATRTOP", yesterdayClose + dailyATR, yesterdayStartTime, yesterdayClose + dailyATR, yesterdayEndTime, ATR_Color, ATR_Style, 1);
      DrawLimitLine("ATRLow", yesterdayClose - dailyATR, yesterdayStartTime, yesterdayClose - dailyATR, yesterdayEndTime, ATR_Color, ATR_Style, 1);
   }
   if(yesterdayEnable)
   {
      // Yesterday's line for today and tomorrow
      DrawLimitLine("YesterdayClose", yesterdayClose, yesterdayStartTime, yesterdayClose, yesterdayEndTime, Color_Yesterday, Style_Yesterday, Width_Yesterday);
      DrawLimitLine("YesterdayOpen", yesterdayOpen, yesterdayStartTime, yesterdayOpen, yesterdayEndTime, Color_YesterdayOpen, Style_Yesterday, Width_Yesterday);
      DrawLimitLine("YesterdayHigh", yesterdayHigh, yesterdayStartTime, yesterdayHigh, yesterdayEndTime, Color_YesterdayHigh, Style_Yesterday, Width_Yesterday);
      DrawLimitLine("YesterdayLow", yesterdayLow, yesterdayStartTime, yesterdayLow, yesterdayEndTime, Color_YesterdayLow, Style_Yesterday, Width_Yesterday);
   }
   
   if(dayBeforeEnable)
   {
      // Day before yesterday's line for yesterday and today 
      DrawLimitLine("DayBeforeYesterdayClose", dayBeforeYesterdayClose, dayBeforeYesterdayStartTime, dayBeforeYesterdayClose, dayBeforeYesterdayEndTime, Color_DayBefore, Style_DayBefore, Width_DayBefore);
   }
   
   if(lastWeekEnable)
   {
      // Last week's Close line for this week
      DrawLimitLine("LastWeekClose", lastWeekClose, weekStartTime, lastWeekClose, weekEndTime,Color_LastWeek, Style_LastWeek, Width_LastWeek);
   }
   
   if(lastWeekMapEnable)
   {
      // Last week's High line for this week
      DrawLimitLine("LastWeekHigh", lastWeekHigh, weekStartTime, lastWeekHigh, weekEndTime, Color_HighLow, Style_HighLow, Width_HighLow);
      
      // Last week's Low line for this week
      DrawLimitLine("LastWeekLow", lastWeekLow, weekStartTime, lastWeekLow, weekEndTime, Color_HighLow, Style_HighLow, Width_HighLow);
      
      // Last week's 25% line for this week
      DrawLimitLine("25Percent", percent25, weekStartTime, percent25, weekEndTime, Color_MidLevels, Style_MidLevels, Width_MidLevels);
      
      // Last week's 50% line for this week
      DrawLimitLine("50Percent", percent50, weekStartTime, percent50, weekEndTime, Color_MidLevels, Style_MidLevels, Width_MidLevels);
      
      // Last week's 75% line for this week
      DrawLimitLine("75Percent", percent75, weekStartTime, percent75, weekEndTime, Color_MidLevels, Style_MidLevels, Width_MidLevels);
   }
   
   if(verticalSessionEnable)
   {
      if(ShowTokyoSession) DrawverticalSessionLines("Vertical_Tokyo", 1, 0, 6, 0, Color_TokyoSession, Style_Session, Width_Session);
      if(ShowLondonSession) DrawverticalSessionLines("Vertical_London", 7, 0, 15, 30, Color_LondonSession, Style_Session, Width_Session);
      if(ShowNewYorkPreSession) DrawverticalSessionLines("Vertical_NewYorkPre", 12, 30, 20, 0, Color_NewYorkPreSession, Style_Session, Width_Session);
      if(ShowNewYorkSession) DrawverticalSessionLines("Vertical_NewYork", 13, 30, 20, 0, Color_NewYorkSession, Style_Session, Width_Session);
   }
}

 
//+------------------------------------------------------------------+
//| Custom ATR calculation function                                  |
//+------------------------------------------------------------------+
double CalculateATR(int period)
{
   double sumTR = 0.0;

   // Calculate TR for each bar in the period
   for (int i = 0; i < period; i++)
   {
      sumTR += CalculateTrueRange(i);
   }

   return sumTR / period;  // Return ATR as the average of TR
}

//+------------------------------------------------------------------+
//| Calculate True Range for a specific bar                          |
//+------------------------------------------------------------------+
double CalculateTrueRange(int i)
{
   double high = iHigh(_Symbol, PERIOD_D1, i);
   double low = iLow(_Symbol, PERIOD_D1, i);
   double closePrev = iClose(_Symbol, PERIOD_D1, i + 1);

   double tr1 = high - low;                  // High - Low
   double tr2 = fabs(high - closePrev);     // |High - Close_prev|
   double tr3 = fabs(low - closePrev);      // |Low - Close_prev|

   return MathMax(tr1, MathMax(tr2, tr3));  // Return max of the three
}

//+------------------------------------------------------------------+
//| Draw Limit Trend Line function                                   |
//+------------------------------------------------------------------+
void DrawLimitLine(string lineName, double startPrice, datetime startTime, double endPrice, datetime endTime, color clr, ENUM_LINE_STYLE style, int width)
{
   string name = "LimitLine_" + lineName;
   if (ObjectFind(0, name) != 0)
     {
      ObjectCreate(0, name, OBJ_TREND, 0, startTime, startPrice, endTime, endPrice);
     }
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, name, OBJPROP_STYLE, style);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, width);
   ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);
   ObjectSetInteger(0, name, OBJPROP_RAY_LEFT, false);
   ObjectSetInteger(0, name, OBJPROP_BACK, true);
}

void DrawverticalSessionLines(string sessionName, int sessionStartGMT_Hour, int sessionStartGMT_Min, int sessionEndGMT_Hour, int sessionEndGMT_Min, color clr, ENUM_LINE_STYLE style, int width)
{
   
   datetime currentDate = TimeCurrent();
   // Create datetime values for the GMT times
   datetime gmtOpen = StringToTime(TimeToString(currentDate, TIME_DATE) + " " + IntegerToString(sessionStartGMT_Hour) + ":" + IntegerToString(sessionStartGMT_Min));
   datetime gmtClose = StringToTime(TimeToString(currentDate, TIME_DATE) + " " + IntegerToString(sessionEndGMT_Hour) + ":" + IntegerToString(sessionEndGMT_Min));

   // Convert GMT time to local time
   datetime localOpen = gmtOpen + GMTOffset;
   datetime localClose = gmtClose + GMTOffset;
   if(!SummerTime)
     {
      localOpen += 3600;
      localClose += 3600;
     }

   DrawVerticalLine(sessionName +"_Open", localOpen, clr, style, width);
   DrawVerticalLine(sessionName +"_Close", localClose, clr, style, width);
}

//+------------------------------------------------------------------+
//| Draw Vertical Line function                                      |
//+------------------------------------------------------------------+
void DrawVerticalLine(string name, datetime time, color clr, ENUM_LINE_STYLE style, int width)
{
   if (ObjectFind(0, name) != 0)
   {
      ObjectCreate(0, name, OBJ_VLINE, 0, time, 0);
      ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
      ObjectSetInteger(0, name, OBJPROP_STYLE, style);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, width);
      ObjectSetInteger(0, name, OBJPROP_BACK, 1);
   }
}

double NormalizeLevel(int level, double high, double low)
{
   double diff = high - low;
   if (UsePips)
   {
      return(low + (level * Point()));
   }
   else
   {
      return(low + (diff * level / 100.0));
   }
}

