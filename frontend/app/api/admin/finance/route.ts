import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";
import { hasScope } from "@/lib/admin-scopes";

// GET /api/admin/finance — the money in one view: vintage orders and priced
// data requests, with totals by state. Scoped to accounting, business and
// software administrations.

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return err("admin required", 403);
  if (!hasScope(claims.role as string, (claims as { admin_scope?: string | null }).admin_scope, "accounting", "business"))
    return err("The finance console is scoped: accounting, business and software administrations hold it.", 403);

  const [{ data: orders }, { data: requests }] = await Promise.all([
    db().from("vintage_orders")
      .select("reference, email, buyer_name, organisation, amount_ngn, status, created_at, paid_at, data_vintages(label, title)")
      .order("created_at", { ascending: false }).limit(300),
    db().from("data_requests")
      .select("id, full_name, organization, email, price_ngn, quote_note, status, created_at, paid_at")
      .not("price_ngn", "is", null)
      .order("created_at", { ascending: false }).limit(300),
  ]);

  const o = (orders ?? []).map((x) => ({ ...x, vintage: (x.data_vintages as unknown as { label: string } | null)?.label ?? null, data_vintages: undefined }));
  const r = requests ?? [];
  const paidOrders = o.filter((x) => x.status === "paid");
  const paidRequests = r.filter((x) => x.status === "paid" || x.status === "fulfilled");

  return ok({
    totals: {
      collected_ngn: paidOrders.reduce((s, x) => s + Number(x.amount_ngn ?? 0), 0)
        + paidRequests.reduce((s, x) => s + Number(x.price_ngn ?? 0), 0),
      outstanding_ngn: o.filter((x) => ["pending", "invoice_requested"].includes(x.status)).reduce((s, x) => s + Number(x.amount_ngn ?? 0), 0)
        + r.filter((x) => x.status === "quoted").reduce((s, x) => s + Number(x.price_ngn ?? 0), 0),
      waived_ngn: r.filter((x) => Number(x.price_ngn) === 0).length,
    },
    vintage_orders: o,
    data_requests: r,
    note: "Collected counts server-verified payments only. Until the Paystack key is configured everything shows as outstanding, which is the truth.",
  });
}
