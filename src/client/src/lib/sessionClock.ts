export function formatElapsed(
  startedAtMs: number | null,
  nowMs: number,
): string {
  if (startedAtMs === null) return "0:00";
  const totalSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  const sec = totalSec % 60;
  const min = Math.floor((totalSec / 60) % 60);
  const hr = Math.floor(totalSec / 3600);
  if (hr > 0) {
    return `${hr}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${min}:${String(sec).padStart(2, "0")}`;
}