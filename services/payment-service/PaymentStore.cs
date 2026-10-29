using Npgsql;

/// <summary>All SQL for payment_db.</summary>
public class PaymentStore
{
    private readonly NpgsqlDataSource _db;

    private const string Columns =
        "id, order_id, user_email, amount, method, status, reference, card_last4, failure_reason, created_at";

    public PaymentStore()
    {
        string Env(string key, string fallback) =>
            Environment.GetEnvironmentVariable(key) is { Length: > 0 } value ? value : fallback;

        var ssl = Env("DB_SSLMODE", "disable");
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = Env("DB_HOST", "localhost"),
            Port = int.Parse(Env("DB_PORT", "5432")),
            Database = Env("DB_NAME", "payment_db"),
            Username = Env("DB_USER", "verve"),
            Password = Env("DB_PASSWORD", "verve_pass"),
            SslMode = ssl is "require" or "verify-ca" or "verify-full" ? SslMode.Require : SslMode.Disable,
            // Amazon RDS presents a certificate chain that is not in the container trust store.
            TrustServerCertificate = true,
        };
        _db = NpgsqlDataSource.Create(builder.ConnectionString);
    }

    public async Task InitializeAsync()
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await using var cmd = _db.CreateCommand("""
                    CREATE TABLE IF NOT EXISTS payments (
                        id             BIGSERIAL PRIMARY KEY,
                        order_id       BIGINT NOT NULL,
                        user_email     VARCHAR(200) NOT NULL,
                        amount         NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
                        method         VARCHAR(20) NOT NULL,
                        status         VARCHAR(20) NOT NULL,
                        reference      VARCHAR(40) NOT NULL UNIQUE,
                        card_last4     VARCHAR(4),
                        failure_reason TEXT,
                        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);
                    CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_email);
                    """);
                await cmd.ExecuteNonQueryAsync();
                return;
            }
            catch (Exception ex) when (attempt < 30)
            {
                Console.WriteLine($"waiting for database ({attempt}/30): {ex.Message}");
                await Task.Delay(2000);
            }
        }
    }

    public async Task<bool> PingAsync()
    {
        try
        {
            await using var cmd = _db.CreateCommand("SELECT 1");
            await cmd.ExecuteScalarAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<Payment> InsertAsync(
        long orderId, string email, decimal amount, string method, string status,
        string reference, string? last4, string? failure)
    {
        await using var cmd = _db.CreateCommand($"""
            INSERT INTO payments (order_id, user_email, amount, method, status, reference, card_last4, failure_reason)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING {Columns}
            """);
        cmd.Parameters.AddWithValue(orderId);
        cmd.Parameters.AddWithValue(email);
        cmd.Parameters.AddWithValue(amount);
        cmd.Parameters.AddWithValue(method);
        cmd.Parameters.AddWithValue(status);
        cmd.Parameters.AddWithValue(reference);
        cmd.Parameters.AddWithValue((object?)last4 ?? DBNull.Value);
        cmd.Parameters.AddWithValue((object?)failure ?? DBNull.Value);
        await using var reader = await cmd.ExecuteReaderAsync();
        await reader.ReadAsync();
        return Read(reader);
    }

    public async Task<Payment?> FindSucceededAsync(long orderId)
    {
        await using var cmd = _db.CreateCommand(
            $"SELECT {Columns} FROM payments WHERE order_id = $1 AND status = 'SUCCEEDED' ORDER BY id LIMIT 1");
        cmd.Parameters.AddWithValue(orderId);
        await using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Read(reader) : null;
    }

    /// <param name="email">Only this shopper's payments; null returns everyone's.</param>
    public async Task<List<Payment>> ListAsync(string? email, long? orderId, int limit = 200)
    {
        await using var cmd = _db.CreateCommand($"""
            SELECT {Columns} FROM payments
            WHERE ($1::text IS NULL OR user_email = $1)
              AND ($2::bigint IS NULL OR order_id = $2)
            ORDER BY id DESC
            LIMIT $3
            """);
        cmd.Parameters.AddWithValue((object?)email ?? DBNull.Value);
        cmd.Parameters.AddWithValue((object?)orderId ?? DBNull.Value);
        cmd.Parameters.AddWithValue(limit);
        var result = new List<Payment>();
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync()) result.Add(Read(reader));
        return result;
    }

    private static Payment Read(NpgsqlDataReader r) => new(
        r.GetInt64(0),
        r.GetInt64(1),
        r.GetString(2),
        r.GetDecimal(3),
        r.GetString(4),
        r.GetString(5),
        r.GetString(6),
        r.IsDBNull(7) ? null : r.GetString(7),
        r.IsDBNull(8) ? null : r.GetString(8),
        r.GetFieldValue<DateTimeOffset>(9));
}
