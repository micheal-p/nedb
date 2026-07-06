package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nedb/backend/internal/middleware"
	"golang.org/x/crypto/bcrypt"
)

type UsersHandler struct {
	pool *pgxpool.Pool
}

func NewUsersHandler(pool *pgxpool.Pool) *UsersHandler {
	return &UsersHandler{pool: pool}
}

type StaffUserResponse struct {
	ID        int64   `json:"id"`
	Username  string  `json:"username"`
	FullName  string  `json:"full_name"`
	Email     string  `json:"email"`
	Role      string  `json:"role"`
	Agency    string  `json:"agency"`
	IsActive  bool    `json:"is_active"`
	CreatedBy string  `json:"created_by"`
	CreatedAt string  `json:"created_at"`
	LastLogin *string `json:"last_login"`
}

func (h *UsersHandler) List(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(),
		`SELECT id, username, full_name, email, role, COALESCE(agency,''), is_active,
		        COALESCE(created_by,''), to_char(created_at, 'YYYY-MM-DD HH24:MI'),
		        to_char(last_login, 'YYYY-MM-DD HH24:MI')
		 FROM staff_users ORDER BY created_at DESC`)
	if err != nil {
		jsonError(w, "query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []StaffUserResponse
	for rows.Next() {
		var u StaffUserResponse
		if err := rows.Scan(&u.ID, &u.Username, &u.FullName, &u.Email, &u.Role,
			&u.Agency, &u.IsActive, &u.CreatedBy, &u.CreatedAt, &u.LastLogin); err != nil {
			continue
		}
		users = append(users, u)
	}
	if users == nil {
		users = []StaffUserResponse{}
	}
	jsonOK(w, users)
}

func (h *UsersHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		FullName string `json:"full_name"`
		Email    string `json:"email"`
		Role     string `json:"role"`
		Agency   string `json:"agency"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Username == "" || req.FullName == "" || req.Email == "" || req.Password == "" {
		jsonError(w, "username, full_name, email, and password are required", http.StatusBadRequest)
		return
	}
	if req.Role == "" {
		req.Role = "staff"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "password hashing failed", http.StatusInternalServerError)
		return
	}

	createdBy := middleware.FullNameFromCtx(r.Context())
	if createdBy == "" {
		createdBy = middleware.UsernameFromCtx(r.Context())
	}

	var id int64
	err = h.pool.QueryRow(r.Context(),
		`INSERT INTO staff_users (username, full_name, email, role, password_hash, agency, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		req.Username, req.FullName, req.Email, req.Role, string(hash), req.Agency, createdBy,
	).Scan(&id)
	if err != nil {
		jsonError(w, "username or email already exists", http.StatusConflict)
		return
	}

	w.WriteHeader(http.StatusCreated)
	jsonOK(w, map[string]any{
		"id":        id,
		"username":  req.Username,
		"full_name": req.FullName,
		"role":      req.Role,
	})
}

func (h *UsersHandler) ToggleActive(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	var isActive bool
	err = h.pool.QueryRow(r.Context(),
		`UPDATE staff_users SET is_active = NOT is_active WHERE id = $1 RETURNING is_active`, id,
	).Scan(&isActive)
	if err != nil {
		jsonError(w, "user not found", http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]any{"id": id, "is_active": isActive})
}

func (h *UsersHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Password == "" {
		jsonError(w, "new password required", http.StatusBadRequest)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "hashing failed", http.StatusInternalServerError)
		return
	}
	_, err = h.pool.Exec(r.Context(),
		`UPDATE staff_users SET password_hash = $1 WHERE id = $2`, string(hash), id)
	if err != nil {
		jsonError(w, "update failed", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"id": id, "reset": true})
}
