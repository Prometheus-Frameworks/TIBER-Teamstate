/** Week 3 shape constraints only. NOT an authenticated source binding or run grant. */
import { WEEK1_FIELDS } from './week1Binding.js';

// Reuse the accepted ten-field order; no additional metrics or football rules.
export const WEEK3_FIELDS = WEEK1_FIELDS;
export type Week3Field = typeof WEEK3_FIELDS[number];
export const WEEK3_GAMES: readonly string[] = Object.freeze([
  '2026_03_ARI_SF',
  '2026_03_ATL_GB',
  '2026_03_BAL_DAL',
  '2026_03_CAR_CLE',
  '2026_03_CIN_PIT',
  '2026_03_HOU_IND',
  '2026_03_KC_MIA',
  '2026_03_LAC_BUF',
  '2026_03_LA_DEN',
  '2026_03_LV_NO',
  '2026_03_MIN_TB',
  '2026_03_NE_JAX',
  '2026_03_NYJ_DET',
  '2026_03_PHI_CHI',
  '2026_03_SEA_WAS',
  '2026_03_TEN_NYG',
]);

// Documented source locator, not a claim that bytes or reviews were authenticated here.
export const WEEK3_PREPARATION = Object.freeze({
  status: 'preparation_only_missing_witnesses' as const,
  candidateSha256: 'f3366ac1c2192641c6e94ba7c756ed2e12ba73b37550619ae143deaeab9f9902',
  dataHead: 'eac3b9bc22cf1fa230b233a09f5e031a2a9b409a',
  supportCommit: '2b58e2c22ccd2430041afcfbd143b057830878f0',
  candidateGeneratedAt: null,
  qualifiedInputReview: null,
  realInputEnabled: false,
});
