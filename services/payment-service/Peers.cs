using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

/// <summary>HTTP calls to the other microservices.</summary>
public class Peers
{
    private static readonly JsonSerializerOptions SnakeCase = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    private readonly HttpClient _http;
    private readonly string _auth = Env("AUTH_URL", "http://localhost:8081");
    private readonly string _orders = Env("ORDER_URL", "http://localhost:8084");
    private readonly string _inventory = Env("INVENTORY_URL", "http://localhost:8083");
    private readonly string _notifications = Env("NOTIFICATION_URL", "http://localhost:8086");

    public static readonly string InternalKey = Env("INTERNAL_API_KEY", "verve-internal-dev-key");

    public Peers(IHttpClientFactory factory)
    {
        _http = factory.CreateClient();
        _http.Timeout = TimeSpan.FromSeconds(5);
    }

    private static string Env(string key, string fallback) =>
        Environment.GetEnvironmentVariable(key) is { Length: > 0 } value ? value : fallback;

    private HttpRequestMessage Build(HttpMethod method, string url, string? bearer = null, bool internalKey = false, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (!string.IsNullOrEmpty(bearer)) request.Headers.TryAddWithoutValidation("Authorization", bearer);
        if (internalKey) request.Headers.Add("X-Internal-Key", InternalKey);
        if (body is not null) request.Content = JsonContent.Create(body, options: SnakeCase);
        return request;
    }

    /// <summary>The user who owns this Authorization header, or null.</summary>
    public async Task<AuthUser?> GetUserAsync(string? authorization)
    {
        if (string.IsNullOrEmpty(authorization)) return null;
        using var response = await _http.SendAsync(Build(HttpMethod.Get, $"{_auth}/api/auth/me", authorization));
        if (response.StatusCode != HttpStatusCode.OK) return null;
        return await response.Content.ReadFromJsonAsync<AuthUser>(SnakeCase);
    }

    /// <summary>Loads an order through order-service, which enforces that the caller owns it.</summary>
    public async Task<(HttpStatusCode Status, JsonElement? Order)> GetOrderAsync(long orderId, string? authorization, bool asInternal)
    {
        using var response = await _http.SendAsync(
            Build(HttpMethod.Get, $"{_orders}/api/orders/{orderId}", authorization, asInternal));
        if (!response.IsSuccessStatusCode) return (response.StatusCode, null);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return (response.StatusCode, doc.RootElement.Clone());
    }

    public async Task MarkOrderPaidAsync(long orderId)
    {
        using var response = await _http.SendAsync(Build(HttpMethod.Post, $"{_orders}/api/orders/{orderId}/mark-paid", internalKey: true));
        response.EnsureSuccessStatusCode();
    }

    public async Task CommitStockAsync(long orderId)
    {
        using var response = await _http.SendAsync(Build(HttpMethod.Post, $"{_inventory}/api/inventory/reservations/{orderId}/commit", internalKey: true));
        response.EnsureSuccessStatusCode();
    }

    /// <summary>Best effort: a notification failure never fails a payment.</summary>
    public async Task NotifyAsync(string email, string type, string title, string message, long orderId)
    {
        try
        {
            var body = new { user_email = email, type, title, message, order_id = orderId };
            using var response = await _http.SendAsync(Build(HttpMethod.Post, $"{_notifications}/api/notifications", internalKey: true, body: body));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"notification not sent: {ex.Message}");
        }
    }
}
