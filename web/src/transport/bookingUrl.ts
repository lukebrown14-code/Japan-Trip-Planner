/** Stored links may come from older clients or imported data; only render web URLs. */
export function safeBookingUrl(value?: string): string | undefined {
  const url = value?.trim();
  if (!url || url.length > 500) return;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? url : undefined;
  } catch { return; }
}
