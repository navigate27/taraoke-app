export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[|•·:;,'"!?.\-–—_]/g, " ")
    .replace(
      /\b(karaoke|videoke|lyrics|lyric|official|music|video|audio|version|ver|hd|hq|4k|mv|instrumental|cover|minus|one)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}