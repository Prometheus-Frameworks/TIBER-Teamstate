import {
  buildTeamWeekRawV0ForecastRun2ArtifactFile,
  EXCERPT_GOVERNED_COVERAGE_EXPECTATION
} from './teamWeekRawV0ForecastRun2Artifact.js';

/**
 * Emit the governed Forecast Run 2 input artifact as JSON for a governed `team_week_raw_v0` source.
 *
 * Usage:
 *   node dist/src/governed/runTeamWeekRawV0ForecastRun2Artifact.js <governed-artifact.json> [--excerpt]
 *
 * `--excerpt` validates against the small committed governed sample's coverage shape (4 rows) so the
 * sample emits a valid `ready_minimal_boundary`; without it, the real 2024 544-row expectation is used.
 */
const main = (): void => {
  const filePath = process.argv[2];
  if (filePath === undefined || filePath.trim().length === 0) {
    process.stderr.write('Usage: node dist/src/governed/runTeamWeekRawV0ForecastRun2Artifact.js <governed-artifact.json> [--excerpt]\n');
    process.exitCode = 2;
    return;
  }
  const useExcerpt = process.argv.includes('--excerpt');
  const artifact = buildTeamWeekRawV0ForecastRun2ArtifactFile(
    filePath,
    useExcerpt ? { coverageExpectation: EXCERPT_GOVERNED_COVERAGE_EXPECTATION } : undefined
  );
  process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  process.stderr.write(
    `${artifact.readinessStatus}: ${artifact.rowCount} rows / ${artifact.teamCount} teams ` +
      `(cutoff input season ${artifact.forecastCutoff.inputSeason} → target ${artifact.targetSeason}, ` +
      `${artifact.governance.governanceStatus} via ${artifact.governance.governanceSource})\n`
  );
  process.exitCode = artifact.readinessStatus === 'ready_minimal_boundary' ? 0 : 1;
};

main();
