import type { Metadata } from "next";
import { db } from "@/lib/supabase-server";
import PenaPublicForm from "./form-client";

// Server wrapper so shared links carry the assessment title — WhatsApp,
// Twitter and search previews read this metadata; the form itself stays a
// client component in form-client.tsx.

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const { data } = await db()
    .from("pena_forms")
    .select("title, description")
    .eq("share_token", token)
    .single();

  if (!data) return { title: "Energy Assessment — NEDB" };

  const description =
    data.description ??
    "Take part in a Nigeria Energy Data Bank energy needs assessment — your response shapes national energy planning.";
  return {
    title: `${data.title} — NEDB`,
    description,
    openGraph: {
      title: data.title,
      description,
      siteName: "Nigeria Energy Data Bank",
      type: "website",
    },
    twitter: { card: "summary", title: data.title, description },
  };
}

export default function Page() {
  return <PenaPublicForm />;
}
