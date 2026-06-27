/**
 * Read-only CLI entry point for the candidate-only Teamstate rehearsal report (issue #60).
 *
 * Usage: `node dist/src/rehearsal/runTeamWeekRawV0CandidateRehearsal.js <candidate-artifact.json>`
 *        (or `npm run rehearsal:candidate -- <candidate-artifact.json>`)
 *
 * Loads the candidate artifact, produces the null-aware rehearsal report, prints it as JSON to
 * stdout, and exits non-zero only when coverage is invalid (rehearsal withheld) — so it can double
 * as a CI gate. It never writes to or mutates the artifact, never promotes/governs it, and never
 * routes rows through scoring.
 *
 * Exit codes are set via `process.exitCode` (not `process.exit()`): when stdout/stderr are piped or
 * redirected, `process.exit()` can terminate before the buffered async writes flush, truncating the
 * report (see https://nodejs.org/api/process.html#processexitcode).
 */

import { rehearseTeamWeekRawV0CandidateFile } from './teamWeekRawV0CandidateRehearsal.js';

const main = (): void => {
  const filePath = process.argv[2];
  if (filePath === undefined || filePath.trim().length === 0) {
    process.stderr.write(
      'Usage: node dist/src/rehearsal/runTeamWeekRawV0CandidateRehearsal.js <candidate-artifact.json>\n'
    );
    process.exitCode = 2;
    return;
  }

  const report = rehearseTeamWeekRawV0CandidateFile(filePath);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  const summary =
    report.rehearsalStatus === 'rehearsed'
      ? `rehearsal OK: ${report.rowCount} rows, ${report.availableFields.length} available / ${report.deferredInsufficientFields.length} deferred / ${report.partialNullFields.length} partial-null (${report.provenanceStatus} / ${report.governanceStatus}, rehearsal-only)`
      : `rehearsal WITHHELD: coverage invalid, ${report.coverage.errors.length} error(s) (${report.provenanceStatus} / ${report.governanceStatus})`;
  process.stderr.write(`${summary}\n`);

  process.exitCode = report.rehearsalStatus === 'rehearsed' ? 0 : 1;
};

main();
