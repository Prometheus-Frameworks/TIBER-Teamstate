/** Unchanged ten-field allowlist from TTS week1Binding.ts at 4a60223. */
export const RELEASE_FIELDS = Object.freeze(["attempts", "completions", "passing_yards", "passing_tds", "passing_interceptions", "sacks_suffered", "carries", "rushing_yards", "rushing_tds", "fumbles_lost_total"] as const);
export type ReleaseField = typeof RELEASE_FIELDS[number];
export interface ReleaseScope { season: 2026; week: number; games: readonly string[]; }
