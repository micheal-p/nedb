import AdminShell from "@/components/admin/AdminShell";

// Every /admin page renders inside the SAP-style console shell (persistent
// grouped left-nav + top bar + one auth guard). Pages provide only their
// content — no more per-page navigation button rows.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
