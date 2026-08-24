import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Breadcrumbs, SourceLine } from "@/components/ui/gov";
import { db } from "@/lib/supabase-server";
import { SECTOR_LABEL } from "@/lib/bulletin-shared";

export const dynamic = "force-dynamic";

async function getStory(slug: string) {
  const { data } = await db()
    .from("bulletin_stories")
    .select("slug, title, standfirst, body, sector, edition_no, author, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getStory(slug);
  if (!s) return { title: "Story not found — NEDB" };
  return {
    title: `${s.title} — NEDB`,
    description: s.standfirst ?? undefined,
    openGraph: { title: s.title, description: s.standfirst ?? undefined, type: "article" },
  };
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getStory(slug);
  if (!s) notFound();

  const published = s.published_at ? new Date(s.published_at) : null;
  const paragraphs = String(s.body ?? "").split(/\n{2,}/).filter((p) => p.trim());

  return (
    <>
      <div className="no-print"><Navbar active="databank" /></div>

      <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "2rem 0" }}>
        <div className="page-wrap" style={{ maxWidth: 760 }}>
          <div className="no-print">
            <Breadcrumbs items={[
              { label: "Data Bank", href: "/" },
              { label: "Energy Bulletin", href: "/bulletin" },
              { label: "Analysis" },
            ]} />
          </div>
          {s.sector && (
            <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.4rem" }}>
              {SECTOR_LABEL[s.sector] ?? s.sector}
            </div>
          )}
          <h1 style={{ fontSize: "1.85rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.25, marginBottom: "0.6rem" }}>{s.title}</h1>
          {s.standfirst && (
            <p style={{ fontSize: "1rem", color: "var(--ink-3)", lineHeight: 1.7, marginBottom: "0.75rem" }}>{s.standfirst}</p>
          )}
          <div style={{ fontSize: "0.76rem", color: "var(--ink-4)" }}>
            {s.author ? `${s.author} · ` : ""}
            {published ? published.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : ""}
            {s.edition_no ? <> · <Link href={`/bulletin/${s.edition_no}`} style={{ color: "var(--green)", fontWeight: 600 }}>Bulletin No. {s.edition_no}</Link></> : null}
          </div>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "2.5rem 0 4rem" }}>
        <article className="page-wrap" style={{ maxWidth: 680 }}>
          {paragraphs.map((p, i) => (
            <p key={i} style={{ fontSize: "1rem", color: "var(--ink-2)", lineHeight: 1.85, marginBottom: "1.25rem" }}>{p}</p>
          ))}

          <div style={{ borderTop: "1px solid var(--border)", marginTop: "2rem", paddingTop: "1rem" }}>
            <SourceLine bare>
              Analysis published by the National Energy Data Bank, Energy Commission of Nigeria. Figures referenced are drawn
              from published NEDB series and are subject to revision; see the{" "}
              <Link href="/revisions" style={{ color: "var(--green)", fontWeight: 600 }}>Data Revision Log</Link>.
            </SourceLine>
          </div>

          <div className="no-print" style={{ marginTop: "1.75rem" }}>
            <Link href="/bulletin" className="btn btn-secondary">← All bulletins and analysis</Link>
          </div>
        </article>
      </main>

      <div className="no-print"><Footer /></div>
    </>
  );
}
