# HxTradeUploader (.NET library for MQL5)

C# class library the indicator imports to POST journal exports to the trade
API. MQL5 indicators are not allowed to call `WebRequest`, but they *can*
call DLLs — MetaTrader 5 loads .NET Framework assemblies natively, so no
C++ wrapper is needed.

## Build

Requires the .NET SDK (or Visual Studio). The project targets
**.NET Framework 4.8** because MetaTrader's .NET integration only loads
.NET Framework assemblies (not .NET Core / .NET 5+).

```
cd dotnet/HxTradeUploader
dotnet build -c Release
```

Output: `bin\Release\net48\HxTradeUploader.dll`

## Install

1. Copy `HxTradeUploader.dll` into the terminal's `MQL5\Libraries` folder
   (MetaEditor needs it there to compile `hx_trade_helper.mq5`, and the
   terminal needs it there at runtime).
2. Enable *Tools → Options → Expert Advisors → Allow DLL imports*, and tick
   *Allow DLL imports* on the program's Common tab when attaching it.
3. Recompile `hx_trade_helper.mq5`.

## API exposed to MQL5

Public static methods of the (global-namespace) `TradeUploader` class are
imported automatically by `#import "HxTradeUploader.dll"` and called as:

```mql5
int    status   = TradeUploader::UploadJson(apiUrl, apiKey, json, timeoutMs);
string response = TradeUploader::GetLastResponse();
```

`UploadJson` sends `POST <apiUrl>` with the JSON string as the request body
(`Content-Type: application/json`, optional `X-Api-Key` header) and returns
the HTTP status code, or `-1` when the request could not be sent at all
(connection refused, timeout, DNS). `GetLastResponse()` returns the response
body on success and the error message on failure.

Note: the call is synchronous and runs in the chart thread, so the timeout
passed from MQL5 (10 s by default) is the longest the chart can freeze when
the API is unreachable.
