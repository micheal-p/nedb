import type { Metadata } from "next";
import { db } from "@/lib/supabase-server";
import PaperClient from "./paper-client";

// Server wrapper: a shared working-paper link must carry its title, number
// and abstract into WhatsApp/Twitter/search previews. The page body stays a
// client component.

function toPaperNo(seg: string): string | null {
  const m = seg.match(/^(\d{4})-(\d{2,})$/);
  return m ? `NEDB/WP/${m[1]}/${m[2]}` : null;
}

export async function generateMetadata({ params }: { params: Promise<{ no: string }> }): Promise<Metadata> {
  const { no } = await params;
  const paperNo = toPaperNo(no);
  if (!paperNo) return { title: "Working Papers — NEDB" };

  const { data } = await db()
    .from("working_papers")
    .select("paper_no, title, authors, status, body")
    .eq("paper_no", paperNo)
    .single();
  if (!data || data.status !== "published") return { title: "Working Papers — NEDB" };

  const summary = (data.body as { summary?: string } | null)?.summary ?? "A working paper of the Nigeria Energy Data Bank.";
  const description = summary.length > 200 ? summary.slice(0, 197) + "…" : summary;
  return {
    title: `${data.title} — ${data.paper_no}`,
    description,
    openGraph: {
      title: data.title,
      description,
      siteName: "Nigeria Energy Data Bank",
      type: "article",
    },
    twitter: { card: "summary_large_image", title: data.title, description },
  };
}

export default function Page() {
  return <PaperClient />;
}
