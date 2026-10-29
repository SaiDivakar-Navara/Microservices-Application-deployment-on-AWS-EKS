package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

type Product struct {
	ID             int64    `json:"id"`
	Name           string   `json:"name"`
	Brand          string   `json:"brand"`
	Category       string   `json:"category"`
	Description    string   `json:"description"`
	Price          float64  `json:"price"`
	CompareAtPrice *float64 `json:"compare_at_price"`
	Emoji          string   `json:"emoji"`
	Color          string   `json:"color"`
	ImageURL       string   `json:"image_url"`
	Rating         float64  `json:"rating"`
	ReviewCount    int      `json:"review_count"`
	Featured       bool     `json:"featured"`
	Active         bool     `json:"active"`
}

const productColumns = `id, name, brand, category, description, price, compare_at_price,
	emoji, color, image_url, rating, review_count, featured, active`

func scanProduct(row interface{ Scan(...any) error }) (Product, error) {
	var p Product
	var compare sql.NullFloat64
	err := row.Scan(&p.ID, &p.Name, &p.Brand, &p.Category, &p.Description, &p.Price, &compare,
		&p.Emoji, &p.Color, &p.ImageURL, &p.Rating, &p.ReviewCount, &p.Featured, &p.Active)
	if compare.Valid {
		v := compare.Float64
		p.CompareAtPrice = &v
	}
	return p, err
}

func listCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := db.QueryContext(r.Context(),
		`SELECT category, COUNT(*) FROM products WHERE active GROUP BY category ORDER BY category`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load categories")
		return
	}
	defer rows.Close()
	type category struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}
	out := []category{}
	for rows.Next() {
		var c category
		if err := rows.Scan(&c.Name, &c.Count); err != nil {
			writeError(w, http.StatusInternalServerError, "could not load categories")
			return
		}
		out = append(out, c)
	}
	writeJSON(w, http.StatusOK, out)
}

func listProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	where := []string{}
	args := []any{}
	add := func(clause string, value any) {
		args = append(args, value)
		where = append(where, strings.ReplaceAll(clause, "?", fmt.Sprintf("$%d", len(args))))
	}

	// ?all=true returns inactive products too, but only for admins.
	if q.Get("all") == "true" && r.Header.Get("X-Internal-Key") != internalKey {
		if user, ok := currentUser(r); !ok || user.Role != "ADMIN" {
			writeError(w, http.StatusForbidden, "admin access required")
			return
		}
	} else if q.Get("all") != "true" {
		where = append(where, "active")
	}

	if s := strings.TrimSpace(q.Get("q")); s != "" {
		add("(name ILIKE ? OR brand ILIKE ? OR category ILIKE ? OR description ILIKE ?)", "%"+s+"%")
	}
	if c := strings.TrimSpace(q.Get("category")); c != "" {
		add("category = ?", c)
	}
	if v, err := strconv.ParseFloat(q.Get("min"), 64); err == nil {
		add("price >= ?", v)
	}
	if v, err := strconv.ParseFloat(q.Get("max"), 64); err == nil {
		add("price <= ?", v)
	}
	if q.Get("featured") == "true" {
		where = append(where, "featured")
	}
	if q.Get("on_sale") == "true" {
		where = append(where, "compare_at_price IS NOT NULL")
	}

	orderBy := map[string]string{
		"price_asc":  "price ASC, id",
		"price_desc": "price DESC, id",
		"rating":     "rating DESC, review_count DESC, id",
		"newest":     "id DESC",
		"popular":    "review_count DESC, id",
	}[q.Get("sort")]
	if orderBy == "" {
		orderBy = "featured DESC, id"
	}

	query := "SELECT " + productColumns + " FROM products"
	if len(where) > 0 {
		query += " WHERE " + strings.Join(where, " AND ")
	}
	query += " ORDER BY " + orderBy
	if n, err := strconv.Atoi(q.Get("limit")); err == nil && n > 0 && n <= 200 {
		query += fmt.Sprintf(" LIMIT %d", n)
	}

	rows, err := db.QueryContext(r.Context(), query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load products")
		return
	}
	defer rows.Close()
	out := []Product{}
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not read products")
			return
		}
		out = append(out, p)
	}
	writeJSON(w, http.StatusOK, out)
}

func getProduct(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid product id")
		return
	}
	p, err := scanProduct(db.QueryRowContext(r.Context(), "SELECT "+productColumns+" FROM products WHERE id = $1", id))
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "product not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load product")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func decodeProduct(r *http.Request) (Product, string) {
	p := Product{Active: true, Emoji: "📦", Color: "#E8ECF5"}
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		return p, "request body is not valid JSON"
	}
	p.Name = strings.TrimSpace(p.Name)
	p.Category = strings.TrimSpace(p.Category)
	if p.Name == "" || p.Category == "" {
		return p, "name and category are required"
	}
	if p.Price < 0 {
		return p, "price cannot be negative"
	}
	if p.CompareAtPrice != nil && *p.CompareAtPrice <= p.Price {
		p.CompareAtPrice = nil
	}
	return p, ""
}

func createProduct(w http.ResponseWriter, r *http.Request) {
	p, problem := decodeProduct(r)
	if problem != "" {
		writeError(w, http.StatusBadRequest, problem)
		return
	}
	err := db.QueryRowContext(r.Context(), `
		INSERT INTO products (name, brand, category, description, price, compare_at_price, emoji, color, image_url, rating, review_count, featured, active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
		p.Name, p.Brand, p.Category, p.Description, p.Price, p.CompareAtPrice, p.Emoji, p.Color,
		p.ImageURL, p.Rating, p.ReviewCount, p.Featured, p.Active).Scan(&p.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create product")
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func updateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid product id")
		return
	}
	p, problem := decodeProduct(r)
	if problem != "" {
		writeError(w, http.StatusBadRequest, problem)
		return
	}
	res, err := db.ExecContext(r.Context(), `
		UPDATE products SET name=$1, brand=$2, category=$3, description=$4, price=$5, compare_at_price=$6,
		       emoji=$7, color=$8, image_url=$9, rating=$10, review_count=$11, featured=$12, active=$13
		WHERE id=$14`,
		p.Name, p.Brand, p.Category, p.Description, p.Price, p.CompareAtPrice, p.Emoji, p.Color,
		p.ImageURL, p.Rating, p.ReviewCount, p.Featured, p.Active, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not update product")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "product not found")
		return
	}
	p.ID = id
	writeJSON(w, http.StatusOK, p)
}

func deleteProduct(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid product id")
		return
	}
	// Soft delete: past orders keep referring to this product.
	res, err := db.ExecContext(r.Context(), "UPDATE products SET active = FALSE WHERE id = $1", id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not remove product")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "product not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
