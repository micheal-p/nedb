"use client";

const COOKIE_TOKEN = "nedb_token";
const LS_REFRESH   = "nedb_refresh";

function setCookie(name: string, value: string, maxAgeSec: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSec}; SameSite=Strict`;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

export function saveTokens(token: string, refreshToken: string, fullName?: string, role?: string) {
  setCookie(COOKIE_TOKEN, token, 15 * 60);
  try {
    localStorage.setItem(LS_REFRESH, refreshToken);
    if (fullName) localStorage.setItem("nedb_name", fullName);
    if (role) localStorage.setItem("nedb_role", role);
  } catch {}
}

export function getFullName(): string {
  try { return localStorage.getItem("nedb_name") ?? ""; } catch { return ""; }
}

export function getRole(): string {
  try { return localStorage.getItem("nedb_role") ?? ""; } catch { return ""; }
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
  try { localStorage.removeItem(LS_REFRESH); } catch {}
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
