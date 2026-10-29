require "sinatra/base"
require "json"
require "net/http"
require "uri"
require "pg"

class NotificationApp < Sinatra::Base
  AUTH_URL     = ENV.fetch("AUTH_URL", "http://localhost:8081")
  INTERNAL_KEY = ENV.fetch("INTERNAL_API_KEY", "verve-internal-dev-key")

  DB_CONFIG = {
    host:     ENV.fetch("DB_HOST", "localhost"),
    port:     Integer(ENV.fetch("DB_PORT", "5432")),
    dbname:   ENV.fetch("DB_NAME", "notification_db"),
    user:     ENV.fetch("DB_USER", "verve"),
    password: ENV.fetch("DB_PASSWORD", "verve_pass"),
    sslmode:  ENV.fetch("DB_SSLMODE", "disable")
  }.freeze

  SELECT_COLUMNS = <<~SQL.freeze
    id, user_email, type, title, message, order_id, is_read,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
  SQL

  configure do
    set :bind, "0.0.0.0"
    set :port, Integer(ENV.fetch("PORT", "8086"))
    set :server, :puma
    set :protection, false
    set :show_exceptions, false
    set :raise_errors, false
    # Requests arrive with the Kubernetes service name or the ALB host name as Host header.
    set :host_authorization, { permitted_hosts: [] }
  end

  # ---------- database ----------
  def self.with_db
    conn = PG.connect(DB_CONFIG)
    yield conn
  ensure
    conn&.close
  end

  def self.prepare_database
    attempts = 0
    begin
      with_db do |db|
        db.exec <<~SQL
          CREATE TABLE IF NOT EXISTS notifications (
            id          BIGSERIAL PRIMARY KEY,
            user_email  VARCHAR(200) NOT NULL,
            type        VARCHAR(40)  NOT NULL,
            title       VARCHAR(200) NOT NULL,
            message     TEXT         NOT NULL,
            order_id    BIGINT,
            is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
            created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
          )
        SQL
        db.exec "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_email, id DESC)"
      end
    rescue PG::Error => e
      attempts += 1
      raise if attempts >= 30

      warn "waiting for database (#{attempts}/30): #{e.message.strip}"
      sleep 2
      retry
    end
  end

  # ---------- helpers ----------
  helpers do
    def respond(status, payload)
      halt status, { "Content-Type" => "application/json" }, JSON.generate(payload)
    end

    def json_body
      JSON.parse(request.body.read)
    rescue JSON::ParserError
      respond 400, error: "request body is not valid JSON"
    end

    def internal_call?
      request.env["HTTP_X_INTERNAL_KEY"] == INTERNAL_KEY
    end

    # Asks auth-service who owns the Bearer token. Returns nil when not signed in.
    def current_user
      header = request.env["HTTP_AUTHORIZATION"]
      return nil if header.nil? || header.empty?

      uri = URI("#{AUTH_URL}/api/auth/me")
      req = Net::HTTP::Get.new(uri)
      req["Authorization"] = header
      res = Net::HTTP.start(uri.hostname, uri.port, open_timeout: 3, read_timeout: 5) { |http| http.request(req) }
      res.is_a?(Net::HTTPSuccess) ? JSON.parse(res.body) : nil
    rescue StandardError
      nil
    end

    def require_user
      current_user || respond(401, error: "sign in required")
    end

    def present(row)
      {
        id:         row["id"].to_i,
        user_email: row["user_email"],
        type:       row["type"],
        title:      row["title"],
        message:    row["message"],
        order_id:   row["order_id"] && row["order_id"].to_i,
        is_read:    row["is_read"] == "t",
        created_at: row["created_at"]
      }
    end
  end

  before do
    content_type :json
  end

  # ---------- routes ----------
  get "/health" do
    health_response
  end

  get "/api/notifications/health" do
    health_response
  end

  # Called by order-service and payment-service.
  post "/api/notifications" do
    respond 403, error: "internal endpoint" unless internal_call?

    data = json_body
    email = data["user_email"].to_s.strip.downcase
    title = data["title"].to_s.strip
    message = data["message"].to_s.strip
    respond 400, error: "user_email, title and message are required" if email.empty? || title.empty? || message.empty?

    order_id = data["order_id"].nil? ? nil : Integer(data["order_id"], exception: false)
    kind = data["type"].to_s.strip
    kind = "INFO" if kind.empty?

    row = NotificationApp.with_db do |db|
      db.exec_params(
        "INSERT INTO notifications (user_email, type, title, message, order_id) VALUES ($1, $2, $3, $4, $5) RETURNING #{SELECT_COLUMNS}",
        [email, kind[0, 40], title[0, 200], message, order_id]
      ).first
    end
    respond 201, present(row)
  end

  # The signed-in shopper's own notifications, newest first.
  get "/api/notifications" do
    user = require_user
    rows = NotificationApp.with_db do |db|
      db.exec_params(
        "SELECT #{SELECT_COLUMNS} FROM notifications WHERE user_email = $1 ORDER BY id DESC LIMIT 50",
        [user["email"].to_s.downcase]
      ).to_a
    end
    JSON.generate(rows.map { |r| present(r) })
  end

  post "/api/notifications/read-all" do
    user = require_user
    count = NotificationApp.with_db do |db|
      db.exec_params(
        "UPDATE notifications SET is_read = TRUE WHERE user_email = $1 AND NOT is_read",
        [user["email"].to_s.downcase]
      ).cmd_tuples
    end
    JSON.generate(updated: count)
  end

  post "/api/notifications/:id/read" do
    user = require_user
    id = Integer(params["id"], exception: false)
    respond 400, error: "invalid notification id" if id.nil?

    row = NotificationApp.with_db do |db|
      db.exec_params(
        "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_email = $2 RETURNING #{SELECT_COLUMNS}",
        [id, user["email"].to_s.downcase]
      ).first
    end
    respond 404, error: "notification not found" if row.nil?
    JSON.generate(present(row))
  end

  not_found do
    content_type :json
    JSON.generate(error: "no route for #{request.request_method} #{request.path_info}")
  end

  error do
    warn "unhandled error: #{env['sinatra.error']&.message}"
    content_type :json
    JSON.generate(error: "internal server error")
  end

  def health_response
    NotificationApp.with_db { |db| db.exec("SELECT 1") }
    JSON.generate(service: "notification-service", status: "UP", language: "Ruby")
  rescue PG::Error
    respond 503, service: "notification-service", status: "DOWN"
  end

  if $PROGRAM_NAME == __FILE__
    prepare_database
    run!
  end
end
