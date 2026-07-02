using System;
using System.IO;
using System.Net;
using System.Text;

// Kept in the global namespace so MQL5 imports it as TradeUploader::Method().
// Only public static methods with simple parameter types are visible to MQL5.
public static class TradeUploader
{
    [ThreadStatic]
    private static string lastResponse;

    /// <summary>
    /// POST the JSON payload to the trade API.
    /// Returns the HTTP status code, or -1 when the request could not be sent
    /// (connection refused, DNS failure, timeout, ...). Call GetLastResponse()
    /// for the response body or the error message.
    /// </summary>
    public static int UploadJson(string apiUrl, string apiKey, string json, int timeoutMs)
    {
        lastResponse = "";
        try
        {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            var request = (HttpWebRequest)WebRequest.Create(apiUrl);
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Timeout = timeoutMs;
            request.ReadWriteTimeout = timeoutMs;
            if (!string.IsNullOrEmpty(apiKey))
                request.Headers["X-Api-Key"] = apiKey;

            byte[] body = Encoding.UTF8.GetBytes(json);
            request.ContentLength = body.Length;
            using (Stream stream = request.GetRequestStream())
                stream.Write(body, 0, body.Length);

            using (var response = (HttpWebResponse)request.GetResponse())
            {
                lastResponse = ReadBody(response);
                return (int)response.StatusCode;
            }
        }
        catch (WebException ex)
        {
            var httpResponse = ex.Response as HttpWebResponse;
            if (httpResponse != null)
            {
                using (httpResponse)
                {
                    lastResponse = ReadBody(httpResponse);
                    return (int)httpResponse.StatusCode;
                }
            }
            lastResponse = ex.Message;
            return -1;
        }
        catch (Exception ex)
        {
            lastResponse = ex.Message;
            return -1;
        }
    }

    /// <summary>Response body (or error message) of the last UploadJson call.</summary>
    public static string GetLastResponse()
    {
        return lastResponse ?? "";
    }

    private static string ReadBody(HttpWebResponse response)
    {
        Stream stream = response.GetResponseStream();
        if (stream == null)
            return "";
        using (var reader = new StreamReader(stream, Encoding.UTF8))
            return reader.ReadToEnd();
    }
}
