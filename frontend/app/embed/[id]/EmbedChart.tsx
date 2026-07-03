"use client";

import dynamic from "next/dynamic";
import type { EnergyRecord } from "@/lib/api";

const LineChart = dynamic(() => import("@/components/charts/LineChart"), { ssr: false });

export default function EmbedChart({ data, unit }: { data: EnergyRecord[]; unit: string }) {
  return <LineChart data={data} unit={unit} />;
}
