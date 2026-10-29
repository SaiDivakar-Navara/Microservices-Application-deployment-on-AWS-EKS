package com.verve.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/** Creates the tables on startup and, optionally, the demo accounts. */
@Component
public class DatabaseInitializer implements ApplicationRunner {

  private final JdbcTemplate jdbc;
  private final BCryptPasswordEncoder encoder;
  private final boolean seedDemoUsers;

  public DatabaseInitializer(
      JdbcTemplate jdbc,
      BCryptPasswordEncoder encoder,
      @Value("${verve.seed-demo-users:true}") boolean seedDemoUsers) {
    this.jdbc = jdbc;
    this.encoder = encoder;
    this.seedDemoUsers = seedDemoUsers;
  }

  @Override
  public void run(ApplicationArguments args) throws Exception {
    // Postgres may still be starting (docker compose, a fresh RDS instance), so retry.
    for (int attempt = 1; ; attempt++) {
      try {
        createTables();
        break;
      } catch (DataAccessException e) {
        if (attempt >= 30) {
          throw e;
        }
        System.out.println("waiting for database (" + attempt + "/30): " + e.getMostSpecificCause().getMessage());
        Thread.sleep(2000);
      }
    }
    if (seedDemoUsers) {
      seed();
    }
  }

  private void createTables() {
    jdbc.execute("""
        CREATE TABLE IF NOT EXISTS app_users (
          id            BIGSERIAL PRIMARY KEY,
          name          VARCHAR(120) NOT NULL,
          email         VARCHAR(200) NOT NULL UNIQUE,
          password_hash VARCHAR(100) NOT NULL,
          role          VARCHAR(20)  NOT NULL DEFAULT 'USER',
          created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
        """);
    jdbc.execute("""
        CREATE TABLE IF NOT EXISTS user_sessions (
          token_hash VARCHAR(64) PRIMARY KEY,
          user_id    BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        )
        """);
  }

  private void seed() {
    Integer users = jdbc.queryForObject("SELECT COUNT(*) FROM app_users", Integer.class);
    if (users != null && users > 0) {
      return;
    }
    insertUser("Verve Admin", "admin@verve.shop", "Admin@123", "ADMIN");
    insertUser("Sam Shopper", "shopper@verve.shop", "Shopper@123", "USER");
    System.out.println("seeded demo accounts: admin@verve.shop and shopper@verve.shop");
  }

  private void insertUser(String name, String email, String password, String role) {
    jdbc.update(
        "INSERT INTO app_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        name, email, encoder.encode(password), role);
  }
}
