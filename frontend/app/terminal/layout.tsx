import TerminalShell from "@/components/terminal/TerminalShell";

// Every /terminal route renders inside the terminal workspace — its own shell,
// its own navigation, its own density. It deliberately does not inherit the
// public site chrome or the admin console.
export const metadata = {
  title: "Data Terminal — NEDB",
};

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return <TerminalShell>{children}</TerminalShell>;
}
