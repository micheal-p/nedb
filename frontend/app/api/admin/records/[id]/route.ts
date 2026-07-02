import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || isNaN(Number(id))) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { error } = await db().from("energy_records").delete().eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: Number(id) });
}
