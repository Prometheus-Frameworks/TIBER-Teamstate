/**
 * Read-only CLI entry point for the real 2024 `team_week_raw_v0` candidate dry-run (issue #58).
 *
 * Usage: `node dist/src/dryrun/runTeamWeekRawV0CandidateDryRun.js <candidate-artifact.json>`
 *        (or `npm run dryrun:candidate -- <candidate-artifact.json>`)
 *
 * It loads the given candidate artifact, runs the bye-aware coverage dry-run, prints the report as
 * JSON to stdout, and exits non-zero only if coverage failed — so it can double as a CI gate. It
 * never writes to or mutates the artifact, never promotes it, and never routes rows into scoring.
 *
 * Exit codes are set via `process.exitCode` (not `process.exit()`): when stdout/stderr are piped or
 * redirected, `process.exit()` can terminate the process before the buffered async writes flush,
 * truncating the report. Setting `exitCode` and returning lets Node drain stdio first, then exit
 * with the right code (see https://nodejs.org/api/process.html#processexitcode).
 */

import { dryRunTeamWeekRawV0CandidateFile } from './teamWeekRawV0CandidateDryRun.js';

const main = (): void => {
  const filePath = process.argv[2];
  if (filePath === undefined || filePath.trim().length === 0) {
    process.stderr.write(
      'Usage: node dist/src/dryrun/runTeamWeekRawV0CandidateDryRun.js <candidate-artifact.json>\n'
    );
    process.exitCode = 2;
    return;
  }

  const report = dryRunTeamWeekRawV0CandidateFile(filePath);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  const summary = report.coverage.valid
    ? `dry-run OK: ${report.rowCount} rows, bye-aware coverage valid (${report.provenanceStatus} / ${report.governanceStatus})`
    : `dry-run coverage FAILED: ${report.coverage.errors.length} error(s) (${report.provenanceStatus} / ${report.governanceStatus})`;
  process.stderr.write(`${summary}\n`);

  process.exitCode = report.coverage.valid ? 0 : 1;
};

main();
