package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
)

var (
	db          *sql.DB
	authURL     = getenv("AUTH_URL", "http://localhost:8081")
	internalKey = getenv("INTERNAL_API_KEY", "verve-internal-dev-key")
)

func main() {
	connect()
	migrate()
	seed()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", health)
	mux.HandleFunc("GET /api/catalog/health", health)

	mux.HandleFunc("GET /api/catalog/categories", listCategories)
	mux.HandleFunc("GET /api/catalog/products", listProducts)
	mux.HandleFunc("GET /api/catalog/products/{id}", getProduct)
	mux.HandleFunc("POST /api/catalog/products", adminOnly(createProduct))
	mux.HandleFunc("PUT /api/catalog/products/{id}", adminOnly(updateProduct))
	mux.HandleFunc("DELETE /api/catalog/products/{id}", adminOnly(deleteProduct))

	port := getenv("PORT", "8082")
	log.Printf("catalog-service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// connect builds the DSN from the shared DB_* variables and retries until
// the database is reachable (Postgres may still be starting).
func connect() {
	dsn := fmt.Sprintf("host=%s port=%s dbname=%s user=%s password=%s sslmode=%s",
		getenv("DB_HOST", "localhost"), getenv("DB_PORT", "5432"), getenv("DB_NAME", "catalog_db"),
		getenv("DB_USER", "verve"), getenv("DB_PASSWORD", "verve_pass"), getenv("DB_SSLMODE", "disable"))

	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	for attempt := 1; attempt <= 30; attempt++ {
		if err = db.Ping(); err == nil {
			return
		}
		log.Printf("waiting for database (%d/30): %v", attempt, err)
		time.Sleep(2 * time.Second)
	}
	log.Fatalf("database unreachable: %v", err)
}

func health(w http.ResponseWriter, r *http.Request) {
	if err := db.PingContext(r.Context()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"service": "catalog-service", "status": "DOWN"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"service": "catalog-service", "status": "UP", "language": "Go"})
}
