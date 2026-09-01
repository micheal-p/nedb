// Data-request reference parsing, shared by the track and pay routes.
// (Route files may export only handlers, so this lives here.)
export function parseRef(ref: string): number | null {
  const m = ref.trim().toUpperCase().match(/^NEDB[/-]DR[/-](\d{4})[/-](\d{1,7})$/);
  return m ? Number(m[2]) : null;
}
