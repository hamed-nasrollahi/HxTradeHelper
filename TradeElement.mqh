//+------------------------------------------------------------------+
//|                                                        Trade.mq5 |
//|                                Copyright 2024, hamed Nasrollahi. |
//|                                       nasrollahi.hamed@gmail.com |
//+------------------------------------------------------------------+
#include <Object.mqh> // Include the base CObject class

class CTradeElement : public CObject // Inherit from CObject
{
private:
   long chartId;
   string instanceName; // Unique instance name
   string mainRect, redRect, greenRect;
   string middleLabel, redLabel, greenLabel, closeButton;
   string arrow; // New object for the movable arrow
   string redLine, greenLine; // Vertical lines
   double lotSize;
   double highPrice;  // Upper bound (e.g., high of a range)
   double lowPrice;   // Lower bound (e.g., low of a range)
   double stopLossPrice;
   double takeProfitPrice;
   double stopLossPips;
   double takeProfitPips;
   double currentPrice;
   bool isBuy; // True for Buy, False for Sell

public:
   // Constructor
   CTradeElement(long chart_Id = 0, string name = "Instance", double current_price = 0.0, double high = 0.0, double low= 0.0, bool is_Buy = true, double lot_Size = 1.0)
   {
      this.chartId = chart_Id;
      this.instanceName = name;

      // Prefix object names with instanceName
      mainRect = instanceName + "_MainRectangle";
      redRect = instanceName + "_RedRectangle";
      greenRect = instanceName + "_GreenRectangle";
      middleLabel = instanceName + "_MiddleLabel";
      redLabel = instanceName + "_RedLabel";
      greenLabel = instanceName + "_GreenLabel";
      closeButton = instanceName + "_CloseButton";
      arrow = instanceName + "_Arrow";
      redLine = instanceName + "_RedLine";
      greenLine = instanceName + "_GreenLine";

      lotSize = lot_Size;
      highPrice = high;
      lowPrice = low;
      stopLossPrice = 0.0;
      takeProfitPrice = 0.0;
      stopLossPips = 0.0;
      takeProfitPips = 0.0;
      currentPrice = current_price;
      isBuy = is_Buy;
      calculateSLTP();
   }

   string GetInstanceName()
   {
      return instanceName;
   }
   
   // Create the element
   void create(datetime currentTime = 0)
   {
      if(currentTime == 0)
        {
         currentTime = TimeCurrent();
        }

      // Create the main rectangle
      ObjectCreate(chartId, mainRect, OBJ_RECTANGLE, 0, currentTime, highPrice, currentTime + 1 * 60 * 60, lowPrice);
      ObjectSetInteger(chartId, mainRect, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(chartId, mainRect, OBJPROP_SELECTABLE, true);
      ObjectSetInteger(chartId, mainRect, OBJPROP_ZORDER, 1);
      ObjectSetInteger(chartId, mainRect, OBJPROP_SELECTED, true);
      ObjectSetInteger(chartId, mainRect, OBJPROP_BACK, true);

      // Create the red rectangle (Stop-Loss)
      ObjectCreate(chartId, redRect, OBJ_RECTANGLE, 0, currentTime, stopLossPrice, currentTime + 1 * 60 * 60, currentPrice);
      ObjectSetInteger(chartId, redRect, OBJPROP_COLOR, clrRed);
      ObjectSetInteger(chartId, redRect, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chartId, redRect, OBJPROP_FILL, true);
      ObjectSetInteger(chartId, redRect, OBJPROP_BACK, true);

      // Create the green rectangle (Take-Profit)
      ObjectCreate(chartId, greenRect, OBJ_RECTANGLE, 0, currentTime, currentPrice, currentTime + 1 * 60 * 60, takeProfitPrice);
      ObjectSetInteger(chartId, greenRect, OBJPROP_COLOR, clrGreen);
      ObjectSetInteger(chartId, greenRect, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chartId, greenRect, OBJPROP_FILL, true);
      ObjectSetInteger(chartId, greenRect, OBJPROP_BACK, true);

      // Create the middle label
      ObjectCreate(chartId, middleLabel, OBJ_TEXT, 0, currentTime, (stopLossPrice + currentPrice) / 2);
      ObjectSetInteger(chartId, middleLabel, OBJPROP_COLOR, clrWhite);

      // Create labels for red and green values
      ObjectCreate(chartId, redLabel, OBJ_TEXT, 0, currentTime, stopLossPrice);
      ObjectSetInteger(chartId, redLabel, OBJPROP_COLOR, clrWhite);

      ObjectCreate(chartId, greenLabel, OBJ_TEXT, 0, currentTime, takeProfitPrice);
      ObjectSetInteger(chartId, greenLabel, OBJPROP_COLOR, clrWhite);
      
      // Create the close button
      ObjectCreate(chartId, closeButton, OBJ_TEXT, 0, currentTime + 1 * 60 * 60, highPrice);
      ObjectSetString(chartId, closeButton, OBJPROP_TEXT, "X");
      ObjectSetInteger(chartId, closeButton, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(chartId, closeButton, OBJPROP_FONTSIZE, 14);
      ObjectSetInteger(chartId, closeButton, OBJPROP_SELECTABLE, true);
      ObjectSetInteger(chartId, closeButton, OBJPROP_ZORDER, 2);
      
      // Create the arrow
      ObjectCreate(chartId, arrow, OBJ_ARROW_LEFT_PRICE, 0, currentTime, currentPrice);
      ObjectSetInteger(chartId, arrow, OBJPROP_COLOR, clrWhite);
      ObjectSetInteger(chartId, arrow, OBJPROP_FILL, true);
      ObjectSetInteger(chartId, arrow, OBJPROP_SELECTABLE, true);
      ObjectSetInteger(chartId, arrow, OBJPROP_SELECTED, true);
      ObjectSetInteger(chartId, arrow, OBJPROP_ZORDER, 2);
      
      // Create the red vertical line (dotted)
      ObjectCreate(chartId, redLine, OBJ_TREND, 0, currentTime, stopLossPrice, currentTime, currentPrice);
      ObjectSetInteger(chartId, redLine, OBJPROP_COLOR, clrRed);
      ObjectSetInteger(chartId, redLine, OBJPROP_STYLE, STYLE_DOT);
      ObjectSetInteger(chartId, redLine, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(chartId, redLine, OBJPROP_RAY_LEFT, false);
      ObjectSetInteger(chartId, redLine, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS); // Initially hidden
      ObjectSetInteger(chartId, redLine, OBJPROP_BACK, true);
      ObjectSetInteger(chartId, redLine, OBJPROP_SELECTABLE, false);
      
      // Create the green vertical line (dotted)
      ObjectCreate(chartId, greenLine, OBJ_TREND, 0, currentTime, currentPrice, currentTime, takeProfitPrice);
      ObjectSetInteger(chartId, greenLine, OBJPROP_COLOR, clrGreen);
      ObjectSetInteger(chartId, greenLine, OBJPROP_STYLE, STYLE_DOT);
      ObjectSetInteger(chartId, greenLine, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(chartId, greenLine, OBJPROP_RAY_LEFT, false);
      ObjectSetInteger(chartId, greenLine, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS); // Initially hidden
      ObjectSetInteger(chartId, greenLine, OBJPROP_BACK, true);
      ObjectSetInteger(chartId, greenLine, OBJPROP_SELECTABLE, false);

      update(); // Initial update to set values
   }
   
   // Update the element dynamically
   void update()
   {
      datetime time1, time2;

      // Get the coordinates of the main rectangle
      time1 = (datetime)ObjectGetInteger(chartId, mainRect, OBJPROP_TIME, 0);
      time2 = (datetime)ObjectGetInteger(chartId, mainRect, OBJPROP_TIME, 1);
      highPrice = ObjectGetDouble(chartId, mainRect, OBJPROP_PRICE, 0);
      lowPrice = ObjectGetDouble(chartId, mainRect, OBJPROP_PRICE, 1);

      // Update the arrow's price and time
      double arrowPrice = ObjectGetDouble(chartId, arrow, OBJPROP_PRICE, 0);
      datetime arrowTime = (datetime)ObjectGetInteger(chartId, arrow, OBJPROP_TIME, 0);
   
      // Update currentPrice if the arrow's price changes
      if (arrowPrice != currentPrice)
         currentPrice = arrowPrice;
   
      // Synchronize arrow time with time1
      if (arrowTime != time1)
      ObjectSetInteger(chartId, arrow, OBJPROP_TIME, 0, time1);
      
      // Recalculate stop-loss and take-profit prices
      calculateSLTP();

      ObjectSetDouble(chartId, redLine, OBJPROP_PRICE, 0, stopLossPrice);
      ObjectSetDouble(chartId, redLine, OBJPROP_PRICE, 1, currentPrice);
      ObjectSetInteger(chartId, redLine, OBJPROP_TIME, 0, time1);
      ObjectSetInteger(chartId, redLine, OBJPROP_TIME, 1, time1);
      ObjectSetDouble(chartId, greenLine, OBJPROP_PRICE, 0, currentPrice);
      ObjectSetDouble(chartId, greenLine, OBJPROP_PRICE, 1, takeProfitPrice);
      ObjectSetInteger(chartId, greenLine, OBJPROP_TIME, 0, time1);
      ObjectSetInteger(chartId, greenLine, OBJPROP_TIME, 1, time1);

      // Update the red rectangle (Stop-Loss)
      ObjectSetInteger(chartId, redRect, OBJPROP_TIME, 0, time1);
      ObjectSetInteger(chartId, redRect, OBJPROP_TIME, 1, time2);
      ObjectSetDouble(chartId, redRect, OBJPROP_PRICE, 0, stopLossPrice);
      ObjectSetDouble(chartId, redRect, OBJPROP_PRICE, 1, currentPrice);

      // Update the green rectangle (Take-Profit)
      ObjectSetInteger(chartId, greenRect, OBJPROP_TIME, 0, time1);
      ObjectSetInteger(chartId, greenRect, OBJPROP_TIME, 1, time2);
      ObjectSetDouble(chartId, greenRect, OBJPROP_PRICE, 0, currentPrice);
      ObjectSetDouble(chartId, greenRect, OBJPROP_PRICE, 1, takeProfitPrice);

      // Update the middle label at the current price
      ObjectSetDouble(chartId, middleLabel, OBJPROP_PRICE, 0, (stopLossPrice + currentPrice) / 2);
      ObjectSetInteger(chartId, middleLabel, OBJPROP_TIME, 0, time1); // Center horizontally

      // Update labels for Stop-Loss and Take-Profit
      double riskMoney = MathAbs(currentPrice - stopLossPrice);
      double rewardMoney = MathAbs(currentPrice - takeProfitPrice);

      string stopLossText = StringFormat("%d(%.2f$)", (int)stopLossPips, riskMoney);
      string takeProfitText = StringFormat("%d(%.2f$)", (int)takeProfitPips, rewardMoney);
      string riskRewardText = StringFormat("R/R=1/%.1f", stopLossPips != 0 ? takeProfitPips / stopLossPips : 0.0);

      ObjectSetString(chartId, redLabel, OBJPROP_TEXT, stopLossText);
      ObjectSetString(chartId, greenLabel, OBJPROP_TEXT, takeProfitText);
      ObjectSetString(chartId, middleLabel, OBJPROP_TEXT, riskRewardText);
      // Dynamically adjust redLabel and greenLabel positions
      ObjectSetDouble(chartId, redLabel, OBJPROP_PRICE, 0, stopLossPrice);
      ObjectSetInteger(chartId, redLabel, OBJPROP_TIME, 0, time1); 

      ObjectSetDouble(chartId, greenLabel, OBJPROP_PRICE, 0, takeProfitPrice);
      ObjectSetInteger(chartId, greenLabel, OBJPROP_TIME, 0, time1); 

      ObjectSetInteger(chartId, closeButton, OBJPROP_TIME, 0, time2);
      ObjectSetDouble(chartId, closeButton, OBJPROP_PRICE, 0, highPrice);
   }

   // Recalculate Stop-Loss and Take-Profit prices
   void calculateSLTP()
   {
      if (isBuy)
      {
         stopLossPrice = lowPrice;
         takeProfitPrice = highPrice;
         stopLossPips = (currentPrice - stopLossPrice) / _Point;
         takeProfitPips = (takeProfitPrice - currentPrice) / _Point;
      }
      else
      {
         stopLossPrice = highPrice;
         takeProfitPrice = lowPrice;
         stopLossPips = (stopLossPrice - currentPrice) / _Point;
         takeProfitPips = (currentPrice - takeProfitPrice) / _Point;
      }
   }

   // Remove the element
   void remove()
   {
      ObjectDelete(chartId, mainRect);
      ObjectDelete(chartId, redRect);
      ObjectDelete(chartId, greenRect);
      ObjectDelete(chartId, middleLabel);
      ObjectDelete(chartId, redLabel);
      ObjectDelete(chartId, greenLabel);
      ObjectDelete(chartId, closeButton);
      ObjectDelete(chartId, arrow);
      ObjectDelete(chartId, redLine);
      ObjectDelete(chartId, greenLine);
   }
   
   void hide()
   {
      // Hide main elements
      ObjectSetInteger(chartId, mainRect, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      ObjectSetInteger(chartId, redRect, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      ObjectSetInteger(chartId, greenRect, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      ObjectSetInteger(chartId, middleLabel, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      ObjectSetInteger(chartId, redLabel, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      ObjectSetInteger(chartId, greenLabel, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      ObjectSetInteger(chartId, closeButton, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      ObjectSetInteger(chartId, arrow, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
   
      // Show vertical lines
      ObjectSetInteger(chartId, redLine, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
      ObjectSetInteger(chartId, greenLine, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
   }
   
   void show()
   {
      // Show main elements
      ObjectSetInteger(chartId, mainRect, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
      ObjectSetInteger(chartId, redRect, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
      ObjectSetInteger(chartId, greenRect, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
      ObjectSetInteger(chartId, middleLabel, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
      ObjectSetInteger(chartId, redLabel, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
      ObjectSetInteger(chartId, greenLabel, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
      ObjectSetInteger(chartId, closeButton, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
      ObjectSetInteger(chartId, arrow, OBJPROP_TIMEFRAMES, OBJ_ALL_PERIODS);
   
      // Hide vertical lines
      ObjectSetInteger(chartId, redLine, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
      ObjectSetInteger(chartId, greenLine, OBJPROP_TIMEFRAMES, OBJ_NO_PERIODS);
   }
};
