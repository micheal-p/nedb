import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth, requireAdmin } from "@/lib/api-helpers";
import { builderSlug } from "@/lib/dashboard-builder";

// Custom dashboard tabs + widgets (migration 038).
//   GET  ?profile=nuprc&username=jdoe → tabs a user sees (their profile's +
//        their account's), each with widgets, ordered. (staff)
//   GET  ?all=1                       → every custom tab (admin composer).
//   POST  {tab}                       → create a tab + widgets (admin).
//   PUT   {id, tab}                   → replace a tab's fields + widgets (admin).
//   DELETE ?id=N                      → remove a tab (admin).

type WidgetRow = { id: number; tab_id: number; kind: string; title: string | null; config: unknown; display_order: number };

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const sp = new URL(req.url).searchParams;

  let tabQ = db().from("dashboard_tabs").select("*").order("display_order");
  if (sp.get("all") !== "1") {
    // Profile tabs for the caller's profile OR account tabs for the caller —
    // the username comes from the verified token, never the query, so a user
    // can only ever receive their own account tabs.
    const profile = sp.get("profile");
    const username = (auth as { username?: string }).username;
    const ors: string[] = [];
    if (profile)  ors.push(`and(scope.eq.profile,profile_key.eq.${profile})`);
    if (username) ors.push(`and(scope.eq.account,owner_username.eq.${username})`);
    if (!ors.length) return ok({ tabs: [] });
    tabQ = tabQ.or(ors.join(","));
  }

  const { data: tabs, error } = await tabQ;
  if (error) return err(error.message, 500);
  if (!tabs?.length) return ok({ tabs: [] });

  const { data: widgets } = await db()
    .from("dashboard_widgets")
    .select("*")
    .in("tab_id", tabs.map((t) => t.id))
    .order("display_order");

  const byTab = new Map<number, WidgetRow[]>();
  for (const w of (widgets ?? []) as WidgetRow[]) {
    if (!byTab.has(w.tab_id)) byTab.set(w.tab_id, []);
    byTab.get(w.tab_id)!.push(w);
  }
  return ok({ tabs: tabs.map((t) => ({ ...t, widgets: byTab.get(t.id) ?? [] })) });
}

type IncomingWidget = { kind?: string; title?: string; config?: { series?: unknown } };

function validateTab(body: Record<string, unknown>): { error: string } | { tab: Record<string, unknown>; widgets: Record<string, unknown>[] } {
  const scope = body.scope === "account" ? "account" : "profile";
  const label = String(body.label ?? "").trim();
  if (!label) return { error: "Tab needs a label" };
  const profile_key = scope === "profile" ? String(body.profile_key ?? "").trim() : null;
  const owner_username = scope === "account" ? String(body.owner_username ?? "").trim() : null;
  if (scope === "profile" && !profile_key) return { error: "Choose a profile for this tab" };
  if (scope === "account" && !owner_username) return { error: "Choose an account for this tab" };

  const rawWidgets = Array.isArray(body.widgets) ? (body.widgets as IncomingWidget[]) : [];
  if (!rawWidgets.length) return { error: "Add at least one widget" };
  const widgets = rawWidgets.map((w, i) => {
    const series = Array.isArray(w.config?.series) ? (w.config!.series as string[]).filter(Boolean) : [];
    return {
      kind: ["chart", "kpi", "map"].includes(String(w.kind)) ? w.kind : "chart",
      title: String(w.title ?? "").trim() || null,
      config: { ...(w.config ?? {}), series },
      display_order: i + 1,
    };
  });
  if (widgets.some((w) => !(w.config.series as string[]).length)) return { error: "Every widget needs at least one series" };

  return {
    tab: {
      scope, profile_key, owner_username,
      label,
      slug: builderSlug(String(body.slug ?? label)),
      display_order: Number(body.display_order ?? 0),
    },
    widgets,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);
  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");
  const v = validateTab(body);
  if ("error" in v) return err(v.error);

  const { data: tab, error: te } = await db()
    .from("dashboard_tabs").insert({ ...v.tab, created_by: auth.username }).select("id").single();
  if (te || !tab) return err(te?.message ?? "Failed to create tab", 500);

  const { error: we } = await db()
    .from("dashboard_widgets").insert(v.widgets.map((w) => ({ ...w, tab_id: tab.id })));
  if (we) return err(we.message, 500);
  return ok({ success: true, id: tab.id }, 201);
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!id) return err("id required");
  const v = validateTab(body);
  if ("error" in v) return err(v.error);

  const { error: te } = await db()
    .from("dashboard_tabs").update({ ...v.tab, updated_at: new Date().toISOString() }).eq("id", id);
  if (te) return err(te.message, 500);

  // Replace widgets wholesale
  await db().from("dashboard_widgets").delete().eq("tab_id", id);
  const { error: we } = await db()
    .from("dashboard_widgets").insert(v.widgets.map((w) => ({ ...w, tab_id: id })));
  if (we) return err(we.message, 500);
  return ok({ success: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return err("id required");
  const { error } = await db().from("dashboard_tabs").delete().eq("id", id);
  if (error) return err(error.message, 500);
  return ok({ success: true });
}
