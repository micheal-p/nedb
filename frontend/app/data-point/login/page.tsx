import type { Metadata } from "next";
import HeroMap from "@/components/layout/HeroMap";
import LoginClient from "./login-client";

// Server wrapper so the sign-in page can carry the server-rendered map —
// the platform's own face — without shipping the boundary file to the client.

export const metadata: Metadata = { title: "Sign in — NEDB Data Point" };

export default function Page() {
  return <LoginClient map={<HeroMap />} />;
}
