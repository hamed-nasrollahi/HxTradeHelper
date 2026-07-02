using System;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;

// Native AOT exports for MetaTrader 5. MQL5 strings are UTF-16, so string
// parameters arrive as null-terminated wchar_t* pointers and results are
// written back into a caller-allocated wchar_t buffer.
public static class TradeUploader
{
    private static readonly HttpClient Client = CreateClient();

    private static HttpClient CreateClient()
    {
        var client = new HttpClient();
        // Some feed CDNs (e.g. ForexFactory's) reject requests without a UA
        client.DefaultRequestHeaders.UserAgent.ParseAdd("HxTradeHelper/1.0");
        return client;
    }

    // Each chart in MT5 runs in its own thread; keep the response per-thread
    // so concurrent uploads from different charts cannot mix results
    [ThreadStatic]
    private static string lastResponse;

    /// <summary>
    /// POST the JSON payload to the trade API.
    /// Returns the HTTP status code, or -1 when the request could not be
    /// sent (connection refused, DNS failure, timeout, ...). Call
    /// GetLastResponse for the response body or the error message.
    /// </summary>
    [UnmanagedCallersOnly(EntryPoint = "UploadJson")]
    public static int UploadJson(IntPtr apiUrlPtr, IntPtr apiKeyPtr, IntPtr jsonPtr, int timeoutMs)
    {
        lastResponse = "";
        try
        {
            string apiUrl = Marshal.PtrToStringUni(apiUrlPtr) ?? "";
            string apiKey = Marshal.PtrToStringUni(apiKeyPtr) ?? "";
            string json = Marshal.PtrToStringUni(jsonPtr) ?? "";

            using var cts = new System.Threading.CancellationTokenSource(timeoutMs);
            using var request = new HttpRequestMessage(HttpMethod.Post, apiUrl)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
            if (!string.IsNullOrEmpty(apiKey))
                request.Headers.Add("X-Api-Key", apiKey);

            using HttpResponseMessage response = Client.Send(request, cts.Token);
            using var reader = new System.IO.StreamReader(response.Content.ReadAsStream(cts.Token), Encoding.UTF8);
            lastResponse = reader.ReadToEnd();
            return (int)response.StatusCode;
        }
        catch (Exception ex)
        {
            lastResponse = Describe(ex);
            return -1;
        }
    }

    /// <summary>
    /// HTTP GET the given URL (used for the ForexFactory calendar feed).
    /// Returns the HTTP status code, or -1 when the request could not be
    /// sent. The body (or error message) is read via GetLastResponse.
    /// </summary>
    [UnmanagedCallersOnly(EntryPoint = "HttpGet")]
    public static int HttpGet(IntPtr urlPtr, int timeoutMs)
    {
        lastResponse = "";
        try
        {
            string url = Marshal.PtrToStringUni(urlPtr) ?? "";
            using var cts = new System.Threading.CancellationTokenSource(timeoutMs);
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            using HttpResponseMessage response = Client.Send(request, cts.Token);
            using var reader = new System.IO.StreamReader(response.Content.ReadAsStream(cts.Token), Encoding.UTF8);
            lastResponse = reader.ReadToEnd();
            return (int)response.StatusCode;
        }
        catch (Exception ex)
        {
            lastResponse = Describe(ex);
            return -1;
        }
    }

    /// <summary>
    /// Copy the response body (or error message) of the last UploadJson or
    /// HttpGet call into the caller's buffer (capacity in characters, incl.
    /// terminator). Returns the number of characters copied.
    /// </summary>
    [UnmanagedCallersOnly(EntryPoint = "GetLastResponse")]
    public static int GetLastResponse(IntPtr buffer, int capacity)
    {
        string source = lastResponse ?? "";
        if (buffer == IntPtr.Zero || capacity <= 0)
            return 0;

        int length = Math.Min(source.Length, capacity - 1);
        if (length > 0)
            Marshal.Copy(source.ToCharArray(), 0, buffer, length);
        Marshal.WriteInt16(buffer, length * sizeof(char), 0); // null terminator
        return length;
    }

    private static string Describe(Exception ex)
    {
        var sb = new StringBuilder(ex.Message);
        for (Exception inner = ex.InnerException; inner != null; inner = inner.InnerException)
            sb.Append(" -> ").Append(inner.Message);
        return sb.ToString();
    }
}
