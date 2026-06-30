import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const ACCESS_TTL  = 15 * 60;           // 15 min
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

function accessSecret()  { return new TextEncoder().encode(process.env.JWT_SECRET!); }
function refreshSecret() { return new TextEncoder().encode(process.env.JWT_REFRESH_SECRET!); }

export interface AuthClaims extends JWTPayload {
  username:          string;
  full_name:         string;
  role:              string;
  dashboard_profile: string;
}

export async function signTokenPair(username: string, fullName: string, role: string, dashboardProfile = "executive") {
  const payload = { username, full_name: fullName, role, dashboard_profile: dashboardProfile, sub: username };
  const expiresAt = new Date(Date.now() + ACCESS_TTL * 1000);

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(accessSecret());

  const refresh_token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL}s`)
    .sign(refreshSecret());

  return { token, refresh_token, expires_at: expiresAt.toISOString(), full_name: fullName, role };
}

export async function verifyAccess(token: string): Promise<AuthClaims> {
  const { payload } = await jwtVerify(token, accessSecret());
  return payload as AuthClaims;
}

export async function verifyRefresh(token: string): Promise<AuthClaims> {
  const { payload } = await jwtVerify(token, refreshSecret());
  return payload as AuthClaims;
}
