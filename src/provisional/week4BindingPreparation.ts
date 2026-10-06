/** Closed Week 4 shape constraints. No source admission or real-input run grant. */
import { WEEK1_FIELDS } from './week1Binding.js';
export const WEEK4_FIELDS = WEEK1_FIELDS;
export type Week4Field = typeof WEEK4_FIELDS[number];
export const WEEK4_GAMES: readonly string[] = Object.freeze([
  "2026_04_ARI_NYG",
  "2026_04_ATL_NO",
  "2026_04_DAL_HOU",
  "2026_04_DEN_SF",
  "2026_04_DET_CAR",
  "2026_04_GB_TB",
  "2026_04_IND_WAS",
  "2026_04_JAX_CIN",
  "2026_04_KC_LV",
  "2026_04_LAC_SEA",
  "2026_04_LA_PHI",
  "2026_04_MIA_MIN",
  "2026_04_NE_BUF",
  "2026_04_NYJ_CHI",
  "2026_04_PIT_CLE",
  "2026_04_TEN_BAL"
]);
export const WEEK4_PREPARATION = Object.freeze({ status: 'interface_preparation_only', realInputEnabled: false, purposeAccepted: false });
