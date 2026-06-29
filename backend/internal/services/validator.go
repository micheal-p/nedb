package services

import (
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/nedb/backend/internal/models"
	"github.com/xuri/excelize/v2"
)

// ValidUnits is the allowed unit codelist.
var ValidUnits = map[string]bool{
	"Barrels": true, "Barrels/day": true, "MMSCFD": true, "MMSCF": true,
	"Litres": true, "Metric Tonnes": true, "GWh": true, "MWh": true,
	"MW": true, "MWh/hr": true, "MWh/day": true, "Thousand Barrels": true,
	"Million Barrels": true, "BCF": true, "TCF": true, "KG": true,
	"Tonnes": true, "Number": true, "%": true,
}

// ValidFrequencyFormats defines expected period formats per frequency.
var periodLayouts = []string{
	"2006",       // annual
	"2006-01",    // monthly
	"2006-Q1",    // quarterly (special)
	"2006-01-02", // daily
}

type ParseResult struct {
	Rows    []models.EnergyRecord
	Errors  []models.ValidationError
	Session *models.UploadSession
}

// ParseCSV parses a CSV reader and validates rows.
func ParseCSV(r io.Reader, seriesTypeID string, sessionID int64) (*ParseResult, error) {
	reader := csv.NewReader(r)
	reader.TrimLeadingSpace = true

	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("read csv header: %w", err)
	}
	colIndex := buildColIndex(header)

	result := &ParseResult{}
	rowNum := 1
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read csv row %d: %w", rowNum, err)
		}
		rowNum++
		row := models.UploadRow{
			RowNumber:          rowNum,
			Period:             getCol(record, colIndex, "period"),
			Region:             getCol(record, colIndex, "region"),
			FuelProduct:        getCol(record, colIndex, "fuel_product"),
			Value:              getCol(record, colIndex, "value"),
			Unit:               getCol(record, colIndex, "unit"),
			Source:             getCol(record, colIndex, "source"),
			Notes:              getCol(record, colIndex, "notes"),
			MethodologyVersion: getCol(record, colIndex, "methodology_version"),
		}
		validateAndAppend(row, seriesTypeID, sessionID, result)
	}
	return result, nil
}

// ParseXLSX parses the first sheet of an XLSX file.
func ParseXLSX(f *excelize.File, seriesTypeID string, sessionID int64) (*ParseResult, error) {
	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("no sheets found in file")
	}
	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, fmt.Errorf("read xlsx sheet: %w", err)
	}
	if len(rows) == 0 {
		return &ParseResult{}, nil
	}

	colIndex := buildColIndex(rows[0])
	result := &ParseResult{}

	for i, row := range rows[1:] {
		r := models.UploadRow{
			RowNumber:          i + 2,
			Period:             getCol(row, colIndex, "period"),
			Region:             getCol(row, colIndex, "region"),
			FuelProduct:        getCol(row, colIndex, "fuel_product"),
			Value:              getCol(row, colIndex, "value"),
			Unit:               getCol(row, colIndex, "unit"),
			Source:             getCol(row, colIndex, "source"),
			Notes:              getCol(row, colIndex, "notes"),
			MethodologyVersion: getCol(row, colIndex, "methodology_version"),
		}
		// Skip blank rows
		if r.Period == "" && r.Value == "" {
			continue
		}
		validateAndAppend(r, seriesTypeID, sessionID, result)
	}
	return result, nil
}

func validateAndAppend(row models.UploadRow, seriesTypeID string, sessionID int64, result *ParseResult) {
	var rowErrors []models.ValidationError
	var record models.EnergyRecord

	// Required: period
	if row.Period == "" {
		rowErrors = append(rowErrors, models.ValidationError{
			SessionID: sessionID, RowNumber: row.RowNumber,
			ColumnName: "period", ErrorType: "missing_required",
			ErrorMessage: "period is required",
		})
	} else {
		pd, err := parsePeriodDate(row.Period)
		if err != nil {
			rowErrors = append(rowErrors, models.ValidationError{
				SessionID: sessionID, RowNumber: row.RowNumber,
				ColumnName: "period", ErrorType: "bad_format",
				ErrorMessage: fmt.Sprintf("cannot parse period %q: use YYYY, YYYY-MM, or YYYY-QN", row.Period),
				RawValue:     row.Period,
			})
		} else {
			record.Period = row.Period
			record.PeriodDate = pd
		}
	}

	// Required: value
	if row.Value == "" {
		rowErrors = append(rowErrors, models.ValidationError{
			SessionID: sessionID, RowNumber: row.RowNumber,
			ColumnName: "value", ErrorType: "missing_required",
			ErrorMessage: "value is required",
		})
	} else {
		cleaned := strings.ReplaceAll(strings.ReplaceAll(row.Value, ",", ""), " ", "")
		v, err := strconv.ParseFloat(cleaned, 64)
		if err != nil {
			rowErrors = append(rowErrors, models.ValidationError{
				SessionID: sessionID, RowNumber: row.RowNumber,
				ColumnName: "value", ErrorType: "bad_format",
				ErrorMessage: fmt.Sprintf("value %q is not a number", row.Value),
				RawValue:     row.Value,
			})
		} else {
			record.Value = &v
		}
	}

	// Required: unit
	if row.Unit == "" {
		rowErrors = append(rowErrors, models.ValidationError{
			SessionID: sessionID, RowNumber: row.RowNumber,
			ColumnName: "unit", ErrorType: "missing_required",
			ErrorMessage: "unit is required",
		})
	} else if !ValidUnits[row.Unit] {
		rowErrors = append(rowErrors, models.ValidationError{
			SessionID: sessionID, RowNumber: row.RowNumber,
			ColumnName: "unit", ErrorType: "invalid_unit",
			ErrorMessage: fmt.Sprintf("unit %q is not in the allowed codelist", row.Unit),
			RawValue:     row.Unit,
		})
	} else {
		record.Unit = row.Unit
	}

	if len(rowErrors) > 0 {
		result.Errors = append(result.Errors, rowErrors...)
		return
	}

	region := row.Region
	if region == "" {
		region = "NGA"
	}
	mv := row.MethodologyVersion
	if mv == "" {
		mv = "v1"
	}

	record.SeriesTypeID = seriesTypeID
	record.Region = region
	record.FuelProduct = row.FuelProduct
	record.Source = row.Source
	record.Notes = row.Notes
	record.MethodologyVersion = mv
	sid := sessionID
	record.UploadSessionID = &sid

	result.Rows = append(result.Rows, record)
}

func parsePeriodDate(period string) (time.Time, error) {
	// Annual: 2023
	if len(period) == 4 {
		return time.Parse("2006", period)
	}
	// Monthly: 2023-01
	if len(period) == 7 && period[4] == '-' && period[5] != 'Q' {
		return time.Parse("2006-01", period)
	}
	// Quarterly: 2023-Q1
	if len(period) == 7 && strings.Contains(period, "-Q") {
		parts := strings.Split(period, "-Q")
		if len(parts) != 2 {
			return time.Time{}, fmt.Errorf("invalid quarter format")
		}
		q, err := strconv.Atoi(parts[1])
		if err != nil || q < 1 || q > 4 {
			return time.Time{}, fmt.Errorf("invalid quarter number")
		}
		month := (q-1)*3 + 1
		return time.Parse("2006-01", fmt.Sprintf("%s-%02d", parts[0], month))
	}
	// Daily: 2023-01-15
	if len(period) == 10 {
		return time.Parse("2006-01-02", period)
	}
	return time.Time{}, fmt.Errorf("unrecognised period format")
}

func buildColIndex(header []string) map[string]int {
	idx := make(map[string]int)
	for i, h := range header {
		idx[strings.ToLower(strings.TrimSpace(h))] = i
	}
	return idx
}

func getCol(row []string, idx map[string]int, key string) string {
	i, ok := idx[key]
	if !ok || i >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[i])
}
