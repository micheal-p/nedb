package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/nedb/backend/internal/cache"
	"github.com/nedb/backend/internal/config"
	"github.com/nedb/backend/internal/db"
	"github.com/nedb/backend/internal/handlers"
	mw "github.com/nedb/backend/internal/middleware"
)

func main() {
	cfg := config.Load()

	pool, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()
	log.Println("database connected")

	rdb, err := cache.New(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	log.Println("redis connected")

	authH := handlers.NewAuthHandler(cfg, pool)
	seriesH := handlers.NewSeriesHandler(pool, rdb)
	uploadH := handlers.NewUploadHandler(pool, rdb)
	templateH := handlers.NewTemplateHandler(pool)
	usersH := handlers.NewUsersHandler(pool)

	r := chi.NewRouter()
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Timeout(60 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.CORSOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health
	r.Get("/health", func(w http.ResponseWriter, req *http.Request) {
		dbStatus := "ok"
		if err := pool.Ping(req.Context()); err != nil {
			dbStatus = "error: " + err.Error()
		}
		cacheStatus := "ok"
		if err := rdb.Ping(req.Context()); err != nil {
			cacheStatus = "error: " + err.Error()
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
			"db":     dbStatus,
			"cache":  cacheStatus,
		})
	})

	// Auth routes (public)
	r.Post("/api/auth/login", authH.Login)
	r.Post("/api/auth/refresh", authH.Refresh)

	// Series routes (public)
	r.Get("/api/series", seriesH.List)
	r.Get("/api/series/{id}", seriesH.Get)
	r.Get("/api/series/{id}/data", seriesH.Data)
	r.Get("/api/series/{id}/stats", seriesH.Stats)

	// Template download (public)
	r.Get("/api/templates/{id}", templateH.Download)

	// Protected routes (any authenticated staff)
	r.Group(func(r chi.Router) {
		r.Use(mw.JWT(cfg.JWTSecret))
		r.Post("/api/upload/validate", uploadH.Validate)
		r.Post("/api/upload/commit/{sid}", uploadH.Commit)
	})

	// Admin-only routes
	r.Group(func(r chi.Router) {
		r.Use(mw.JWT(cfg.JWTSecret))
		r.Use(mw.AdminOnly)
		r.Get("/api/admin/users", usersH.List)
		r.Post("/api/admin/users", usersH.Create)
		r.Put("/api/admin/users/{id}/toggle", usersH.ToggleActive)
		r.Put("/api/admin/users/{id}/password", usersH.ResetPassword)
	})

	addr := ":" + cfg.Port
	log.Printf("NEDB API listening on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server: %v", err)
	}
	fmt.Println("done")
}
