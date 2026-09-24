export function formatClock(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return "--:--";
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}