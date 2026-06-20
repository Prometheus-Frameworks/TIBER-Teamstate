import type { TeamWeekState } from '../types/teamstate.js';
import type {
  TeamEnvironmentMovementDeltasV0,
  TeamEnvironmentMovementWindowV0
} from '../contracts/teamEnvironmentMovement.js';
import type {
  TeamEnvironmentMovementArtifactV1,
  TeamEnvironmentMovementDeltasV1,
  TeamEnvironmentMovementGovernanceSource,
  TeamEnvironmentMovementGovernanceStatus,
  TeamEnvironmentMovementGovernanceV1,
  TeamEnvironmentMovementWindowV1
} from '../contracts/teamEnvironmentMovementV1.js';
import type { TeamstateProvenanceStatus } from '../contracts/teamEnvironmentProfile.js';
import { buildTeamEnvironmentMovementV0 } from './teamEnvironmentMovement.js';

/**
 * Builds the team-state-only `team_environment_movement_v1` artifact.
 *
 * v1 is derived from the v0 computation so movement labels stay identical and there is a single
 * source of truth for the movement logic. The only difference is that the legacy fantasy-point
 * fields (`fantasyPointsForQB/RB/WR/TE`) are omitted from the window averages and deltas — they
 * never drove any movement label, so dropping them changes nothing about the directional output.
 */

const toV1Window = (window: TeamEnvironmentMovementWindowV0): TeamEnvironmentMovementWindowV1 => ({
  weeks: window.weeks,
  games: window.games,
  averages: {
    pointsPerDrive: window.averages.pointsPerDrive,
    epaPerPlay: window.averages.epaPerPlay,
    successRate: window.averages.successRate,
    explosivePlayRate: window.averages.explosivePlayRate,
    pressureRateAllowed: window.averages.pressureRateAllowed,
    secondsPerPlay: window.averages.secondsPerPlay,
    neutralPassRate: window.averages.neutralPassRate,
    volatilityScore: window.averages.volatilityScore
  }
});

/**
 * Provenance values a producer can set explicitly for a run. When `sourceProvenanceStatus` is one
 * of these, the resulting governance status is backed by an explicit producer marker rather than by
 * inferring trust from the input path.
 */
const EXPLICIT_PROVENANCE_MARKERS: ReadonlySet<string> = new Set<TeamstateProvenanceStatus>([
  'fixture_scaffold',
  'sample',
  'partial_real_data',
  'governed_real_data',
  'unknown_provenance'
]);

/** Maps the resolved dataset provenance status to an explicit governance status. */
const toGovernanceStatus = (provenanceStatus: TeamstateProvenanceStatus): TeamEnvironmentMovementGovernanceStatus => {
  switch (provenanceStatus) {
    case 'governed_real_data':
      return 'governed';
    case 'fixture_scaffold':
    case 'sample':
      return 'fixture';
    case 'partial_real_data':
      return 'ungoverned';
    case 'unknown_provenance':
    default:
      return 'unknown';
  }
};

/**
 * Builds the explicit, producer-owned governance block for the v1 artifact.
 *
 * `governanceSource` is `explicit_marker` only when the producer supplied a recognized provenance
 * marker for the run. When the status was inferred from the input path alone, the source is
 * `path_inference` and a note records that the path is a weak hint, never the sole governance proof.
 */
const buildGovernance = (
  provenanceStatus: TeamstateProvenanceStatus,
  generatedAt: string,
  sourceProvenanceStatus: string | null | undefined
): TeamEnvironmentMovementGovernanceV1 => {
  const governanceStatus = toGovernanceStatus(provenanceStatus);
  const hasExplicitMarker =
    typeof sourceProvenanceStatus === 'string' && EXPLICIT_PROVENANCE_MARKERS.has(sourceProvenanceStatus);

  // Without an explicit producer marker the status is at best inferred from the input path. When
  // even the path yields no usable signal — status resolves to `unknown` — there is no basis at
  // all, so the source is `unknown`, not `path_inference`. A bare `/promoted/` path is this case:
  // it is unrecognized provenance, so on its own it yields unknown/unknown, never a governed claim.
  let governanceSource: TeamEnvironmentMovementGovernanceSource;
  if (hasExplicitMarker) {
    governanceSource = 'explicit_marker';
  } else if (governanceStatus === 'unknown') {
    governanceSource = 'unknown';
  } else {
    governanceSource = 'path_inference';
  }

  const governance: TeamEnvironmentMovementGovernanceV1 = {
    governanceStatus,
    governanceSource,
    contractVersion: 'team_environment_movement_v1',
    generatedAt
  };

  if (governanceSource === 'path_inference') {
    governance.promotionNotes = [
      'Governance status inferred from input path; no explicit producer marker was supplied. Path location (e.g. /promoted/) is a weak hint and is not, on its own, governance proof.'
    ];
  } else if (governanceSource === 'unknown') {
    governance.promotionNotes = [
      'No explicit producer marker was supplied and the input path yielded no usable provenance signal; governance could not be established.'
    ];
  }

  return governance;
};

const toV1Deltas = (deltas: TeamEnvironmentMovementDeltasV0): TeamEnvironmentMovementDeltasV1 => ({
  pointsPerDrive: deltas.pointsPerDrive,
  epaPerPlay: deltas.epaPerPlay,
  successRate: deltas.successRate,
  explosivePlayRate: deltas.explosivePlayRate,
  pressureRateAllowed: deltas.pressureRateAllowed,
  secondsPerPlay: deltas.secondsPerPlay,
  neutralPassRate: deltas.neutralPassRate
});

export const buildTeamEnvironmentMovementV1 = (
  teamStates: TeamWeekState[],
  generatedAt: string,
  sourceInputPath?: string,
  sourceProvenanceStatus?: string | null
): TeamEnvironmentMovementArtifactV1 => {
  const v0 = buildTeamEnvironmentMovementV0(teamStates, generatedAt, sourceInputPath, sourceProvenanceStatus);

  return {
    artifact: 'team_environment_movement_v1',
    generatedAt: v0.generatedAt,
    metadata: v0.metadata,
    governance: buildGovernance(v0.metadata.provenanceStatus, v0.generatedAt, sourceProvenanceStatus),
    teams: v0.teams.map((team) => ({
      teamId: team.teamId,
      teamAbbr: team.teamAbbr,
      season: team.season,
      weeksCovered: team.weeksCovered,
      earlyWindow: toV1Window(team.earlyWindow),
      lateWindow: toV1Window(team.lateWindow),
      deltas: toV1Deltas(team.deltas),
      movement: team.movement,
      warnings: team.warnings
    }))
  };
};
