import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env, Player } from "./types";
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
export const cookie = (request: Request, name: string) =>
  request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + "="))
    ?.slice(name.length + 1);
export const setCookie = (name: string, value: string, seconds: number) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
export const token = () => crypto.randomUUID() + crypto.randomUUID();
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function currentPlayer(
  request: Request,
  env: Env,
): Promise<Player | null> {
  const raw = cookie(request, "__Host-mindfkd");
  if (!raw) return null;
  return env.DB.prepare(
    "SELECT p.id,p.username,p.display_name,p.bio,p.created_at FROM sessions s JOIN players p ON p.id=s.player_id WHERE s.token_hash=? AND s.expires_at>?",
  )
    .bind(await hash(raw), Date.now())
    .first<Player>();
}
export async function verifyGoogle(
  credential: string,
  clientId: string,
  nonce: string,
) {
  const { payload } = await jwtVerify(credential, keys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    algorithms: ["RS256"],
    maxTokenAge: "10m",
  });
  if (
    !payload.sub ||
    payload.nonce !== nonce ||
    payload.email_verified !== true
  )
    throw new Error("Invalid identity");
  return payload.sub;
}
