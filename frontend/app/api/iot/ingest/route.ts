import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";

function ok(data: unknown, status = 200) { return NextResponse.json(data, { status }); }
function err(msg: string, status = 400) { return NextResponse.json({ error: msg }, { status }); }

/*
  IoT / EOM Telemetry Ingest Endpoint
  ------------------------------------
  POST /api/iot/ingest
  Header: X-API-Key: <IOT_API_KEY>

  Body (single reading):
  {
    "series_type_id": "crude_oil_production",
    "period":         "2024-06",
    "period_date":    "2024-06-01",
    "value":          85.4,
    "unit":           "M Barrels",      // optional — falls back to series default
    "region":         "NGA",            // optional — defaults to NGA
    "source":         "OML-23 Sensor",  // optional
    "device_id":      "EOM-DEVICE-001", // optional — stored as notes
    "fuel_product":   "PMS"             // optional
  }

  Body (batch — up to 100 readings):
  {
    "series_type_id": "electricity_generation",
    "readings": [
      { "period": "2024-01", "period_date": "2024-01-01", "value": 2810.3, "region": "NGA" },
      { "period": "2024-02", "period_date": "2024-02-01", "value": 2790.1, "region": "NGA" }
    ]
  }
*/

export async function POST(req: NextRequest) {
  // API key auth — devices use X-API-Key, not JWT
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("ApiKey ", "");
  const expectedKey = process.env.IOT_API_KEY;

  if (!expectedKey) return err("IoT ingest endpoint not configured on this server.", 503);
  if (!apiKey || apiKey !== expectedKey) return err("Invalid or missing API key.", 401);

  const body = await req.json().catch(() => null);
  if (!body?.series_type_id) return err("series_type_id is required.");

  // Look up series
  const { data: series } = await db()
    .from("series_types")
    .select("id, unit_default, name")
    .eq("id", body.series_type_id)
    .single();

  if (!series) return err(`Unknown series_type_id: ${body.series_type_id}`, 404);

  // Normalise: single reading or batch
  const readings: Record<string, unknown>[] = body.readings
    ? body.readings
    : [body];

  if (!readings.length || readings.length > 100)
    return err("Provide 1–100 readings per request.");

  // Validate each reading
  const records = [];
  for (const r of readings) {
    if (!r.period || !r.period_date || r.value === undefined)
      return err("Each reading must have period, period_date, and value.");

    records.push({
      series_type_id:       body.series_type_id,
      period:               String(r.period),
      period_date:          String(r.period_date),
      region:               String(r.region ?? "NGA"),
      fuel_product:         r.fuel_product ? String(r.fuel_product) : null,
      value:                Number(r.value),
      unit:                 String(r.unit ?? series.unit_default),
      source:               r.source ? String(r.source) : "IoT Device",
      notes:                r.device_id ? `device_id:${r.device_id}` : null,
      methodology_version:  "iot-v1",
      upload_session_id:    null, // IoT readings bypass the session flow
    });
  }

  // Upsert on (series_type_id, period, region) so re-sent readings update in place
  const { error } = await db()
    .from("energy_records")
    .upsert(records, { onConflict: "series_type_id,period,region", ignoreDuplicates: false });

  if (error) return err(error.message, 500);

  return ok({
    success:          true,
    series:           series.name,
    committed_count:  records.length,
    timestamp:        new Date().toISOString(),
  }, 201);
}

// Healthcheck — GET /api/iot/ingest returns endpoint info (no key needed)
export async function GET() {
  return ok({
    endpoint:    "/api/iot/ingest",
    method:      "POST",
    auth:        "X-API-Key header",
    batch_limit: 100,
    formats:     ["single-reading", "batch-readings"],
    status:      process.env.IOT_API_KEY ? "active" : "not-configured",
    docs:        "Contact NEDB administrator for API key and integration guide.",
  });
}
