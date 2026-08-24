import { notFound } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import BulletinView from "@/components/BulletinView";
import { db } from "@/lib/supabase-server";
import type { BulletinData } from "@/lib/bulletin-data";

// /bulletin/[no] — one frozen, published edition. Drafts are not served here
// (staff preview drafts through the admin console).

export const dynamic = "force-dynamic";

export default async function BulletinEditionPage({ params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const editionNo = Number(no);
  if (!Number.isInteger(editionNo) || editionNo < 1) notFound();

  const { data } = await db()
    .from("bulletin_editions")
    .select("edition_no, period_label, status, commentary, snapshot, data_cutoff, published_at")
    .eq("edition_no", editionNo)
    .eq("status", "published")
    .single();

  if (!data) notFound();

  return (
    <>
      <div className="no-print"><Navbar active="databank" /></div>
      <BulletinView
        data={data.snapshot as BulletinData}
        meta={{
          editionNo: data.edition_no,
          periodLabel: data.period_label,
          publishedAt: data.published_at,
          dataCutoff: data.data_cutoff,
          provisional: false,
          commentary: data.commentary as Record<string, string>,
        }}
      />
      <div className="no-print"><Footer /></div>
    </>
  );
}
