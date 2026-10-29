using System.Net;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls($"http://0.0.0.0:{Environment.GetEnvironmentVariable("PORT") ?? "8085"}");
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower);
builder.Services.AddHttpClient();
builder.Services.AddSingleton<PaymentStore>();
builder.Services.AddSingleton<Peers>();

var app = builder.Build();
await app.Services.GetRequiredService<PaymentStore>().InitializeAsync();

IResult Error(int status, string message) => Results.Json(new ErrorBody(message), statusCode: status);

// ---------- health ----------
async Task<IResult> Health(PaymentStore store) =>
    await store.PingAsync()
        ? Results.Ok(new { service = "payment-service", status = "UP", language = "C#" })
        : Results.Json(new { service = "payment-service", status = "DOWN" }, statusCode: 503);

app.MapGet("/health", Health);
app.MapGet("/api/payments/health", Health);

// ---------- list payments ----------
// Shoppers see their own payments. Admins (?all=true) and other services see everyone's.
app.MapGet("/api/payments", async (HttpRequest request, PaymentStore store, Peers peers) =>
{
    var internalCall = request.Headers["X-Internal-Key"] == Peers.InternalKey;
    AuthUser? user = null;
    if (!internalCall)
    {
        user = await peers.GetUserAsync(request.Headers.Authorization);
        if (user is null) return Error(401, "sign in required");
    }

    var everyone = request.Query["all"] == "true" && (internalCall || user!.Role == "ADMIN");
    long? orderId = long.TryParse(request.Query["order_id"].ToString(), out var parsed) ? parsed : null;
    var payments = await store.ListAsync(everyone ? null : user!.Email.ToLowerInvariant(), orderId);
    return Results.Ok(payments);
});

// ---------- pay for an order ----------
app.MapPost("/api/payments", async (PayRequest body, HttpRequest request, PaymentStore store, Peers peers) =>
{
    string? authorization = request.Headers.Authorization;
    var user = await peers.GetUserAsync(authorization);
    if (user is null) return Error(401, "sign in required");

    var method = (body.Method ?? "").Trim().ToUpperInvariant();
    string? last4 = null;
    if (method == "CARD")
    {
        var digits = new string((body.CardNumber ?? "").Where(char.IsDigit).ToArray());
        if (digits.Length is < 13 or > 19) return Error(400, "Enter a valid card number.");
        last4 = digits[^4..];
    }
    else if (method == "UPI")
    {
        var upi = (body.UpiId ?? "").Trim();
        if (!upi.Contains('@') || upi.Length < 5) return Error(400, "Enter a valid UPI ID, for example name@bank.");
    }
    else
    {
        return Error(400, "method must be CARD or UPI.");
    }

    // The order service confirms the order exists and belongs to this shopper.
    var (status, order) = await peers.GetOrderAsync(body.OrderId, authorization, asInternal: false);
    if (status == HttpStatusCode.NotFound || order is null) return Error(404, "order not found");

    var orderStatus = order.Value.GetProperty("status").GetString();
    var amount = order.Value.GetProperty("total").GetDecimal();
    var email = user.Email.ToLowerInvariant();

    // A previous attempt may have charged the card but failed to update the order. Finish that job.
    var earlier = await store.FindSucceededAsync(body.OrderId);
    if (earlier is not null)
    {
        if (orderStatus != "PENDING_PAYMENT") return Error(409, "this order is already paid");
        return await Finalize(earlier);
    }
    if (orderStatus != "PENDING_PAYMENT") return Error(409, $"this order is {orderStatus?.ToLowerInvariant()} and cannot be paid");

    var failure = SimulateGateway(method, body, last4);
    var reference = "PAY-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant();

    if (failure is not null)
    {
        var failed = await store.InsertAsync(body.OrderId, email, amount, method, "FAILED", reference, last4, failure);
        await peers.NotifyAsync(email, "PAYMENT_FAILED", $"Payment failed for order #{body.OrderId}", failure, body.OrderId);
        return Results.Json(new ErrorWithPayment(failure, failed), statusCode: 402);
    }

    var succeeded = await store.InsertAsync(body.OrderId, email, amount, method, "SUCCEEDED", reference, last4, null);
    return await Finalize(succeeded);

    async Task<IResult> Finalize(Payment payment)
    {
        try
        {
            await peers.MarkOrderPaidAsync(payment.OrderId);
            await peers.CommitStockAsync(payment.OrderId);
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"payment {payment.Reference} captured but order update failed: {ex.Message}");
            return Error(502, "Your payment went through, but we could not update the order yet. Press Pay again to finish.");
        }
        await peers.NotifyAsync(payment.UserEmail, "PAYMENT_SUCCEEDED", $"Payment received for order #{payment.OrderId}",
            $"We received ${payment.Amount:0.00}. Your order is confirmed and will ship soon. Reference {payment.Reference}.", payment.OrderId);
        return Results.Json(payment, statusCode: 201);
    }
});

// Stand-in for a real payment gateway. Returns a failure reason, or null when the charge succeeds.
//   Card ending 0002 -> declined.   Card ending 9995 -> insufficient funds.   UPI ID containing "fail" -> declined.
static string? SimulateGateway(string method, PayRequest body, string? last4)
{
    if (method == "CARD")
    {
        if (last4 == "0002") return "Your card was declined. Try a different card.";
        if (last4 == "9995") return "Insufficient funds on this card.";
        return null;
    }
    return (body.UpiId ?? "").Contains("fail", StringComparison.OrdinalIgnoreCase)
        ? "The UPI request was declined by your bank."
        : null;
}

app.Run();
