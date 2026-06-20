import type {
  OffenseMovementDirection,
  PassEnvironmentMovementDirection,
  PaceMovementDirection,
  PressureMovementDirection,
  VolatilityMovementDirection,
  TeamEnvironmentMovementMetadataV0
} from './teamEnvironmentMovement.js';

/**
 * team_environment_movement_v1
 *
 * The team-state-only successor to `team_environment_movement_v0`. v1 deliberately drops the
 * legacy fantasy-point fields (`fantasyPointsForQB/RB/WR/TE`) from the window averages and deltas,
 * keeping Teamstate's movement artifact within the TTS v1 boundary (observed NFL team state, not
 * fantasy outputs). See docs/contracts/team-environment-movement-v1.md and issue #34.
 *
 * Movement labels are unchanged from v0: they were always derived solely from team-state fields,
 * so v1 is the clean projection of the same computation with the inert fantasy-point passengers
 * removed. The shared metadata/provenance contract is reused from v0.
 */

export interface TeamEnvironmentMovementWindowAveragesV1 {
  pointsPerDrive: number | null;
  epaPerPlay: number | null;
  successRate: number | null;
  explosivePlayRate: number | null;
  pressureRateAllowed: number | null;
  secondsPerPlay: number | null;
  neutralPassRate: number | null;
  volatilityScore: number | null;
}

export interface TeamEnvironmentMovementWindowV1 {
  weeks: number[];
  games: number;
  averages: TeamEnvironmentMovementWindowAveragesV1;
}

export type TeamEnvironmentMovementDeltasV1 = Omit<TeamEnvironmentMovementWindowAveragesV1, 'volatilityScore'>;

export interface TeamEnvironmentMovementTeamV1 {
  teamId: string;
  teamAbbr: string;
  season: number;
  weeksCovered: number[];
  earlyWindow: TeamEnvironmentMovementWindowV1;
  lateWindow: TeamEnvironmentMovementWindowV1;
  deltas: TeamEnvironmentMovementDeltasV1;
  movement: {
    offenseDirection: OffenseMovementDirection;
    passEnvironmentDirection: PassEnvironmentMovementDirection;
    paceDirection: PaceMovementDirection;
    pressureDirection: PressureMovementDirection;
    volatilityDirection: VolatilityMovementDirection;
    verdict: string;
  };
  warnings: string[];
}

/**
 * Explicit, producer-owned governance metadata for `team_environment_movement_v1`.
 *
 * This lets a downstream consumer distinguish a governed promoted production artifact from a
 * fixture/scaffold, an ungoverned/local artifact, or an unknown/missing-governance artifact —
 * without inferring trust from a path such as `/promoted/`. A `/promoted/` location is at most a
 * weak hint; it is never the sole governance proof. See issue #40 and
 * docs/contracts/team-environment-movement-v1.md.
 *
 * - `governed`   — a governed, promoted production artifact.
 * - `fixture`    — a fixture/scaffold/sample artifact (demo data, not production truth).
 * - `ungoverned` — a real-but-ungoverned artifact (e.g. partial/local/dev output).
 * - `unknown`    — governance could not be established.
 */
export type TeamEnvironmentMovementGovernanceStatus = 'governed' | 'fixture' | 'ungoverned' | 'unknown';

/**
 * How the `governanceStatus` was established.
 *
 * - `explicit_marker` — the producer explicitly set the provenance/governance marker for the run.
 * - `path_inference`  — status was inferred from the input path only (a weak hint, not proof).
 * - `unknown`         — no basis for a governance determination was available.
 */
export type TeamEnvironmentMovementGovernanceSource = 'explicit_marker' | 'path_inference' | 'unknown';

export interface TeamEnvironmentMovementGovernanceV1 {
  governanceStatus: TeamEnvironmentMovementGovernanceStatus;
  governanceSource: TeamEnvironmentMovementGovernanceSource;
  /** Dataset-level contract literal. Always exactly `team_environment_movement_v1`. */
  contractVersion: 'team_environment_movement_v1';
  /** Dataset-level timestamp, mirrors the artifact's top-level `generatedAt`. */
  generatedAt: string;
  /** Optional promotion timestamp, only present when distinct and meaningful. */
  promotedAt?: string;
  /** Optional, non-advisory provenance notes (e.g. flagging path-only inference). */
  promotionNotes?: string[];
}

export interface TeamEnvironmentMovementArtifactV1 {
  artifact: 'team_environment_movement_v1';
  generatedAt: string;
  metadata: TeamEnvironmentMovementMetadataV0;
  governance: TeamEnvironmentMovementGovernanceV1;
  teams: TeamEnvironmentMovementTeamV1[];
}
