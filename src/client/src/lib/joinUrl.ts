export async function buildJoinUrl(code: string): Promise<string> {
  const local = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
    window.location.hostname,
  );
  if (!local) return `${window.location.origin}/r/${code}`;
  try {
    const res = await fetch("/api/lan");
    const { ip } = (await res.json()) as { ip: string | null };
    if (ip) return `http://${ip}:${window.location.port}/r/${code}`;
  } catch {
    // fall through to origin
  }
  return `${window.location.origin}/r/${code}`;
}