package models

import "time"

type SeriesType struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Sector       string    `json:"sector"`
	Subsector    string    `json:"subsector,omitempty"`
	UnitDefault  string    `json:"unit_default"`
	Frequency    string    `json:"frequency"`
	VizTypes     []string  `json:"viz_types"`
	RecordCount  int64     `json:"record_count"`
	CreatedAt    time.Time `json:"created_at"`
}

type EnergyRecord struct {
	ID                 int64     `json:"id"`
	SeriesTypeID       string    `json:"series_type_id"`
	Period             string    `json:"period"`
	PeriodDate         time.Time `json:"period_date"`
	Region             string    `json:"region"`
	FuelProduct        string    `json:"fuel_product,omitempty"`
	Value              *float64  `json:"value"`
	Unit               string    `json:"unit"`
	Source             string    `json:"source,omitempty"`
	Notes              string    `json:"notes,omitempty"`
	MethodologyVersion string    `json:"methodology_version"`
	UploadSessionID    *int64    `json:"upload_session_id,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
}

type UploadSession struct {
	ID            int64     `json:"id"`
	SeriesTypeID  string    `json:"series_type_id"`
	Filename      string    `json:"filename"`
	RowCount      int       `json:"row_count"`
	ErrorCount    int       `json:"error_count"`
	Status        string    `json:"status"`
	UploadedBy    string    `json:"uploaded_by,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type ValidationError struct {
	ID           int64  `json:"id"`
	SessionID    int64  `json:"session_id"`
	RowNumber    int    `json:"row_number"`
	ColumnName   string `json:"column_name"`
	ErrorType    string `json:"error_type"`
	ErrorMessage string `json:"error_message"`
	RawValue     string `json:"raw_value,omitempty"`
}

// UploadRow is a parsed row from a CSV/XLSX upload, pre-validation.
type UploadRow struct {
	RowNumber          int
	Period             string
	Region             string
	FuelProduct        string
	Value              string
	Unit               string
	Source             string
	Notes              string
	MethodologyVersion string
}
