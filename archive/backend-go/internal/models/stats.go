package models

type AutoStats struct {
	SeriesTypeID string   `json:"series_type_id"`
	Latest       *float64 `json:"latest"`
	LatestPeriod string   `json:"latest_period"`
	YoYPct       *float64 `json:"yoy_pct"`
	MoMPct       *float64 `json:"mom_pct"`
	CAGR         *float64 `json:"cagr"`
	Rolling3     *float64 `json:"rolling_3"`
	Rolling12    *float64 `json:"rolling_12"`
	Unit         string   `json:"unit"`
}
