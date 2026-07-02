# HxTradeUploader (.NET 8 Native AOT library for MQL5)

C# library the indicator imports to POST journal exports to the trade API.
MQL5 indicators are not allowed to call `WebRequest`, but they can call
DLLs. This project is compiled with **.NET 8 Native AOT**, which produces a
plain native Win32 DLL with C exports — MetaTrader loads it like any C++
library, no .NET runtime hosting or installation involved.

## Build

Requirements (build machine only, the DLL itself is self-contained):

- .NET 8 SDK (or newer)
- Visual Studio 2022 "Desktop development with C++" workload — Native AOT
  uses the MSVC linker
- Must be built on Windows for the `win-x64` target

```
cd dotnet/HxTradeUploader
dotnet publish -c Release -r win-x64
```

Output: `bin\Release\net8.0\win-x64\publish\HxTradeUploader.dll`
(ship only the .dll, the .pdb next to it is debug symbols).

## Install

1. Copy `HxTradeUploader.dll` into the terminal's `MQL5\Libraries` folder.
2. Enable *Tools → Options → Expert Advisors → Allow DLL imports*, and tick
   *Allow DLL imports* on the program's Common tab when attaching it.
3. Compile `hx_trade_helper.mq5`.

## Exports

Unlike .NET Framework assemblies, native DLL functions must be declared
explicitly in the `#import` block:

```mql5
#import "HxTradeUploader.dll"
int UploadJson(string apiUrl, string apiKey, string json, int timeoutMs);
int GetLastResponse(string &buffer, int capacity);
#import
```

- `UploadJson` sends `POST <apiUrl>` with the JSON string as the request
  body (`Content-Type: application/json`, optional `X-Api-Key` header) and
  returns the HTTP status code, or `-1` when the request could not be sent
  at all (connection refused, timeout, DNS).
- `GetLastResponse` copies the response body of the last call (or its error
  message) into a caller-allocated buffer — initialize it first with
  `StringInit(buffer, capacity)` — and returns the number of characters
  copied.

MQL5 strings are UTF-16, which matches the `wchar_t*` pointers the exports
expect, so no extra conversion is needed on either side.

Note: the call is synchronous and runs in the chart thread, so the timeout
passed from MQL5 (10 s by default) is the longest the chart can freeze when
the API is unreachable.
