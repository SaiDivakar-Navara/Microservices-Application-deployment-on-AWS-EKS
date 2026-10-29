public record PayRequest(long OrderId, string? Method, string? CardNumber, string? UpiId);

public record AuthUser(long Id, string Name, string Email, string Role);

public record Payment(
    long Id,
    long OrderId,
    string UserEmail,
    decimal Amount,
    string Method,
    string Status,
    string Reference,
    string? CardLast4,
    string? FailureReason,
    DateTimeOffset CreatedAt);

public record ErrorBody(string Error);

public record ErrorWithPayment(string Error, Payment Payment);
