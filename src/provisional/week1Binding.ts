/** Exact operator-approved provisional input scope; NOT runtime admission or run authority. */
export const WEEK1_CANDIDATE_SHA256 = 'e59ff910a70414be333a5145adb9e451d007ea0c5b07c66fd9d87182ce7844d5';
export const WEEK1_SUPPORT_COMMIT = 'e890f825bc5863d16c7afedfbd376c806cfed448';
export const WEEK1_ACCEPTANCE_REF = 'docs/receipts/teamstate-week1-provisional-acceptance-2026-09-22.md';
export const WEEK1_FIELDS = Object.freeze([
  'attempts', 'completions', 'passing_yards', 'passing_tds', 'passing_interceptions',
  'sacks_suffered', 'carries', 'rushing_yards', 'rushing_tds', 'fumbles_lost_total'
] as const);
export type Week1Field = typeof WEEK1_FIELDS[number];
export const WEEK1_GAMES: readonly string[] = Object.freeze([
  "2026_01_ARI_LAC",
  "2026_01_ATL_PIT",
  "2026_01_BAL_IND",
  "2026_01_BUF_HOU",
  "2026_01_CHI_CAR",
  "2026_01_CLE_JAX",
  "2026_01_DAL_NYG",
  "2026_01_DEN_KC",
  "2026_01_GB_MIN",
  "2026_01_MIA_LV",
  "2026_01_NE_SEA",
  "2026_01_NO_DET",
  "2026_01_NYJ_TEN",
  "2026_01_SF_LA",
  "2026_01_TB_CIN",
  "2026_01_WAS_PHI"
]);
export const WEEK1_EVIDENCE = Object.freeze(([
  {
    "path": "data/raw/weekly_boxscore/2026_w01_d1c53afbe002e3825918ff9b97c42bc709a207840fd01a4f84891aaf6f6d21ee/LICENSE.md",
    "size": 18651,
    "sha256": "2a82ac9bbc3e3ee066908381e8d373896db5a6025d083fbd59692fe9ccfb9111"
  },
  {
    "path": "data/raw/weekly_boxscore/2026_w01_d1c53afbe002e3825918ff9b97c42bc709a207840fd01a4f84891aaf6f6d21ee/player.csv",
    "size": 498905,
    "sha256": "af043a5d702df0f745da0496198cf817407415ca4857e84a6b815713fd19fd05"
  },
  {
    "path": "data/raw/weekly_boxscore/2026_w01_d1c53afbe002e3825918ff9b97c42bc709a207840fd01a4f84891aaf6f6d21ee/receipt.json",
    "size": 2060,
    "sha256": "52c81b56f8ff6a54b79078f75307a9b2f4e74b13af874c8bbc6c8cd3fe317686"
  },
  {
    "path": "data/raw/weekly_boxscore/2026_w01_d1c53afbe002e3825918ff9b97c42bc709a207840fd01a4f84891aaf6f6d21ee/team.csv",
    "size": 14802,
    "sha256": "c9a97182c95c7f0d5559d968f1563b1e1fbc7f3b6bff4fb6d48ed25352407f37"
  },
  {
    "path": "data/raw/weekly_schedule/f07422655522abbd636de46e4c0947f2c08b3d8689ba4be0b0882958e994b6d7/LICENSE.md",
    "size": 18651,
    "sha256": "2a82ac9bbc3e3ee066908381e8d373896db5a6025d083fbd59692fe9ccfb9111"
  },
  {
    "path": "data/raw/weekly_schedule/f07422655522abbd636de46e4c0947f2c08b3d8689ba4be0b0882958e994b6d7/games.csv",
    "size": 2178316,
    "sha256": "f07422655522abbd636de46e4c0947f2c08b3d8689ba4be0b0882958e994b6d7"
  },
  {
    "path": "data/raw/weekly_schedule/f07422655522abbd636de46e4c0947f2c08b3d8689ba4be0b0882958e994b6d7/receipt.json",
    "size": 1149,
    "sha256": "7ef1050ff72fb7508eda8310a5029ccced3f89644b2b36f3f8b7906cbcc7c26a"
  },
  {
    "path": "docs/audits/2026-week1-raw-refresh-2026-09-16.md",
    "size": 11891,
    "sha256": "cf70ca1ecb2e2da080ab8d3feace5849b65cc5837a93d1ae1447c156a266f376"
  },
  {
    "path": "docs/audits/weekly-boxscore-candidate-2026-09-16.md",
    "size": 11976,
    "sha256": "ac1f8bd5458bfeb7bc4374a4a02e69e82236270891006e26ec8c20b9cbaa3a1e"
  },
  {
    "path": "scripts/intake_weekly_boxscore_v0.py",
    "size": 9503,
    "sha256": "1622fd838aaf07844d5c53655778a8a91945844bff15f1b07fb0488c26292322"
  },
  {
    "path": "scripts/intake_weekly_schedule_v0.py",
    "size": 5258,
    "sha256": "8b0f48a606bfd9ad13b6f902e5d08abf6a2ba956ce3bea6276b4bf02d3bdfcbd"
  },
  {
    "path": "scripts/build_weekly_boxscore_candidate_v0.py",
    "size": 12594,
    "sha256": "e3195d836b2fcc77895ff05a8722f8fb24b50d0fdde50bf0b36730b9d8ef920d"
  },
  {
    "path": "scripts/publish_weekly_boxscore_candidate_v0.py",
    "size": 8330,
    "sha256": "dea7944cd57f38c4a2374e6072a726f4cd89cb1c685d430ecd9c061d66165d71"
  },
  {
    "path": "exports/candidates/weekly_boxscore/revisions/2026_REG_w01/e59ff910a70414be333a5145adb9e451d007ea0c5b07c66fd9d87182ce7844d5.json",
    "size": 1343499,
    "sha256": "e59ff910a70414be333a5145adb9e451d007ea0c5b07c66fd9d87182ce7844d5"
  },
  {
    "path": "exports/candidates/weekly_boxscore/revisions/2026_REG_w01/index.json",
    "size": 684,
    "sha256": "148258b21c6fe687c56a1ba03f8912bdb3724073f45705530c9adca0ab418ceb"
  },
  {
    "path": "docs/audits/weekly-boxscore-candidate-independent-review-2026-09-16.json",
    "size": 26033,
    "sha256": "b1e7cf546ca86f4339446c88972fa5fd572bf5ece26f377a957189e938369dae"
  },
  {
    "path": "docs/audits/weekly-boxscore-candidate-independent-review-2026-09-16.md",
    "size": 14807,
    "sha256": "190b59b8f8817f873ac2c469d91f08b4b1a2a2d2235b8e05a89f09c257f7d239"
  },
  {
    "path": "docs/audits/weekly-boxscore-finality-admission-readiness-2026-09-16.md",
    "size": 21097,
    "sha256": "71efef18021f2f2a42bf52e05fd5891e1ea53dfb03bc72e7953ad4999b449f43"
  }
]).map(pin => Object.freeze(pin)));
