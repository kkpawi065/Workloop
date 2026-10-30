import { createRemoteJWKSet, jwtVerify } from "jose";

// Google publishes the public keys that sign Firebase ID tokens at this address.
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export interface AuthResult {
  ok: boolean;
  /** HTTP status to answer with when ok is false. */
  status: number;
  error?: string;
  uid?: string;
  email?: string;
}

export interface AuthOptions {
  /** Firebase project ID. The token's issuer and audience must match it. */
  projectId: string;
  /** Optional allow-list of email domains, e.g. ["school.ac.th"]. Empty = any Google account. */
  allowedDomains?: string[];
  /** Override the signing keys (used by tests only). */
  keys?: any;
}

/**
 * Verifies the Firebase ID token in the Authorization header.
 * Anonymous (guest) sessions are rejected: anyone can create one, so it proves nothing.
 */
export async function authenticate(req: Request, opts: AuthOptions): Promise<AuthResult> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Sign in required" };

  try {
    const { payload } = await jwtVerify(token, opts.keys ?? FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${opts.projectId}`,
      audience: opts.projectId,
      algorithms: ["RS256"],
    });

    const uid = typeof payload.sub === "string" ? payload.sub : "";
    if (!uid) return { ok: false, status: 401, error: "Invalid session" };

    const provider = (payload as any).firebase?.sign_in_provider;
    if (!provider || provider === "anonymous") {
      return { ok: false, status: 403, error: "Google sign-in is required for this feature" };
    }

    const email = typeof (payload as any).email === "string" ? ((payload as any).email as string) : undefined;
    const domains = (opts.allowedDomains ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean);
    if (domains.length > 0) {
      const verified = (payload as any).email_verified === true;
      const domain = email ? email.split("@")[1]?.toLowerCase() : "";
      if (!verified || !domain || !domains.includes(domain)) {
        return { ok: false, status: 403, error: "This account is not allowed to use this feature" };
      }
    }

    return { ok: true, status: 200, uid, email };
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired session" };
  }
}
