//+------------------------------------------------------------------+
//|                                                     DialogHx.mqh |
//|                                  Copyright 2025, MetaQuotes Ltd. |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, MetaQuotes Ltd."
#property link      "https://www.mql5.com"
#property strict
#include <Controls\Dialog.mqh>

class DialogHx : public CAppDialog
  {
public:
   bool Create(const long chart_id,
               const string title,
               const int  subwin,
               const int  x,
               const int  y,
               const int  w,
               const int  h)
     {
      return CAppDialog::Create(chart_id, title,subwin,x,y,w,h);
     }

   virtual void Maximize(void)
     {
      CAppDialog::Maximize();
     }

   virtual void Minimize(void)
     {
      CAppDialog::Minimize();
     }


protected:
   virtual bool OnEvent(const int id,
                        const long &lparam,
                        const double &dparam,
                        const string &sparam)
     {
      return CAppDialog::OnEvent(id,lparam,dparam,sparam);
     }
  };