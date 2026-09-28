import type { D1Database } from "@cloudflare/workers-types";
export type Env = {
  DB: D1Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
  GOOGLE_CLIENT_ID?: string;
};
export type Player = {
  id: string;
  username: string | null;
  display_name: string;
  bio: string;
  created_at: number;
};
