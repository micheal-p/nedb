import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";

export async function GET() {
  try {
    await db().from("series_types").select("id").limit(1);
    return NextResponse.json({ status: "ok", db: "ok", cache: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded", db: "error", cache: "ok" }, { status: 503 });
  }
}
