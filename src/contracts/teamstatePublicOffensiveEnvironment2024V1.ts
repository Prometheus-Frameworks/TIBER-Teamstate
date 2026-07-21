/**
 * Machine-readable encoding of the finalized `teamstate_public_offensive_environment_2024_v1`
 * report contract (`docs/contracts/teamstate-public-offensive-environment-2024-v1.md`, merged at
 * 696bda066fa2a2a225372fa1b6d08567ff624d3f).
 *
 * This module encodes the already-finalized contract exactly — declared scope (§1), field
 * dispositions (§2), payload shape (§5), identity semantics (§6), temporal constants (§7),
 * publication invariants (§8), and the stable validator rejection codes (§9). It defines no new
 * methodology and makes no publication decision: publication remains disabled
 * (`artifact_publication_enabled: false`, empty `public_reports`) until a separate, explicit
 * operator approval for an exact `report_version_id`.
 */

export const TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_ARTIFACT =
  'teamstate_public_offensive_environment_2024_v1' as const;

export const TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_SCHEMA_VERSION = '1.0.0' as const;

/** §4/§5 canonical aliases. The registry (§6) uses the HTML alias as the family identity. */
export const PUBLIC_REPORT_2024_CANONICAL_URL_HTML = '/nfl/2024/offensive-environments' as const;
export const PUBLIC_REPORT_2024_CANONICAL_URL_JSON = '/nfl/2024/offensive-environments.json' as const;

/** §6 immutable versioned identity URLs for a given `report_version_id`. */
export const buildPublicReport2024VersionUrlHtml = (reportVersionId: string): string =>
  `${PUBLIC_REPORT_2024_CANONICAL_URL_HTML}/${reportVersionId}`;
export const buildPublicReport2024VersionUrlJson = (reportVersionId: string): string =>
  `${PUBLIC_REPORT_2024_CANONICAL_URL_HTML}/${reportVersionId}.json`;

/** §6 `report_version_id` pattern: `{methodology_version}.r{n}`. */
export const buildPublicReport2024VersionId = (revision: number): string => {
  if (!Number.isInteger(revision) || revision < 1) {
    throw new Error(`report_version_id revision must be a positive integer, received ${revision}.`);
  }
  return `${TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_ARTIFACT}.r${revision}`;
};

/** §1 declared scope (verbatim contract constants). */
export const PUBLIC_REPORT_2024_EXPECTED_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND',
  'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA',
  'SF', 'TB', 'TEN', 'WAS'
] as const;

export const PUBLIC_REPORT_2024_DECLARED_SCOPE = {
  season: 2024,
  phase: 'regular_season',
  expected_team_count: 32,
  expected_team_game_rows: 544,
  expected_games_per_team: 17,
  output_meaning: 'historical_observed_comparison',
  /**
   * §1/§7: pinned contract constant (real-world final date of the 2024 NFL regular season, Week
   * 18) — never derived from adapter rows, which carry no game-date field.
   */
  data_through: '2025-01-05',
  data_through_source: 'pinned_contract_constant_public_nfl_schedule_not_adapter_derived'
} as const;

/**
 * §5/§8-invariant-3 governed-input pin. `checksum.value` is the pinned sha256 of the committed
 * governed source bytes (same known-good value `scripts/export_forecast_run2_full.mjs` pins);
 * generation must recompute it locally from the committed file and fail closed on drift.
 */
export const PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN = {
  artifact_id: 'team_week_raw_v0_2024_real_source_candidate',
  repository: 'TIBER-Teamstate',
  path: 'data/governed/team_week_raw_v0_2024_real_source_candidate.json',
  checksum: {
    algorithm: 'sha256',
    value: '2aed00e68c1620af10d2ea4350104f7e183ff6ee050f5d385a503ef027281de9'
  },
  checksum_verification: 'recomputed_locally_at_generation_time_against_committed_repo_file'
} as const;

/**
 * §5: upstream-source checksums are recorded from the governed artifact's own metadata — never
 * re-fetched or re-verified over the network.
 */
export const PUBLIC_REPORT_2024_UPSTREAM_CHECKSUM_VERIFICATION =
  'recorded_from_governed_artifact_metadata_no_network_refetch' as const;

/** §5 repository-qualified TIBER-Data references (resolve in TIBER-Data, not here). */
export const PUBLIC_REPORT_2024_VALIDATION_REPORT_REF = {
  repository: 'TIBER-Data',
  path: 'exports/candidates/team_week_raw/team_week_raw_v0_2024_real_source_candidate.validation.json'
} as const;
export const PUBLIC_REPORT_2024_LINEAGE_MANIFEST_REF = {
  repository: 'TIBER-Data',
  path: 'data/manifests/team_week_raw_v0_2024_real_source_candidate.manifest.json'
} as const;

/** §2/§5 `excluded_lanes` — exact fields, reasons, and order from the contract. */
export const PUBLIC_REPORT_2024_EXCLUDED_LANES = [
  { field: 'pointsAgainst', reason: 'out_of_declared_scope_defensive_facing' },
  { field: 'pressureRateAllowed', reason: 'withheld_upstream_deferred' },
  { field: 'passRate', reason: 'blocked_pending_upstream_denominator' },
  { field: 'rushRate', reason: 'blocked_pending_upstream_denominator' },
  { field: 'successRate', reason: 'blocked_pending_upstream_denominator' },
  { field: 'explosivePlayRate', reason: 'blocked_pending_upstream_denominator' },
  { field: 'passEpaPerPlay', reason: 'blocked_pending_upstream_denominator' },
  { field: 'rushEpaPerPlay', reason: 'blocked_pending_upstream_denominator' },
  { field: 'fantasyPointsForQB', reason: 'withheld_absent' },
  { field: 'fantasyPointsForRB', reason: 'withheld_absent' },
  { field: 'fantasyPointsForWR', reason: 'withheld_absent' },
  { field: 'fantasyPointsForTE', reason: 'withheld_absent' },
  { field: 'fantasyPointsAllowedQB', reason: 'withheld_absent' },
  { field: 'fantasyPointsAllowedRB', reason: 'withheld_absent' },
  { field: 'fantasyPointsAllowedWR', reason: 'withheld_absent' },
  { field: 'fantasyPointsAllowedTE', reason: 'withheld_absent' }
] as const;

/**
 * §8 invariant 6 / §9 withheld-and-blocked field list: never present in any team record, never
 * null-as-placeholder, never zero-filled.
 */
export const PUBLIC_REPORT_2024_FORBIDDEN_TEAM_FIELDS = [
  'pointsAgainst',
  'pressureRateAllowed',
  'passRate',
  'rushRate',
  'successRate',
  'explosivePlayRate',
  'passEpaPerPlay',
  'rushEpaPerPlay',
  'fantasyPointsForQB',
  'fantasyPointsForRB',
  'fantasyPointsForWR',
  'fantasyPointsForTE',
  'fantasyPointsAllowedQB',
  'fantasyPointsAllowedRB',
  'fantasyPointsAllowedWR',
  'fantasyPointsAllowedTE'
] as const;

/** §2 blocked-pending-upstream-denominator fields (E_APPROXIMATED_DENOMINATOR_UNAUTHORIZED). */
export const PUBLIC_REPORT_2024_BLOCKED_DENOMINATOR_FIELDS = [
  'passRate',
  'rushRate',
  'successRate',
  'explosivePlayRate',
  'passEpaPerPlay',
  'rushEpaPerPlay'
] as const;

/** §3/§5 `teams[].observed` fields, in exact payload order. */
export const PUBLIC_REPORT_2024_OBSERVED_FIELDS = [
  'pointsForTotal',
  'offensivePlaysTotal',
  'neutralPlaysTotal',
  'drivesTotal',
  'redZoneTripsTotal',
  'sacksAllowedTotal',
  'turnoversTotal'
] as const;

/** §3/§5 `teams[].derived` fields, in exact payload order. */
export const PUBLIC_REPORT_2024_DERIVED_FIELDS = [
  'pointsForPerGame',
  'offensivePlaysPerGame',
  'neutralPlaysPerGame',
  'drivesPerGame',
  'redZoneTripsPerGame',
  'sacksAllowedPerGame',
  'turnoversPerGame',
  'secondsPerPlay',
  'epaPerPlay',
  'neutralPassRate',
  'pointsPerDrive',
  'redZoneTdRate'
] as const;

/** §3 published-value precision (decimal places; round-half-away-from-zero, applied exactly once). */
export const PUBLIC_REPORT_2024_DERIVED_PRECISION = {
  pointsForPerGame: 1,
  offensivePlaysPerGame: 1,
  neutralPlaysPerGame: 1,
  drivesPerGame: 1,
  redZoneTripsPerGame: 1,
  sacksAllowedPerGame: 1,
  turnoversPerGame: 1,
  secondsPerPlay: 2,
  epaPerPlay: 4,
  neutralPassRate: 4,
  pointsPerDrive: 2,
  redZoneTdRate: 4
} as const satisfies Record<(typeof PUBLIC_REPORT_2024_DERIVED_FIELDS)[number], number>;

/** §3 zero-denominator warning codes. */
export const PUBLIC_REPORT_2024_WARNING_CODES = {
  zeroDenominatorNeutralPlays: 'W_ZERO_DENOMINATOR_NEUTRAL_PLAYS',
  zeroDenominatorDrives: 'W_ZERO_DENOMINATOR_DRIVES',
  zeroRedZoneOpportunities: 'W_ZERO_REDZONE_OPPORTUNITIES'
} as const;

/** §9 stable validator rejection codes. */
export const PUBLIC_REPORT_2024_REJECTION_CODES = [
  'E_PROVENANCE_MISSING',
  'E_PROVENANCE_NOT_GOVERNED',
  'E_COVERAGE_TEAM_MISSING',
  'E_COVERAGE_TEAM_UNEXPECTED',
  'E_COVERAGE_ROW_COUNT_MISMATCH',
  'E_GOVERNED_INPUT_CHECKSUM_MISMATCH',
  'E_UPSTREAM_SOURCE_CHECKSUM_MISSING',
  'E_METHODOLOGY_VERSION_UNKNOWN',
  'E_UNDOCUMENTED_FIELD_PRESENT',
  'E_WITHHELD_FIELD_PRESENT',
  'E_WITHHELD_FIELD_ZERO_FILLED',
  'E_REDZONE_NULL_INVARIANT_VIOLATED',
  'E_UNWEIGHTED_AGGREGATION_USED',
  'E_APPROXIMATED_DENOMINATOR_UNAUTHORIZED',
  'E_TEMPORAL_METADATA_MISSING',
  'E_TEMPORAL_METADATA_CONFLATED',
  'E_VERSION_IDENTITY_MISSING',
  'E_VERSION_IDENTITY_MUTABLE',
  'E_HTML_JSON_SEMANTIC_MISMATCH',
  'E_REGISTRY_STATE_INVALID',
  'E_PUBLICATION_NOT_APPROVED'
] as const;

export type PublicReport2024RejectionCode = (typeof PUBLIC_REPORT_2024_REJECTION_CODES)[number];

/** §8 invariant 4: recognized, approved methodology versions. */
export const PUBLIC_REPORT_2024_APPROVED_METHODOLOGY_VERSIONS = [
  TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_ARTIFACT
] as const;

// ---------------------------------------------------------------------------------------------
// §5 frozen payload types (exact shape — no undocumented fields, no supersession status).
// ---------------------------------------------------------------------------------------------

export interface PublicReport2024Checksum {
  algorithm: string;
  value: string;
}

export interface PublicReport2024DeclaredScope {
  season: number;
  phase: string;
  expected_team_count: number;
  expected_team_game_rows: number;
  expected_games_per_team: number;
  output_meaning: string;
  data_through: string;
  data_through_source: string;
}

export interface PublicReport2024Coverage {
  team_count: number;
  expected_team_count: number;
  team_game_row_count: number;
  expected_team_game_rows: number;
  missing_teams: string[];
  unexpected_teams: string[];
  is_full_league: boolean;
  satisfies_declared_scope: boolean;
}

export interface PublicReport2024GovernedInput {
  artifact_id: string;
  repository: string;
  path: string;
  checksum: PublicReport2024Checksum;
  checksum_verification: string;
}

export interface PublicReport2024UpstreamSource {
  source_ref: string;
  source_snapshot_at: string;
  checksum: PublicReport2024Checksum | null;
  checksum_verification: string;
}

export interface PublicReport2024RepositoryRef {
  repository: string;
  path: string;
}

export interface PublicReport2024ExcludedLane {
  field: string;
  reason: string;
}

/** A per-team zero-denominator warning surfaced at the payload level (§3, §4). */
export interface PublicReport2024Warning {
  team: string;
  code: string;
}

export interface PublicReport2024TeamObserved {
  pointsForTotal: number;
  offensivePlaysTotal: number;
  neutralPlaysTotal: number;
  drivesTotal: number;
  redZoneTripsTotal: number;
  sacksAllowedTotal: number;
  turnoversTotal: number;
}

export interface PublicReport2024TeamDerived {
  pointsForPerGame: number;
  offensivePlaysPerGame: number;
  neutralPlaysPerGame: number;
  drivesPerGame: number;
  redZoneTripsPerGame: number;
  sacksAllowedPerGame: number;
  turnoversPerGame: number;
  secondsPerPlay: number;
  epaPerPlay: number;
  neutralPassRate: number | null;
  pointsPerDrive: number | null;
  redZoneTdRate: number | null;
}

export interface PublicReport2024TeamRecord {
  team: string;
  gamesPlayed: number;
  observed: PublicReport2024TeamObserved;
  derived: PublicReport2024TeamDerived;
  warnings: string[];
}

export interface PublicReport2024Payload {
  artifact: string;
  schema_version: string;
  report_version_id: string;
  canonical_url: string;
  version_url: string;
  declared_scope: PublicReport2024DeclaredScope;
  coverage: PublicReport2024Coverage;
  source_snapshot_at: string;
  generated_at: string;
  provenance_status: string;
  governance: {
    governance_status: string;
    governance_source: string;
  };
  methodology_version: string;
  governed_input: PublicReport2024GovernedInput;
  upstream_sources: PublicReport2024UpstreamSource[];
  validation_report: PublicReport2024RepositoryRef;
  lineage_manifest: PublicReport2024RepositoryRef;
  excluded_lanes: PublicReport2024ExcludedLane[];
  warnings: PublicReport2024Warning[];
  teams: PublicReport2024TeamRecord[];
}
