package services

import (
	"bytes"

	"github.com/xuri/excelize/v2"
)

// GenerateTemplate creates an XLSX template for a given series type.
func GenerateTemplate(seriesTypeID, seriesName, unitDefault string) ([]byte, error) {
	f := excelize.NewFile()
	sheet := "Data"
	f.NewSheet(sheet)
	f.DeleteSheet("Sheet1")

	headers := []string{
		"period", "region", "fuel_product", "value", "unit", "source", "notes", "methodology_version",
	}

	// Style: header row
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"0E7A3C"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
		Border: []excelize.Border{
			{Type: "bottom", Color: "FFFFFF", Style: 2},
		},
	})

	// Style: sample row
	sampleStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Color: "888888", Italic: true},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"F4F2EC"}, Pattern: 1},
	})

	// Write headers
	for i, h := range headers {
		col := string(rune('A' + i))
		cell := col + "1"
		f.SetCellValue(sheet, cell, h)
		f.SetCellStyle(sheet, cell, cell, headerStyle)
		f.SetColWidth(sheet, col, col, 18)
	}
	f.SetRowHeight(sheet, 1, 28)

	// Write sample row
	sample := []string{
		"2023-01", "NGA", "", "12345.67", unitDefault, "NUPRC", "", "v1",
	}
	for i, v := range sample {
		col := string(rune('A' + i))
		cell := col + "2"
		f.SetCellValue(sheet, cell, v)
		f.SetCellStyle(sheet, cell, cell, sampleStyle)
	}

	// Add a note sheet with field descriptions
	noteSheet := "Field Guide"
	f.NewSheet(noteSheet)
	noteStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 11},
	})
	guide := [][]string{
		{"Field", "Required", "Format / Allowed Values", "Example"},
		{"period", "Yes", "YYYY (annual) | YYYY-MM (monthly) | YYYY-QN (quarterly)", "2023-01"},
		{"region", "No", "ISO 3166-2:NG code or NGA for national aggregate", "NGA"},
		{"fuel_product", "No", "PMS, AGO, LPG, Crude, NG, HHK, DPK, ATK, Charcoal, etc.", "PMS"},
		{"value", "Yes", "Numeric (commas allowed)", "12345.67"},
		{"unit", "Yes", "Barrels | Barrels/day | GWh | MW | Litres | Metric Tonnes | etc.", unitDefault},
		{"source", "No", "Reporting agency abbreviation", "NUPRC"},
		{"notes", "No", "Free text annotation", "Revised figure"},
		{"methodology_version", "No", "Leave blank for v1", "v1"},
	}
	for r, row := range guide {
		for c, val := range row {
			col := string(rune('A' + c))
			cell := col + string(rune('1'+r))
			f.SetCellValue(noteSheet, cell, val)
			if r == 0 {
				f.SetCellStyle(noteSheet, cell, cell, noteStyle)
			}
		}
	}
	f.SetColWidth(noteSheet, "A", "A", 22)
	f.SetColWidth(noteSheet, "B", "B", 12)
	f.SetColWidth(noteSheet, "C", "C", 55)
	f.SetColWidth(noteSheet, "D", "D", 18)

	// Set active sheet to Data
	if idx, err := f.GetSheetIndex(sheet); err == nil {
		f.SetActiveSheet(idx)
	}

	// Add series name in a comment cell above headers
	f.SetCellValue(sheet, "A1", "period") // reset, will be styled below
	f.SetDocProps(&excelize.DocProperties{
		Title:   seriesName + " — NEDB Data Template",
		Subject: "National Energy Data Bank Upload Template",
		Creator: "NEDB System",
	})

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
