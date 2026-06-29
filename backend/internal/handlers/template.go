package handlers

import (
	"context"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nedb/backend/internal/db"
	"github.com/nedb/backend/internal/services"
)

type TemplateHandler struct {
	pool *pgxpool.Pool
}

func NewTemplateHandler(pool *pgxpool.Pool) *TemplateHandler {
	return &TemplateHandler{pool: pool}
}

func (h *TemplateHandler) Download(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := context.Background()

	series, err := db.GetSeries(ctx, h.pool, id)
	if err != nil {
		jsonError(w, "series type not found", http.StatusNotFound)
		return
	}

	data, err := services.GenerateTemplate(series.ID, series.Name, series.UnitDefault)
	if err != nil {
		jsonError(w, "failed to generate template", http.StatusInternalServerError)
		return
	}

	filename := fmt.Sprintf("NEDB_%s_template.xlsx", series.ID)
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}
