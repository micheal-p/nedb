package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nedb/backend/internal/cache"
	"github.com/nedb/backend/internal/db"
	"github.com/nedb/backend/internal/middleware"
	"github.com/nedb/backend/internal/models"
	"github.com/nedb/backend/internal/services"
	"github.com/xuri/excelize/v2"
)

type UploadHandler struct {
	pool  *pgxpool.Pool
	cache *cache.Client
}

func NewUploadHandler(pool *pgxpool.Pool, c *cache.Client) *UploadHandler {
	return &UploadHandler{pool: pool, cache: c}
}

const maxUploadSize = 10 << 20 // 10 MB

func (h *UploadHandler) Validate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	username := middleware.UsernameFromCtx(ctx)
	fullName := middleware.FullNameFromCtx(ctx)
	if fullName == "" {
		fullName = username
	}

	// Rate limit: 5 uploads/hour per user
	rateKey := "rate:upload:" + username
	count, _ := h.cache.Incr(ctx, rateKey)
	if count == 1 {
		_ = h.cache.Expire(ctx, rateKey, time.Hour)
	}
	if count > 5 {
		jsonError(w, "upload rate limit exceeded (5/hour)", http.StatusTooManyRequests)
		return
	}

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		jsonError(w, "file too large (max 10MB)", http.StatusBadRequest)
		return
	}

	seriesTypeID := r.FormValue("series_type_id")
	if seriesTypeID == "" {
		jsonError(w, "series_type_id is required", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Check series type exists
	if _, err := db.GetSeries(ctx, h.pool, seriesTypeID); err != nil {
		jsonError(w, "unknown series_type_id", http.StatusBadRequest)
		return
	}

	// Create upload session (store full name for audit trail)
	sessionID, err := db.CreateUploadSession(ctx, h.pool, seriesTypeID, header.Filename, fullName)
	if err != nil {
		jsonError(w, "failed to create upload session", http.StatusInternalServerError)
		return
	}

	// Read file bytes
	fileBytes, err := io.ReadAll(io.LimitReader(file, maxUploadSize))
	if err != nil {
		jsonError(w, "failed to read file", http.StatusInternalServerError)
		return
	}

	// Parse based on extension
	var result *services.ParseResult
	filename := strings.ToLower(header.Filename)

	if strings.HasSuffix(filename, ".xlsx") || strings.HasSuffix(filename, ".xls") {
		f, err := excelize.OpenReader(bytes.NewReader(fileBytes))
		if err != nil {
			jsonError(w, "invalid XLSX file", http.StatusBadRequest)
			return
		}
		result, err = services.ParseXLSX(f, seriesTypeID, sessionID)
		if err != nil {
			jsonError(w, fmt.Sprintf("parse XLSX: %s", err.Error()), http.StatusBadRequest)
			return
		}
	} else if strings.HasSuffix(filename, ".csv") {
		result, err = services.ParseCSV(bytes.NewReader(fileBytes), seriesTypeID, sessionID)
		if err != nil {
			jsonError(w, fmt.Sprintf("parse CSV: %s", err.Error()), http.StatusBadRequest)
			return
		}
	} else {
		jsonError(w, "unsupported file type — upload CSV or XLSX", http.StatusBadRequest)
		return
	}

	totalRows := len(result.Rows) + len(result.Errors)
	errCount := len(result.Errors)

	// Insert validation errors to DB
	if len(result.Errors) > 0 {
		_ = db.InsertValidationErrors(ctx, h.pool, result.Errors)
	}

	// Cache valid rows in Redis for commit step
	if len(result.Rows) > 0 {
		_ = h.cache.Set(ctx, fmt.Sprintf("upload:session:%d:rows", sessionID), result.Rows, 60*time.Minute)
	}

	status := "validated"
	if errCount > 0 && len(result.Rows) == 0 {
		status = "rejected"
	}
	_ = db.UpdateUploadSession(ctx, h.pool, sessionID, status, totalRows, errCount)

	jsonOK(w, map[string]any{
		"session_id": sessionID,
		"total_rows": totalRows,
		"valid_rows": len(result.Rows),
		"errors":     result.Errors,
		"status":     status,
	})
}

func (h *UploadHandler) Commit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	sidStr := chi.URLParam(r, "sid")
	sid, err := strconv.ParseInt(sidStr, 10, 64)
	if err != nil {
		jsonError(w, "invalid session id", http.StatusBadRequest)
		return
	}

	session, err := db.GetUploadSession(ctx, h.pool, sid)
	if err != nil {
		jsonError(w, "session not found", http.StatusNotFound)
		return
	}
	if session.Status != "validated" {
		jsonError(w, "session is not in validated state", http.StatusConflict)
		return
	}

	// Read rows from Redis
	var rows []models.EnergyRecord
	if err := h.cache.Get(ctx, fmt.Sprintf("upload:session:%d:rows", sid), &rows); err != nil {
		jsonError(w, "session rows expired or not found — please re-upload", http.StatusGone)
		return
	}

	if err := db.BulkInsertRecords(ctx, h.pool, rows); err != nil {
		jsonError(w, "failed to commit records", http.StatusInternalServerError)
		return
	}

	_ = db.UpdateUploadSession(ctx, h.pool, sid, "committed", len(rows), 0)

	// Bust caches for this series
	_ = h.cache.Del(ctx, "series:list", "stats:"+session.SeriesTypeID)
	if keys, err := h.cache.Keys(ctx, "series:"+session.SeriesTypeID+":data:*"); err == nil {
		if len(keys) > 0 {
			_ = h.cache.Del(ctx, keys...)
		}
	}

	jsonOK(w, map[string]any{
		"committed_rows":  len(rows),
		"series_type_id":  session.SeriesTypeID,
		"session_id":      sid,
	})
}

func jsonDecode(r *http.Request, dest any) error {
	return json.NewDecoder(r.Body).Decode(dest)
}
