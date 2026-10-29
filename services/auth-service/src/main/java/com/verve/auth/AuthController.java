package com.verve.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AuthController {

  private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final int SESSION_HOURS = 12;

  public record RegisterRequest(String name, String email, String password) {}

  public record LoginRequest(String email, String password) {}

  public record UserView(long id, String name, String email, String role) {}

  public record AuthResponse(String token, UserView user) {}

  private record StoredUser(long id, String name, String email, String passwordHash, String role) {}

  private final JdbcTemplate jdbc;
  private final BCryptPasswordEncoder encoder;

  public AuthController(JdbcTemplate jdbc, BCryptPasswordEncoder encoder) {
    this.jdbc = jdbc;
    this.encoder = encoder;
  }

  @GetMapping({"/health", "/api/auth/health"})
  public ResponseEntity<Map<String, String>> health() {
    try {
      jdbc.queryForObject("SELECT 1", Integer.class);
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
          .body(Map.of("service", "auth-service", "status", "DOWN"));
    }
    return ResponseEntity.ok(Map.of("service", "auth-service", "status", "UP", "language", "Java"));
  }

  @PostMapping("/api/auth/register")
  @ResponseStatus(HttpStatus.CREATED)
  public AuthResponse register(@RequestBody RegisterRequest request) {
    String name = request.name() == null ? "" : request.name().trim();
    String email = normalizeEmail(request.email());
    String password = request.password() == null ? "" : request.password();

    if (name.length() < 2) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter your full name.");
    }
    if (!EMAIL.matcher(email).matches()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
    }
    if (password.length() < 8) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters.");
    }

    Integer existing = jdbc.queryForObject("SELECT COUNT(*) FROM app_users WHERE email = ?", Integer.class, email);
    if (existing != null && existing > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists.");
    }

    Long id = jdbc.queryForObject(
        "INSERT INTO app_users (name, email, password_hash, role) VALUES (?, ?, ?, 'USER') RETURNING id",
        Long.class, name, email, encoder.encode(password));
    return startSession(new UserView(id, name, email, "USER"));
  }

  @PostMapping("/api/auth/login")
  public AuthResponse login(@RequestBody LoginRequest request) {
    String email = normalizeEmail(request.email());
    String password = request.password() == null ? "" : request.password();

    List<StoredUser> found = jdbc.query(
        "SELECT id, name, email, password_hash, role FROM app_users WHERE email = ?",
        (rs, rowNum) -> new StoredUser(
            rs.getLong("id"), rs.getString("name"), rs.getString("email"),
            rs.getString("password_hash"), rs.getString("role")),
        email);

    if (found.isEmpty() || !encoder.matches(password, found.get(0).passwordHash())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Incorrect email or password.");
    }
    StoredUser user = found.get(0);
    return startSession(new UserView(user.id(), user.name(), user.email(), user.role()));
  }

  /** Other services call this to find out who owns a Bearer token. */
  @GetMapping("/api/auth/me")
  public UserView me(@RequestHeader(value = "Authorization", required = false) String authorization) {
    String token = bearerToken(authorization);
    List<UserView> users = jdbc.query(
        """
        SELECT u.id, u.name, u.email, u.role
        FROM user_sessions s JOIN app_users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > NOW()
        """,
        (rs, rowNum) -> new UserView(rs.getLong("id"), rs.getString("name"), rs.getString("email"), rs.getString("role")),
        sha256(token));
    if (users.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "sign in required");
    }
    return users.get(0);
  }

  @PostMapping("/api/auth/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
    jdbc.update("DELETE FROM user_sessions WHERE token_hash = ?", sha256(bearerToken(authorization)));
  }

  // ---------- helpers ----------

  private AuthResponse startSession(UserView user) {
    jdbc.update("DELETE FROM user_sessions WHERE expires_at < NOW()");
    String token = newToken();
    jdbc.update(
        "INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        sha256(token), user.id(), Timestamp.from(Instant.now().plus(SESSION_HOURS, ChronoUnit.HOURS)));
    return new AuthResponse(token, user);
  }

  private static String normalizeEmail(String email) {
    return email == null ? "" : email.trim().toLowerCase();
  }

  private static String bearerToken(String header) {
    if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7) || header.length() <= 7) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "sign in required");
    }
    return header.substring(7).trim();
  }

  private static String newToken() {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    return toHex(bytes);
  }

  /** Only a hash of the token is stored, so a leaked database cannot be used to sign in. */
  private static String sha256(String value) {
    try {
      return toHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  private static String toHex(byte[] bytes) {
    StringBuilder sb = new StringBuilder(bytes.length * 2);
    for (byte b : bytes) {
      sb.append(String.format("%02x", b));
    }
    return sb.toString();
  }
}
