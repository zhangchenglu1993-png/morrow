"use client";

export function getCookie(name: string): string {
  const prefix = `${encodeURIComponent(name)}=`;
  const match = document.cookie
    .split("; ")
    .find((item) => item.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
}

export async function mutationFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-csrf-token", getCookie("morrow_csrf"));
  return fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store"
  });
}

export async function readApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? "操作失败，请稍后重试。";
  } catch {
    return "操作失败，请稍后重试。";
  }
}
