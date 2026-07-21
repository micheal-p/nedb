import type { Metadata } from "next";
import { db } from "@/lib/supabase-server";
import PublicAssessmentPage from "./assessment-client";

// Server wrapper so shared open-data links carry the assessment title in
// WhatsApp/Twitter/search previews; the page itself stays a client component.

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await db()
    .from("pena_forms")
    .select("title, description, is_public_stats, status")
    .eq("slug", slug)
    .single();

  if (!data || !data.is_public_stats || data.status === "draft")
    return { title: "Energy Needs Assessments — NEDB" };

  const description =
    data.description ??
    "Anonymised open data from a Nigeria Energy Data Bank field energy assessment.";
  return {
    title: `${data.title} — NEDB Open Data`,
    description,
    openGraph: {
      title: `${data.title} — Open Data`,
      description,
      siteName: "Nigeria Energy Data Bank",
      type: "website",
    },
    twitter: { card: "summary", title: data.title, description },
  };
}

export default function Page() {
  return <PublicAssessmentPage />;
}
