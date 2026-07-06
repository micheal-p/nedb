package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nedb/backend/internal/auth"
	"github.com/nedb/backend/internal/config"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	cfg  *config.Config
	pool *pgxpool.Pool
}

func NewAuthHandler(cfg *config.Config, pool *pgxpool.Pool) *AuthHandler {
	return &AuthHandler{cfg: cfg, pool: pool}
}

type staffUser struct {
	ID           int64
	Username     string
	FullName     string
	Email        string
	Role         string
	PasswordHash string
	Agency       string
	IsActive     bool
}

func (h *AuthHandler) lookupStaff(ctx context.Context, username string) (*staffUser, error) {
	row := h.pool.QueryRow(ctx,
		`SELECT id, username, full_name, email, role, password_hash, COALESCE(agency,''), is_active
		 FROM staff_users WHERE username = $1`, username)
	var u staffUser
	err := row.Scan(&u.ID, &u.Username, &u.FullName, &u.Email, &u.Role, &u.PasswordHash, &u.Agency, &u.IsActive)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Username == "" || req.Password == "" {
		jsonError(w, "username and password required", http.StatusBadRequest)
		return
	}

	var fullName, role string

	// 1. Check staff_users table first
	if u, err := h.lookupStaff(r.Context(), req.Username); err == nil {
		if !u.IsActive {
			jsonError(w, "account is deactivated", http.StatusUnauthorized)
			return
		}
		if err2 := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err2 != nil {
			jsonError(w, "invalid credentials", http.StatusUnauthorized)
			return
		}
		fullName = u.FullName
		role = u.Role
		// Update last_login
		_, _ = h.pool.Exec(r.Context(),
			`UPDATE staff_users SET last_login = $1 WHERE username = $2`,
			time.Now(), req.Username)
	} else {
		// 2. Fall back to .env admin
		if req.Username != h.cfg.AdminUsername {
			jsonError(w, "invalid credentials", http.StatusUnauthorized)
			return
		}
		ok := false
		if err3 := bcrypt.CompareHashAndPassword([]byte(h.cfg.AdminPassword), []byte(req.Password)); err3 == nil {
			ok = true
		} else if req.Password == h.cfg.AdminPassword {
			ok = true
		}
		if !ok {
			jsonError(w, "invalid credentials", http.StatusUnauthorized)
			return
		}
		fullName = "System Administrator"
		role = "admin"
	}

	pair, err := auth.IssueTokenPair(req.Username, fullName, role, h.cfg.JWTSecret, h.cfg.JWTRefreshSecret)
	if err != nil {
		jsonError(w, "token generation failed", http.StatusInternalServerError)
		return
	}
	jsonOK(w, pair)
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	claims, err := auth.ValidateToken(req.RefreshToken, h.cfg.JWTRefreshSecret)
	if err != nil {
		jsonError(w, "invalid or expired refresh token", http.StatusUnauthorized)
		return
	}
	pair, err := auth.IssueTokenPair(claims.Username, claims.FullName, claims.Role, h.cfg.JWTSecret, h.cfg.JWTRefreshSecret)
	if err != nil {
		jsonError(w, "token generation failed", http.StatusInternalServerError)
		return
	}
	jsonOK(w, pair)
}

// helpers shared across handlers
func jsonOK(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
