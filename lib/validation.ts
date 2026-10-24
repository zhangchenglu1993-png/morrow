export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function cleanDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 24);
}

export function cleanEmoji(value: string): string {
  const emoji = value.trim();
  return emoji.length > 0 && emoji.length <= 8 ? emoji : "🌱";
}

export function cleanBody(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
