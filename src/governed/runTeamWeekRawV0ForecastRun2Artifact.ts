import {
  buildTeamWeekRawV0ForecastRun2ArtifactFile,
  EXCERPT_GOVERNED_COVERAGE_EXPECTATION,
  FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF,
  type BuildForecastRun2ArtifactOptions
} from './teamWeekRawV0ForecastRun2Artifact.js';

/**
 * Emit the governed Forecast Run 2 input artifact as JSON for a governed `team_week_raw_v0` source.
 *
 * Usage:
 *   node dist/src/governed/runTeamWeekRawV0ForecastRun2Artifact.js <governed-artifact.json> [--excerpt] [--as-of <iso-8601>]
 *
 * `--excerpt` validates against the small committed governed sample's coverage shape (4 rows) so the
 * sample emits a valid `ready_minimal_boundary`; without it, the real 2024 544-row expectation is used.
 *
 * `--as-of <iso-8601>` sets the forecast cutoff as-of (the pre-target-season boundary the artifact
 * claims). It defaults to the canonical FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF and is never derived from
 * the source's build/generated time. A missing/malformed/non-pre-target as-of fails closed.
 */
const readAsOf = (argv: readonly string[]): string => {
  const flagIndex = argv.indexOf('--as-of');
  if (flagIndex !== -1) {
    const value = argv[flagIndex + 1];
    if (value === undefined || value.startsWith('--')) {
      process.stderr.write('--as-of requires an ISO-8601 timestamp value.\n');
      process.exitCode = 2;
      return '';
    }
    return value;
  }
  return FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF;
};

const main = (): void => {
  const filePath = process.argv[2];
  if (filePath === undefined || filePath.trim().length === 0 || filePath.startsWith('--')) {
    process.stderr.write('Usage: node dist/src/governed/runTeamWeekRawV0ForecastRun2Artifact.js <governed-artifact.json> [--excerpt] [--as-of <iso-8601>]\n');
    process.exitCode = 2;
    return;
  }
  const asOf = readAsOf(process.argv);
  if (asOf === '') return;

  const options: BuildForecastRun2ArtifactOptions = { asOf };
  if (process.argv.includes('--excerpt')) options.coverageExpectation = EXCERPT_GOVERNED_COVERAGE_EXPECTATION;

  const artifact = buildTeamWeekRawV0ForecastRun2ArtifactFile(filePath, options);
  process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
  process.stderr.write(
    `${artifact.readinessStatus}: ${artifact.rowCount} rows / ${artifact.teamCount} teams ` +
      `(cutoff input season ${artifact.forecastCutoff.inputSeason} → target ${artifact.targetSeason}, ` +
      `as-of ${artifact.forecastCutoff.asOf}, ` +
      `${artifact.governance.governanceStatus} via ${artifact.governance.governanceSource})\n`
  );
  process.exitCode = artifact.readinessStatus === 'ready_minimal_boundary' ? 0 : 1;
};

main();
