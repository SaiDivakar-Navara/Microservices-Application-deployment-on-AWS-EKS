package main

import (
	"encoding/json"
	"net/http"
	"time"
)

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

type authUser struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

// currentUser asks the auth-service who owns the Bearer token.
func currentUser(r *http.Request) (*authUser, bool) {
	header := r.Header.Get("Authorization")
	if header == "" {
		return nil, false
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, authURL+"/api/auth/me", nil)
	if err != nil {
		return nil, false
	}
	req.Header.Set("Authorization", header)
	resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
	if err != nil {
		return nil, false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, false
	}
	var u authUser
	if json.NewDecoder(resp.Body).Decode(&u) != nil {
		return nil, false
	}
	return &u, true
}

// adminOnly wraps a handler so only ADMIN users (or other services holding
// the internal key) can call it.
func adminOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Internal-Key") == internalKey {
			next(w, r)
			return
		}
		user, ok := currentUser(r)
		if !ok {
			writeError(w, http.StatusUnauthorized, "sign in required")
			return
		}
		if user.Role != "ADMIN" {
			writeError(w, http.StatusForbidden, "admin access required")
			return
		}
		next(w, r)
	}
}
