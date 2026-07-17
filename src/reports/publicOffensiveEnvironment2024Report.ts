/**
 * Deterministic team-season derivation and frozen-payload builder for
 * `teamstate_public_offensive_environment_2024_v1` (contract §3, §5, §7).
 *
 * Built directly on `teamWeekRawV0GovernedAdapter` output — never through
 * `buildSeasonToDateReports.ts` or `src/score/`. Aggregation runs at full floating-point
 * precision; rounding (round-half-away-from-zero) is applied exactly once, to the final published
 * value. The builder fails closed on anything it cannot represent faithfully: a null value in a
 * never-null field, a red-zone null inconsistent with zero opportunities, an upstream source
 * missing the metadata the contract requires, or a governed-input checksum that does not match the
 * contract's pinned value.
 */

import { createHash } from 'node:crypto';

import type {
  TeamWeekRawGovernedConsumption,
  TeamWeekRawGovernedRow
} from '../adapters/teamWeekRawV0GovernedAdapter.js';
import {
  PUBLIC_REPORT_2024_CANONICAL_URL_JSON,
  PUBLIC_REPORT_2024_DECLARED_SCOPE,
  PUBLIC_REPORT_2024_DERIVED_PRECISION,
  PUBLIC_REPORT_2024_EXCLUDED_LANES,
  PUBLIC_REPORT_2024_EXPECTED_TEAMS,
  PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN,
  PUBLIC_REPORT_2024_LINEAGE_MANIFEST_REF,
  PUBLIC_REPORT_2024_UPSTREAM_CHECKSUM_VERIFICATION,
  PUBLIC_REPORT_2024_VALIDATION_REPORT_REF,
  PUBLIC_REPORT_2024_WARNING_CODES,
  TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_ARTIFACT,
  TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_SCHEMA_VERSION,
  buildPublicReport2024VersionId,
  buildPublicReport2024VersionUrlJson,
  type PublicReport2024Coverage,
  type PublicReport2024Payload,
  type PublicReport2024TeamRecord,
  type PublicReport2024UpstreamSource,
  type PublicReport2024Warning
} from '../contracts/teamstatePublicOffensiveEnvironment2024V1.js';

/**
 * Round-half-away-from-zero at `decimals` places, applied exactly once to a full-precision value
 * (§3 precision policy). `toPrecision(12)` strips binary floating-point representation noise so a
 * value that is exactly on a half boundary in decimal terms rounds away from zero deterministically.
 */
export const roundHalfAwayFromZero = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  const scaled = Number((value * factor).toPrecision(12));
  return (Math.sign(scaled) * Math.round(Math.abs(scaled))) / factor;
};

const requireRowNumber = (row: TeamWeekRawGovernedRow, field: keyof TeamWeekRawGovernedRow): number => {
  const value = row[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `public report 2024 derivation refused: ${row.teamCode} week ${row.week} has null/non-finite ` +
        `${String(field)}, which the contract declares never-null (§3); withholding, not zero-filling.`
    );
  }
  return value;
};

export interface TeamSeasonDerivation {
  record: PublicReport2024TeamRecord;
  warnings: PublicReport2024Warning[];
}

/** Derive one team's season record from its governed weekly rows (contract §3, exact formulas). */
export const deriveTeamSeasonRecord = (team: string, rows: TeamWeekRawGovernedRow[]): TeamSeasonDerivation => {
  if (rows.length === 0) {
    throw new Error(`public report 2024 derivation refused: no rows for team ${team}.`);
  }
  const gamesPlayed = rows.length;
  const warnings: string[] = [];
  const payloadWarnings: PublicReport2024Warning[] = [];

  const sum = (field: keyof TeamWeekRawGovernedRow): number =>
    rows.reduce((acc, row) => acc + requireRowNumber(row, field), 0);

  const pointsForTotal = sum('pointsFor');
  const offensivePlaysTotal = sum('offensivePlays');
  const neutralPlaysTotal = sum('neutralPlays');
  const drivesTotal = sum('drives');
  const redZoneTripsTotal = sum('redZoneTrips');
  const sacksAllowedTotal = sum('sacksAllowed');
  const turnoversTotal = sum('turnovers');

  // Play-weighted rates (§3): Σ(rate_w × weight_w) / Σ weight_w, full precision, rounded once.
  const weighted = (rateField: keyof TeamWeekRawGovernedRow, weightField: keyof TeamWeekRawGovernedRow): number | null => {
    let numerator = 0;
    let denominator = 0;
    for (const row of rows) {
      const weight = requireRowNumber(row, weightField);
      const rate = requireRowNumber(row, rateField);
      numerator += rate * weight;
      denominator += weight;
    }
    return denominator === 0 ? null : numerator / denominator;
  };

  const secondsPerPlayRaw = weighted('secondsPerPlay', 'offensivePlays');
  const epaPerPlayRaw = weighted('epaPerPlay', 'offensivePlays');
  if (secondsPerPlayRaw === null || epaPerPlayRaw === null) {
    // Not expected in any real season (a team with zero offensive plays); fail closed rather than
    // inventing a null rule the contract does not define for these fields.
    throw new Error(
      `public report 2024 derivation refused: team ${team} has zero total offensivePlays; ` +
        'secondsPerPlay/epaPerPlay have no contract-defined zero-denominator rule.'
    );
  }

  const neutralPassRateRaw = weighted('neutralPassRate', 'neutralPlays');
  if (neutralPassRateRaw === null) {
    warnings.push(PUBLIC_REPORT_2024_WARNING_CODES.zeroDenominatorNeutralPlays);
    payloadWarnings.push({ team, code: PUBLIC_REPORT_2024_WARNING_CODES.zeroDenominatorNeutralPlays });
  }

  const pointsPerDriveRaw = weighted('pointsPerDrive', 'drives');
  if (pointsPerDriveRaw === null) {
    warnings.push(PUBLIC_REPORT_2024_WARNING_CODES.zeroDenominatorDrives);
    payloadWarnings.push({ team, code: PUBLIC_REPORT_2024_WARNING_CODES.zeroDenominatorDrives });
  }

  // redZoneTdRate (§3): redZoneTrips-weighted over non-null weeks, null-preserving. A null weekly
  // rate is legitimate exactly when that week had zero trips; anything else is inconsistent data.
  let redZoneNumerator = 0;
  let redZoneDenominator = 0;
  for (const row of rows) {
    const trips = requireRowNumber(row, 'redZoneTrips');
    const rate = row.redZoneTdRate;
    if (rate === null) {
      if (trips !== 0) {
        throw new Error(
          `public report 2024 derivation refused: ${team} week ${row.week} has redZoneTdRate null ` +
            `with redZoneTrips ${trips}; the governed null pattern is exactly zero opportunities (§3).`
        );
      }
      continue;
    }
    if (!Number.isFinite(rate)) {
      throw new Error(`public report 2024 derivation refused: ${team} week ${row.week} redZoneTdRate is non-finite.`);
    }
    redZoneNumerator += rate * trips;
    redZoneDenominator += trips;
  }
  let redZoneTdRate: number | null;
  if (redZoneDenominator === 0) {
    redZoneTdRate = null;
    warnings.push(PUBLIC_REPORT_2024_WARNING_CODES.zeroRedZoneOpportunities);
    payloadWarnings.push({ team, code: PUBLIC_REPORT_2024_WARNING_CODES.zeroRedZoneOpportunities });
  } else {
    redZoneTdRate = roundHalfAwayFromZero(redZoneNumerator / redZoneDenominator, PUBLIC_REPORT_2024_DERIVED_PRECISION.redZoneTdRate);
  }

  const perGame = (total: number, decimals: number): number => roundHalfAwayFromZero(total / gamesPlayed, decimals);

  const record: PublicReport2024TeamRecord = {
    team,
    gamesPlayed,
    observed: {
      pointsForTotal: roundHalfAwayFromZero(pointsForTotal, 0),
      offensivePlaysTotal: roundHalfAwayFromZero(offensivePlaysTotal, 0),
      neutralPlaysTotal: roundHalfAwayFromZero(neutralPlaysTotal, 0),
      drivesTotal: roundHalfAwayFromZero(drivesTotal, 0),
      redZoneTripsTotal: roundHalfAwayFromZero(redZoneTripsTotal, 0),
      sacksAllowedTotal: roundHalfAwayFromZero(sacksAllowedTotal, 0),
      turnoversTotal: roundHalfAwayFromZero(turnoversTotal, 0)
    },
    derived: {
      pointsForPerGame: perGame(pointsForTotal, PUBLIC_REPORT_2024_DERIVED_PRECISION.pointsForPerGame),
      offensivePlaysPerGame: perGame(offensivePlaysTotal, PUBLIC_REPORT_2024_DERIVED_PRECISION.offensivePlaysPerGame),
      neutralPlaysPerGame: perGame(neutralPlaysTotal, PUBLIC_REPORT_2024_DERIVED_PRECISION.neutralPlaysPerGame),
      drivesPerGame: perGame(drivesTotal, PUBLIC_REPORT_2024_DERIVED_PRECISION.drivesPerGame),
      redZoneTripsPerGame: perGame(redZoneTripsTotal, PUBLIC_REPORT_2024_DERIVED_PRECISION.redZoneTripsPerGame),
      sacksAllowedPerGame: perGame(sacksAllowedTotal, PUBLIC_REPORT_2024_DERIVED_PRECISION.sacksAllowedPerGame),
      turnoversPerGame: perGame(turnoversTotal, PUBLIC_REPORT_2024_DERIVED_PRECISION.turnoversPerGame),
      secondsPerPlay: roundHalfAwayFromZero(secondsPerPlayRaw, PUBLIC_REPORT_2024_DERIVED_PRECISION.secondsPerPlay),
      epaPerPlay: roundHalfAwayFromZero(epaPerPlayRaw, PUBLIC_REPORT_2024_DERIVED_PRECISION.epaPerPlay),
      neutralPassRate:
        neutralPassRateRaw === null
          ? null
          : roundHalfAwayFromZero(neutralPassRateRaw, PUBLIC_REPORT_2024_DERIVED_PRECISION.neutralPassRate),
      pointsPerDrive:
        pointsPerDriveRaw === null
          ? null
          : roundHalfAwayFromZero(pointsPerDriveRaw, PUBLIC_REPORT_2024_DERIVED_PRECISION.pointsPerDrive),
      redZoneTdRate
    },
    warnings
  };

  return { record, warnings: payloadWarnings };
};

/** §1 scope-relative coverage, computed from the actual adapter rows, never trusted from metadata. */
export const computePublicReport2024Coverage = (rows: readonly TeamWeekRawGovernedRow[]): PublicReport2024Coverage => {
  const expected = PUBLIC_REPORT_2024_DECLARED_SCOPE;
  const presentTeams = new Map<string, number>();
  for (const row of rows) {
    presentTeams.set(row.teamCode, (presentTeams.get(row.teamCode) ?? 0) + 1);
  }
  const expectedSet = new Set<string>(PUBLIC_REPORT_2024_EXPECTED_TEAMS);
  const missing_teams = PUBLIC_REPORT_2024_EXPECTED_TEAMS.filter((team) => !presentTeams.has(team));
  const unexpected_teams = [...presentTeams.keys()].filter((team) => !expectedSet.has(team)).sort();
  const perTeamCountsOk = [...presentTeams.values()].every((count) => count === expected.expected_games_per_team);
  const satisfies =
    missing_teams.length === 0 &&
    unexpected_teams.length === 0 &&
    rows.length === expected.expected_team_game_rows &&
    perTeamCountsOk;
  return {
    team_count: presentTeams.size,
    expected_team_count: expected.expected_team_count,
    team_game_row_count: rows.length,
    expected_team_game_rows: expected.expected_team_game_rows,
    missing_teams,
    unexpected_teams,
    is_full_league: satisfies,
    satisfies_declared_scope: satisfies
  };
};

export const computeSha256Hex = (bytes: Buffer | string): string =>
  createHash('sha256').update(bytes).digest('hex');

export interface BuildPublicReport2024Options {
  /** ISO-8601 timestamp for when this report version was derived (§7 `generated_at`). */
  generatedAt: string;
  /** Locally recomputed sha256 of the committed governed source bytes (§8 invariant 3). */
  governedInputSha256: string;
  /** Report revision `n` in `{methodology_version}.r{n}` (§6). Defaults to 1. */
  revision?: number;
}

/**
 * Build the exact §5 frozen payload from governed adapter output. Fails closed if the locally
 * recomputed governed-input checksum does not match the contract's pinned value, or if the
 * governed source's own `metadata.inputSources` cannot faithfully populate `upstream_sources`
 * (§5, §7). Coverage is computed honestly from the rows; the validator (§9) is what refuses
 * publication of a payload whose coverage does not satisfy the declared scope.
 */
export const buildPublicReport2024Payload = (
  consumption: TeamWeekRawGovernedConsumption,
  options: BuildPublicReport2024Options
): PublicReport2024Payload => {
  const pin = PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN;
  if (options.governedInputSha256 !== pin.checksum.value) {
    throw new Error(
      `public report 2024 generation refused: governed input sha256 ${options.governedInputSha256} does not ` +
        `match the contract-pinned checksum ${pin.checksum.value} for ${pin.path}; the governed source must ` +
        'not be edited or regenerated here (issue #90 stop condition).'
    );
  }

  const { upstream, rows } = consumption;
  if (upstream.inputSources.length === 0) {
    throw new Error(
      'public report 2024 generation refused: governed source metadata.inputSources is empty/absent; ' +
        'upstream_sources and source_snapshot_at (§5, §7) cannot be populated.'
    );
  }

  const upstream_sources: PublicReport2024UpstreamSource[] = upstream.inputSources.map((source, index) => {
    if (source.sourceRefs.length !== 1) {
      throw new Error(
        `public report 2024 generation refused: metadata.inputSources[${index}] has ${source.sourceRefs.length} ` +
          'sourceRefs; exactly one source_ref per upstream source is required to populate §5 faithfully.'
      );
    }
    if (source.sourceSnapshotAt === null) {
      throw new Error(
        `public report 2024 generation refused: metadata.inputSources[${index}] has no sourceSnapshotAt; ` +
          'source_snapshot_at (§7) cannot be aggregated.'
      );
    }
    return {
      source_ref: source.sourceRefs[0],
      source_snapshot_at: source.sourceSnapshotAt,
      // Recorded from governed metadata only (never re-fetched); a null here is emitted honestly
      // and rejected by the validator (E_UPSTREAM_SOURCE_CHECKSUM_MISSING), not silently repaired.
      checksum: source.checksum === null ? null : { algorithm: source.checksum.algorithm, value: source.checksum.value },
      checksum_verification: PUBLIC_REPORT_2024_UPSTREAM_CHECKSUM_VERIFICATION
    };
  });

  // §7: source_snapshot_at is the max() of the per-source snapshot timestamps — an explicit
  // aggregation rule, wired to upstream_sources, never to generated_at or data_through.
  const source_snapshot_at = upstream_sources
    .map((source) => source.source_snapshot_at)
    .reduce((latest, candidate) => (Date.parse(candidate) > Date.parse(latest) ? candidate : latest));

  // §8 invariant 8 "by construction": generated_at must be wired to the generation run itself,
  // never a copy of the snapshot or data_through values. Refuse rather than emit conflated wiring.
  if (options.generatedAt === source_snapshot_at || options.generatedAt === PUBLIC_REPORT_2024_DECLARED_SCOPE.data_through) {
    throw new Error(
      `public report 2024 generation refused: generatedAt ${options.generatedAt} duplicates another temporal ` +
        'field; data_through, source_snapshot_at, and generated_at must be wired to distinct sources (§7).'
    );
  }

  const rowsByTeam = new Map<string, TeamWeekRawGovernedRow[]>();
  for (const row of rows) {
    const teamRows = rowsByTeam.get(row.teamCode);
    if (teamRows === undefined) {
      rowsByTeam.set(row.teamCode, [row]);
    } else {
      teamRows.push(row);
    }
  }

  const teamCodes = [...rowsByTeam.keys()].sort();
  const teams: PublicReport2024TeamRecord[] = [];
  const warnings: PublicReport2024Warning[] = [];
  for (const team of teamCodes) {
    const derivation = deriveTeamSeasonRecord(team, rowsByTeam.get(team)!);
    teams.push(derivation.record);
    warnings.push(...derivation.warnings);
  }

  const revision = options.revision ?? 1;
  const report_version_id = buildPublicReport2024VersionId(revision);

  return {
    artifact: TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_ARTIFACT,
    schema_version: TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_SCHEMA_VERSION,
    report_version_id,
    canonical_url: PUBLIC_REPORT_2024_CANONICAL_URL_JSON,
    version_url: buildPublicReport2024VersionUrlJson(report_version_id),
    declared_scope: { ...PUBLIC_REPORT_2024_DECLARED_SCOPE },
    coverage: computePublicReport2024Coverage(rows),
    source_snapshot_at,
    generated_at: options.generatedAt,
    provenance_status: upstream.provenanceStatus,
    governance: {
      governance_status: upstream.governance.governanceStatus,
      governance_source: upstream.governance.governanceSource
    },
    methodology_version: TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_ARTIFACT,
    governed_input: {
      artifact_id: pin.artifact_id,
      repository: pin.repository,
      path: pin.path,
      checksum: { algorithm: pin.checksum.algorithm, value: options.governedInputSha256 },
      checksum_verification: pin.checksum_verification
    },
    upstream_sources,
    validation_report: { ...PUBLIC_REPORT_2024_VALIDATION_REPORT_REF },
    lineage_manifest: { ...PUBLIC_REPORT_2024_LINEAGE_MANIFEST_REF },
    excluded_lanes: PUBLIC_REPORT_2024_EXCLUDED_LANES.map((lane) => ({ ...lane })),
    warnings,
    teams
  };
};

/** Canonical, byte-stable serialization of a frozen payload (2-space indent, trailing newline). */
export const serializePublicReport2024Payload = (payload: PublicReport2024Payload): string =>
  `${JSON.stringify(payload, null, 2)}\n`;
