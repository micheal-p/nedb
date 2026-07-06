package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nedb/backend/internal/cache"
	"github.com/nedb/backend/internal/db"
)

type SeriesHandler struct {
	pool  *pgxpool.Pool
	cache *cache.Client
}

func NewSeriesHandler(pool *pgxpool.Pool, c *cache.Client) *SeriesHandler {
	return &SeriesHandler{pool: pool, cache: c}
}

func (h *SeriesHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var result any
	if err := h.cache.Get(ctx, "series:list", &result); err == nil {
		jsonOK(w, result)
		return
	}

	series, err := db.ListSeries(ctx, h.pool)
	if err != nil {
		jsonError(w, "failed to list series", http.StatusInternalServerError)
		return
	}

	_ = h.cache.Set(ctx, "series:list", series, 15*time.Minute)
	jsonOK(w, series)
}

func (h *SeriesHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()

	series, err := db.GetSeries(ctx, h.pool, id)
	if err != nil {
		jsonError(w, "series not found", http.StatusNotFound)
		return
	}
	jsonOK(w, series)
}

func (h *SeriesHandler) Data(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	limit, _ := strconv.Atoi(q.Get("limit"))

	filter := db.DataFilter{
		Region:     q.Get("region"),
		PeriodFrom: q.Get("period_from"),
		PeriodTo:   q.Get("period_to"),
		Page:       page,
		Limit:      limit,
	}

	// Cache key based on query params
	cacheKey := "series:" + id + ":data:" + r.URL.RawQuery

	var cached any
	if err := h.cache.Get(ctx, cacheKey, &cached); err == nil {
		jsonOK(w, cached)
		return
	}

	data, err := db.GetSeriesData(ctx, h.pool, id, filter)
	if err != nil {
		jsonError(w, "failed to fetch series data", http.StatusInternalServerError)
		return
	}

	_ = h.cache.Set(ctx, cacheKey, data, 30*time.Minute)
	jsonOK(w, data)
}

func (h *SeriesHandler) Stats(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()

	cacheKey := "stats:" + id
	var cached any
	if err := h.cache.Get(ctx, cacheKey, &cached); err == nil {
		jsonOK(w, cached)
		return
	}

	stats, err := db.ComputeStats(ctx, h.pool, id)
	if err != nil {
		jsonError(w, "failed to compute stats", http.StatusInternalServerError)
		return
	}

	_ = h.cache.Set(ctx, cacheKey, stats, time.Hour)
	jsonOK(w, stats)
}
