"use client";

// Thin client-only wrapper around react-force-graph-2d. next/dynamic does not
// forward refs, so NetworkGraph passes its instance ref through the ordinary
// `fgRef` prop instead — this wrapper attaches it to the real component.

import ForceGraph2D from "react-force-graph-2d";
import type { MutableRefObject } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any> & { fgRef?: MutableRefObject<any> };

export default function FG2DWrapper({ fgRef, ...props }: Props) {
  return <ForceGraph2D ref={fgRef} {...props} />;
}
