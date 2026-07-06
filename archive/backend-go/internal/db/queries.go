package db

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nedb/backend/internal/models"
)

// ListSeries returns all series types with their record counts.
func ListSeries(ctx context.Context, pool *pgxpool.Pool) ([]models.SeriesType, error) {
	rows, err := pool.Query(ctx, `
		SELECT st.id, st.name, st.sector, COALESCE(st.subsector,''), st.unit_default,
		       st.frequency, st.viz_types, st.created_at,
		       COUNT(er.id) AS record_count
		FROM series_types st
		LEFT JOIN energy_records er ON er.series_type_id = st.id
		GROUP BY st.id
		ORDER BY st.sector, st.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []models.SeriesType
	for rows.Next() {
		var s models.SeriesType
		if err := rows.Scan(&s.ID, &s.Name, &s.Sector, &s.Subsector, &s.UnitDefault,
			&s.Frequency, &s.VizTypes, &s.CreatedAt, &s.RecordCount); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

// GetSeries returns one series type by ID.
func GetSeries(ctx context.Context, pool *pgxpool.Pool, id string) (*models.SeriesType, error) {
	var s models.SeriesType
	err := pool.QueryRow(ctx, `
		SELECT st.id, st.name, st.sector, COALESCE(st.subsector,''), st.unit_default,
		       st.frequency, st.viz_types, st.created_at,
		       COUNT(er.id) AS record_count
		FROM series_types st
		LEFT JOIN energy_records er ON er.series_type_id = st.id
		WHERE st.id = $1
		GROUP BY st.id
	`, id).Scan(&s.ID, &s.Name, &s.Sector, &s.Subsector, &s.UnitDefault,
		&s.Frequency, &s.VizTypes, &s.CreatedAt, &s.RecordCount)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

type DataFilter struct {
	Region     string
	PeriodFrom string
	PeriodTo   string
	Page       int
	Limit      int
}

type DataPage struct {
	Rows  []models.EnergyRecord `json:"rows"`
	Total int64                 `json:"total"`
	Page  int                   `json:"page"`
	Limit int                   `json:"limit"`
}

// GetSeriesData returns paginated energy records for a series.
func GetSeriesData(ctx context.Context, pool *pgxpool.Pool, seriesID string, f DataFilter) (*DataPage, error) {
	if f.Limit <= 0 {
		f.Limit = 100
	}
	if f.Page <= 0 {
		f.Page = 1
	}
	offset := (f.Page - 1) * f.Limit

	args := []any{seriesID}
	wheres := []string{"series_type_id = $1"}
	i := 2

	if f.Region != "" {
		wheres = append(wheres, fmt.Sprintf("region = $%d", i))
		args = append(args, f.Region)
		i++
	}
	if f.PeriodFrom != "" {
		wheres = append(wheres, fmt.Sprintf("period_date >= $%d", i))
		args = append(args, f.PeriodFrom)
		i++
	}
	if f.PeriodTo != "" {
		wheres = append(wheres, fmt.Sprintf("period_date <= $%d", i))
		args = append(args, f.PeriodTo)
		i++
	}

	where := "WHERE " + strings.Join(wheres, " AND ")

	var total int64
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM energy_records "+where, args...).Scan(&total); err != nil {
		return nil, err
	}

	args = append(args, f.Limit, offset)
	q := fmt.Sprintf(`
		SELECT id, series_type_id, period, period_date, region,
		       COALESCE(fuel_product,''), value, unit,
		       COALESCE(source,''), COALESCE(notes,''), methodology_version,
		       upload_session_id, created_at
		FROM energy_records %s
		ORDER BY period_date ASC
		LIMIT $%d OFFSET $%d`, where, i, i+1)

	rows, err := pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []models.EnergyRecord
	for rows.Next() {
		var r models.EnergyRecord
		if err := rows.Scan(&r.ID, &r.SeriesTypeID, &r.Period, &r.PeriodDate, &r.Region,
			&r.FuelProduct, &r.Value, &r.Unit, &r.Source, &r.Notes,
			&r.MethodologyVersion, &r.UploadSessionID, &r.CreatedAt); err != nil {
			return nil, err
		}
		records = append(records, r)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	return &DataPage{Rows: records, Total: total, Page: f.Page, Limit: f.Limit}, nil
}

// CreateUploadSession inserts a new upload session and returns its ID.
func CreateUploadSession(ctx context.Context, pool *pgxpool.Pool, seriesTypeID, filename, uploadedBy string) (int64, error) {
	var id int64
	err := pool.QueryRow(ctx, `
		INSERT INTO upload_sessions (series_type_id, filename, uploaded_by)
		VALUES ($1, $2, $3) RETURNING id
	`, seriesTypeID, filename, uploadedBy).Scan(&id)
	return id, err
}

// UpdateUploadSession updates status, row count, and error count.
func UpdateUploadSession(ctx context.Context, pool *pgxpool.Pool, id int64, status string, rowCount, errCount int) error {
	_, err := pool.Exec(ctx, `
		UPDATE upload_sessions SET status=$2, row_count=$3, error_count=$4 WHERE id=$1
	`, id, status, rowCount, errCount)
	return err
}

// InsertValidationErrors bulk-inserts validation errors for a session.
func InsertValidationErrors(ctx context.Context, pool *pgxpool.Pool, errs []models.ValidationError) error {
	if len(errs) == 0 {
		return nil
	}
	rows := make([][]any, len(errs))
	for i, e := range errs {
		rows[i] = []any{e.SessionID, e.RowNumber, e.ColumnName, e.ErrorType, e.ErrorMessage, e.RawValue}
	}
	_, err := pool.CopyFrom(ctx, pgx.Identifier{"validation_errors"},
		[]string{"session_id", "row_number", "column_name", "error_type", "error_message", "raw_value"},
		pgx.CopyFromRows(rows))
	return err
}

// BulkInsertRecords inserts committed energy records.
func BulkInsertRecords(ctx context.Context, pool *pgxpool.Pool, records []models.EnergyRecord) error {
	rows := make([][]any, len(records))
	for i, r := range records {
		rows[i] = []any{
			r.SeriesTypeID, r.Period, r.PeriodDate, r.Region, r.FuelProduct,
			r.Value, r.Unit, r.Source, r.Notes, r.MethodologyVersion, r.UploadSessionID,
		}
	}
	_, err := pool.CopyFrom(ctx, pgx.Identifier{"energy_records"},
		[]string{"series_type_id", "period", "period_date", "region", "fuel_product",
			"value", "unit", "source", "notes", "methodology_version", "upload_session_id"},
		pgx.CopyFromRows(rows))
	return err
}

// GetUploadSession returns an upload session by ID.
func GetUploadSession(ctx context.Context, pool *pgxpool.Pool, id int64) (*models.UploadSession, error) {
	var s models.UploadSession
	err := pool.QueryRow(ctx, `
		SELECT id, series_type_id, filename, row_count, error_count, status,
		       COALESCE(uploaded_by,''), created_at
		FROM upload_sessions WHERE id=$1
	`, id).Scan(&s.ID, &s.SeriesTypeID, &s.Filename, &s.RowCount, &s.ErrorCount,
		&s.Status, &s.UploadedBy, &s.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// ComputeStats computes auto-stats for a series.
func ComputeStats(ctx context.Context, pool *pgxpool.Pool, seriesID string) (*models.AutoStats, error) {
	rows, err := pool.Query(ctx, `
		SELECT period, period_date, value, unit
		FROM energy_records
		WHERE series_type_id = $1 AND value IS NOT NULL
		ORDER BY period_date DESC
	`, seriesID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type rec struct {
		period     string
		periodDate time.Time
		value      float64
		unit       string
	}

	var all []rec
	for rows.Next() {
		var r rec
		if err := rows.Scan(&r.period, &r.periodDate, &r.value, &r.unit); err != nil {
			return nil, err
		}
		all = append(all, r)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}

	stats := &models.AutoStats{SeriesTypeID: seriesID}
	if len(all) == 0 {
		return stats, nil
	}

	latest := all[0]
	stats.Latest = &latest.value
	stats.LatestPeriod = latest.period
	stats.Unit = latest.unit

	// YoY: compare to ~12 records ago (monthly) or 1 record ago (annual/quarterly)
	yoyIdx := 1
	if len(all) >= 13 {
		yoyIdx = 12
	}
	if len(all) > yoyIdx {
		prev := all[yoyIdx].value
		if prev != 0 {
			pct := (latest.value - prev) / prev * 100
			stats.YoYPct = &pct
		}
	}

	// MoM: latest vs immediately previous
	if len(all) >= 2 {
		prev := all[1].value
		if prev != 0 {
			pct := (latest.value - prev) / prev * 100
			stats.MoMPct = &pct
		}
	}

	// CAGR: (latest/oldest)^(1/years) - 1
	if len(all) >= 2 {
		oldest := all[len(all)-1]
		years := latest.periodDate.Sub(oldest.periodDate).Hours() / 8760
		if oldest.value > 0 && years > 0 {
			cagr := (math.Pow(latest.value/oldest.value, 1/years) - 1) * 100
			stats.CAGR = &cagr
		}
	}

	// Rolling 3
	if len(all) >= 3 {
		sum := all[0].value + all[1].value + all[2].value
		avg := sum / 3
		stats.Rolling3 = &avg
	}

	// Rolling 12
	if len(all) >= 12 {
		sum := 0.0
		for i := 0; i < 12; i++ {
			sum += all[i].value
		}
		avg := sum / 12
		stats.Rolling12 = &avg
	}

	return stats, nil
}
