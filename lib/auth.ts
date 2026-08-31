export type Role = "agent" | "lead";

function secret() {
  return process.env.SESSION_SECRET || "dev-only-insecure-secret";
}

// Uses the Web Crypto API (available in both the Edge middleware runtime and
// the Node runtime) instead of Node's 'crypto' module, which the Edge
// runtime that middleware.ts runs in does not support.
async function hmacHex(message: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Cookie value is role + a signature, so it can't be forged without knowing SESSION_SECRET.
export async function signSession(role: Role): Promise<string> {
  const sig = await hmacHex(role, secret());
  return `${role}.${sig}`;
}

export async function verifySession(cookieValue: string | undefined): Promise<Role | null> {
  if (!cookieValue) return null;
  const [role, sig] = cookieValue.split(".");
  if (role !== "agent" && role !== "lead") return null;
  const expected = await hmacHex(role, secret());
  if (!sig || sig.length !== expected.length) return null;
  // Constant-time-ish comparison without Node's Buffer/timingSafeEqual, fine
  // for this low-stakes internal passcode gate.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? (role as Role) : null;
}

export function checkPasscode(passcode: string): Role | null {
  if (process.env.LEAD_PASSCODE && passcode === process.env.LEAD_PASSCODE) return "lead";
  if (process.env.AGENT_PASSCODE && passcode === process.env.AGENT_PASSCODE) return "agent";
  return null;
}
