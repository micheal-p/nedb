// ── lib/access-pipeline.ts ──────────────────────────────────────────────────
// The stages an access request moves through, and the rules about what may
// follow what.
//
// A request is never in an ambiguous state: it is always at exactly one stage,
// every move is recorded with who made it, and the applicant can be told
// truthfully where their request has reached.

export type Stage =
  | "submitted"     // received, nobody has looked yet
  | "triage"        // picked up, eligibility being checked
  | "review"        // substantive review of the justification
  | "approved"      // decided yes, account not yet made
  | "provisioned"   // account created, credentials being sent
  | "active"        // in use
  | "rejected"
  | "suspended";

export const STAGES: { id: Stage; label: string; blurb: string; tone: "neutral" | "good" | "bad" }[] = [
  { id: "submitted",   label: "Submitted",    blurb: "Received and waiting to be picked up", tone: "neutral" },
  { id: "triage",      label: "Triage",       blurb: "Eligibility being checked against the organisation's remit", tone: "neutral" },
  { id: "review",      label: "Review",       blurb: "Justification under substantive review", tone: "neutral" },
  { id: "approved",    label: "Approved",     blurb: "Decided — account not yet created", tone: "good" },
  { id: "provisioned", label: "Provisioned",  blurb: "Account created, credentials issued", tone: "good" },
  { id: "active",      label: "Active",       blurb: "In use", tone: "good" },
  { id: "rejected",    label: "Not approved", blurb: "Declined, with a reason on file", tone: "bad" },
  { id: "suspended",   label: "Suspended",    blurb: "Access withdrawn", tone: "bad" },
];

/** The forward path an ordinary request walks. */
export const MAIN_PATH: Stage[] = ["submitted", "triage", "review", "approved", "provisioned", "active"];

/** Stages that may follow a given stage. */
export const NEXT: Record<Stage, Stage[]> = {
  submitted:   ["triage", "rejected"],
  triage:      ["review", "rejected"],
  review:      ["approved", "rejected"],
  approved:    ["provisioned", "rejected"],
  provisioned: ["active", "suspended"],
  active:      ["suspended"],
  rejected:    ["triage"],          // an applicant may supply more and be reconsidered
  suspended:   ["active"],          // reinstatement
};

export function canMove(from: Stage, to: Stage): boolean {
  return (NEXT[from] ?? []).includes(to);
}

export function stageMeta(id: string) {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

/** Position in the main path, or -1 for a terminal branch. */
export function stageIndex(id: string): number {
  return MAIN_PATH.indexOf(id as Stage);
}

/**
 * What the applicant should be told. Deliberately plainer than the internal
 * stage name — "triage" means nothing to a member of the public.
 */
export function publicStatus(stage: string): { label: string; note: string } {
  switch (stage) {
    case "submitted":
      return { label: "Received", note: "Your request is in the queue. Requests are reviewed within 5 working days of submission." };
    case "triage":
    case "review":
      return { label: "Under review", note: "Your request has been picked up and is being reviewed against your organisation's remit." };
    case "approved":
      return { label: "Approved", note: "Your request was approved. Your account is being created and credentials will be emailed to you." };
    case "provisioned":
      return { label: "Approved — credentials sent", note: "Your account has been created and the credentials emailed to the address you applied with. Check your spam folder if you cannot find them." };
    case "active":
      return { label: "Active", note: "Your access is active. Sign in with the credentials that were emailed to you." };
    case "rejected":
      return { label: "Not approved", note: "Your request was not approved. You may submit a new request with additional justification." };
    case "suspended":
      return { label: "Suspended", note: "Access to this account has been withdrawn. Contact the NEDB administrator if you believe this is an error." };
    default:
      return { label: stage, note: "" };
  }
}
