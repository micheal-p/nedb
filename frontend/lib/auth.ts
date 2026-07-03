"use client";

const COOKIE_TOKEN = "nedb_token";
const LS_REFRESH   = "nedb_refresh";

function setCookie(name: string, value: string, maxAgeSec: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSec}; SameSite=Strict`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

export function saveTokens(token: string, refreshToken: string, fullName?: string, role?: string, dashboardProfile?: string) {
  setCookie(COOKIE_TOKEN, token, 15 * 60);
  // Store refresh token server-side as httpOnly cookie — never readable by JS
  if (refreshToken) {
    fetch("/api/auth/set-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => {});
  }
  // Only non-sensitive display metadata stays in localStorage
  try {
    if (fullName)          localStorage.setItem("nedb_name", fullName);
    if (role)              localStorage.setItem("nedb_role", role);
    if (dashboardProfile)  localStorage.setItem("nedb_profile", dashboardProfile);
  } catch {}
}

export function getFullName(): string {
  try { return localStorage.getItem("nedb_name") ?? ""; } catch { return ""; }
}

export function getRole(): string {
  try { return localStorage.getItem("nedb_role") ?? ""; } catch { return ""; }
}

export function getDashboardProfile(): string {
  try { return localStorage.getItem("nedb_profile") ?? "executive"; } catch { return "executive"; }
}

export function getToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_TOKEN}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getRefreshToken(): string | null {
  try { return localStorage.getItem(LS_REFRESH); } catch { return null; }
}

export function clearTokens() {
  deleteCookie(COOKIE_TOKEN);
  // Clear httpOnly refresh cookie via server
  fetch("/api/auth/set-refresh", { method: "DELETE" }).catch(() => {});
  try {
    localStorage.removeItem("nedb_name");
    localStorage.removeItem("nedb_role");
    localStorage.removeItem("nedb_profile");
  } catch {}
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export async function tryRefresh(): Promise<boolean> {
  try {
    // No body needed — server reads from httpOnly cookie nedb_rt
    const res = await fetch("/api/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" } });
    if (!res.ok) return false;
    const data = await res.json();
    saveTokens(data.token, data.refresh_token ?? "", data.full_name, data.role, data.dashboard_profile);
    return true;
  } catch {
    return false;
  }
}

export async function getTokenFresh(): Promise<string | null> {
  const t = getToken();
  if (t) return t;
  const refreshed = await tryRefresh();
  if (!refreshed) return null;
  return getToken();
}
