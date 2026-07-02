//+------------------------------------------------------------------+
//|                                              hx_trade_helper.mq5 |
//|                                Copyright 2024, Hamed Nasrollahi. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2023, Hamed Nasrollahi."
#property link      "https://github.com/hamed-nasrollahi"
#property description "nasrollahi.hamed@gmail.com"
#property version   "1.1"
#property strict


#include "DialogHx.mqh"
#include <Controls\Button.mqh>
#include <Arrays\ArrayObj.mqh> // For dynamic object arrays
#include "TradeElement.mqh"

// Base folder for storing screenshots
input string JournalBasePath = "TradesHistory";


input bool showCandleTime = false;
input bool showSessions = false;
input bool showSlipage = false;

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


DialogHx  AppWindow;
CButton  btnJournal, btnYesterday, btnDayBefore, btnLastWeek, btnWeeklyMap, btnLevel1, btnLevel2, btnLevel3, btnSessions, btnATR, btnDOB, 
btnH4OB, btnH1OB, btnSROB, btnMA200, btnMA60, btnMA20, btnBuy, btnSell, btnCLR, btnFib1, btnFib2, btnWB, btnLB, btnWS, btnLS, btnExp, btnEnbl, btnReCalc, btnReset;

bool verticalSessionEnable = false, level3Enable = false, level2Enable = false, level1Enable = false, lastWeekEnable = false, dayBeforeEnable = false, 
yesterdayEnable = false, atrEnable = true, lastWeekMapEnable = false;
// Global variable to store the date of the last update
int lastUpdateDate = 0;
double lastHigh = 0;
double lastLow = 0;
datetime GMTOffset;

CArrayObj *tradeElements= NULL; // Dynamic list to hold CTradeElement instances
int ma20Handle=INVALID_HANDLE, ma60Handle=INVALID_HANDLE, ma200Handle=INVALID_HANDLE;
bool ma20Enable = false, ma60Enable = false, ma200Enable = false, statEnable = false;

int dialog_tab=0;
int winTrades = 0, loseTrades=0;
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
   if(!AppWindow.Create(0,"Hx Helper",0,chartWidth,100,chartWidth+110,680))
      return(INIT_FAILED);
      
   
   PopulateTabs();
      
   //--- run application
   AppWindow.Run();
   
   // Initialize the dynamic list
   tradeElements = new CArrayObj();
   // Reconstruct existing trade elements
   ReconstructTradeElements();
    
   //EventSetTimer(1);
   
   return(INIT_SUCCEEDED);
}

void PopulateTabs()
{
  //hide all buttons
  switch(dialog_tab)
  {  
   case 1:
     
    break;
   default:
    CreateButton(btnJournal, "btnJournal", "Journal",10,10,90,30);
    CreateButton(btnYesterday, "btnYesterday", "Yesterday",10,40,90,60);
    CreateButton(btnDayBefore, "btnDayBefore", "Day Before",10,70,90,90);
    CreateButton(btnLastWeek, "btnLastWeek", "Last Week",10,100,90,120);
    CreateButton(btnWeeklyMap, "btnWeeklyMap", "Week Map",10,130,90,150);
    CreateButton(btnLevel1, "btnLevel1", "L1",10,160,45,180);
    CreateButton(btnLevel2, "btnLevel2", "L2",55,160,90,180);
    CreateButton(btnLevel3, "btnLevel3", "L3",10,190,45,210);
    CreateButton(btnATR, "btnATR", "ATR",55,190,90,210);
    CreateButton(btnSessions, "btnSessions", "Sessions",10,220,90,240);
    CreateButton(btnDOB, "btnDOB", "DOB",10,250,45,270);
    CreateButton(btnH4OB, "btnH4OB", "H4OB",55,250,90,270);
    CreateButton(btnH1OB, "btnH1OB", "H1OB",10,280,45,300);
    CreateButton(btnSROB, "btnSROB", "SROB",55,280,90,300);
    CreateButton(btnSell, "btnSell", "Sell",10,310,45,330);
    CreateButton(btnBuy, "btnBuy", "Buy",55,310,90,330);
    CreateButton(btnMA20, "btnMA20", "M20",10,340,45,360);
    CreateButton(btnCLR, "btnCLR", "CLR",55,340,90,360);
    CreateButton(btnMA60, "btnMA60", "M60",10,370,45,390);
    CreateButton(btnMA200, "btnMA200", "M200",55,370,90,390);
    CreateButton(btnFib2, "btnFib2", "Fib2",55,400,90,420);
    CreateButton(btnFib1, "btnFib1", "Fib1",10,400,45,420) ;   
    CreateButton(btnWB, "btnWB", "W-B",55,430,90,450) ; 
    CreateButton(btnLB, "btnLB", "L-B",10,430,45,450) ; 
    CreateButton(btnWS, "btnWS", "W-S",55,460,90,480) ; 
    CreateButton(btnLS, "btnLS", "L-S",10,460,45,480) ; 
    CreateButton(btnExp, "btnExp", "Exp",55,490,90,510) ;
    CreateButton(btnEnbl, "btnEnbl", "enbl",10,490,45,510) ;
    CreateButton(btnReset,  "btnReset",  "Rst", 10,520,45,540) ;
    CreateButton(btnReCalc, "btnReCalc", "CLC",55,520,90,540) ;
    break;
  }

}

//+------------------------------------------------------------------+
//| Indicator deinitialization function                              |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   //--- destroy dialog
   AppWindow.Destroy(reason);
   // Remove all lines when the indicator is removed
   DeleteLines();
   
   //EventKillTimer();
   
   //RemoveAllTradeElements();
   delete tradeElements; // Delete the dynamic list
}

void OnTimera()
{
   //EventKillTimer();
   //calculate spread indicatoryou do
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
   //EventSetTimer(1);
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
   MqlDateTime tm  ={};
   if(!TimeToStruct(time[0],tm))
   Print("TimeToStruct() failed. Error ", GetLastError());
   
   OnTimera();
   
   // Check if the date has changed
   if (tm.day != lastUpdateDate)
   {
     // Ensure old lines are removed before creating new ones
     DeleteLines();
     lastHigh = 0;
     lastLow = 0;
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
      if(sparam == "btnJournal")
      {
         string currentDate = TimeToString(current_time, TIME_DATE);
         string tradeTime = TimeToString(current_time, TIME_MINUTES);
         StringReplace(tradeTime, ":", "_");
         string tradeFolder = tradeTime;
         
         // Build directory structure
         string dayFolder = JournalBasePath + "\\" + currentDate;
         string symbolFolder = dayFolder + "\\" + Symbol();
         string tradeFolderPath = symbolFolder + "\\" + tradeFolder;
         
         if (CreateFolder(dayFolder, false) &&
            CreateFolder(symbolFolder, false) &&
            CreateFolder(tradeFolderPath, false))
         {
            CaptureScreenshots(tradeFolderPath);
         }
         else
         {
            Print("Error creating folder structure.");
         }
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
         FolderCreate("TradesHistory");
         string fileName = "TradesHistory\\backTest_" + TimeToString(TimeCurrent(), TIME_DATE) + ".csv";
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
            string jsonFile = "TradesHistory\\backTest_" + TimeToString(TimeCurrent(), TIME_DATE) + ".json";
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

            MessageBox("Exported " + IntegerToString(n) + " trade(s) to:\nMQL5\\Files\\" + fileName, "Export Complete", MB_OK);
         }
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
   }
    
   AppWindow.ChartEvent(id,lparam,dparam,sparam);
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
   // Iterate through all indicators on the chart
   int totalIndicators = ChartIndicatorsTotal(0, 0);
   for(int i = 0; i < totalIndicators; i++)
   {
      string indName = ChartIndicatorName(0,0,i);
      int handle = ChartIndicatorGet(0, 0, indName); // Get the handle of the indicator
      if(handle == handleId)
      {
         if(!ChartIndicatorDelete(0, 0, indName) || !IndicatorRelease(handleId) )
         {
            PrintFormat("Failed to remove indicator %s from the chart. Error code  %d", indName, GetLastError());
            handleId = INVALID_HANDLE;
         }
      }
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
}

//+------------------------------------------------------------------+
//| Save chart screenshot                                            |
//+------------------------------------------------------------------+
bool SaveChartScreenshot(const string filepath, const ENUM_TIMEFRAMES timeframe)
{
   string filename = filepath + "\\" + EnumToString(timeframe) + ".png";
   if (ChartScreenShot(0, filename, 1920*2, 1080))
   {
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
   string lines[] = {"SpreadText", "TimeLeft","Tokyo_indicator","London_indicator","NewYork_indicator"};
   for (int i = 0; i < ArraySize(lines); i++)
   {
      ObjectDelete(0, lines[i]);
   }
   ObjectsDeleteAll(0, "StepLine_", 0, OBJ_TREND);
   ObjectsDeleteAll(0, "LimitLine_", 0, OBJ_TREND);
   ObjectsDeleteAll(0, "Vertical_", 0, OBJ_VLINE); 
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

