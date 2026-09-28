export type Player = {
  username: string | null;
  displayName: string;
  bio: string;
  createdAt: number;
};
export async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      data === undefined
        ? {}
        : { "Content-Type": "application/json", "X-Mindfkd-Request": "1" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let value;
  try {
    value = await response.json();
  } catch {
    throw new Error("Online services are unavailable. Guest play still works.");
  }
  if (!response.ok) throw new Error(value.error ?? "Please try again");
  return value as T;
}
export const profileUrl = (username: string, run?: string) =>
  `https://mindfkd.com/profile?u=${encodeURIComponent(username)}${run ? `&run=${encodeURIComponent(run)}` : ""}`;
