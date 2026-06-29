const BASE = "";

export interface SeriesType {
  id: string;
  name: string;
  sector: string;
  subsector?: string;
  unit_default: string;
  frequency: string;
  viz_types: string[];
  record_count: number;
  created_at: string;
}

export interface EnergyRecord {
  id: number;
  series_type_id: string;
  period: string;
  period_date: string;
  region: string;
  fuel_product?: string;
  value: number | null;
  unit: string;
  source?: string;
  notes?: string;
  methodology_version: string;
}

export interface DataPage {
  rows: EnergyRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface AutoStats {
  series_type_id: string;
  latest: number | null;
  latest_period: string;
  yoy_pct: number | null;
  mom_pct: number | null;
  cagr: number | null;
  rolling_3: number | null;
  rolling_12: number | null;
  unit: string;
}

export interface ValidationError {
  row_number: number;
  column_name: string;
  error_type: string;
  error_message: string;
  raw_value?: string;
}

export interface ValidateResponse {
  session_id: number;
  total_rows: number;
  valid_rows: number;
  errors: ValidationError[];
  status: string;
}

export interface TokenPair {
  token: string;
  refresh_token: string;
  expires_at: string;
  full_name: string;
  role: string;
}

export interface StaffUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  agency: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  last_login: string | null;
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  listSeries: () => request<SeriesType[]>("/api/series"),

  getSeries: (id: string) => request<SeriesType>(`/api/series/${id}`),

  getSeriesData: (id: string, params?: { region?: string; period_from?: string; period_to?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.region) q.set("region", params.region);
    if (params?.period_from) q.set("period_from", params.period_from);
    if (params?.period_to) q.set("period_to", params.period_to);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    return request<DataPage>(`/api/series/${id}/data?${q}`);
  },

  getStats: (id: string) => request<AutoStats>(`/api/series/${id}/stats`),

  templateUrl: (id: string) => `${BASE}/api/templates/${id}`,

  login: (username: string, password: string) =>
    request<TokenPair>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  refresh: (refresh_token: string) =>
    request<TokenPair>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),

  validateUpload: (formData: FormData, token: string) =>
    fetch(`${BASE}/api/upload/validate`, {
      method: "POST",
      headers: authHeaders(token),
      body: formData,
    }).then(async (res) => {
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json as ValidateResponse;
    }),

  commitUpload: (sessionId: number, token: string) =>
    request<{ committed_rows: number; series_type_id: string }>(`/api/upload/commit/${sessionId}`, {
      method: "POST",
      headers: authHeaders(token),
    }),

  // Admin — user management
  listStaff: (token: string) =>
    request<StaffUser[]>("/api/admin/users", { headers: authHeaders(token) }),

  createStaff: (data: { username: string; full_name: string; email: string; role: string; agency: string; password: string }, token: string) =>
    request<{ id: number; username: string }>("/api/admin/users", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  toggleStaff: (id: number, token: string) =>
    request<{ id: number; is_active: boolean }>(`/api/admin/users/${id}/toggle`, {
      method: "PUT",
      headers: authHeaders(token),
    }),

  resetPassword: (id: number, password: string, token: string) =>
    request<{ reset: boolean }>(`/api/admin/users/${id}/password`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify({ password }),
    }),

  health: () => request<{ status: string; db: string; cache: string }>("/api/health"),
};
