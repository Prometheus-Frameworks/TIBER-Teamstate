/**
 * Full governed-source dry run for `teamstate_public_offensive_environment_2024_v1` (issue #90 §6).
 *
 * Runs the completed generator + validator against the real committed governed 2024 source
 * (32 teams / 544 played team-game rows):
 *
 *   npm run dryrun:public-report-2024
 *
 * Fail-closed behavior, in order:
 *   1. locally re-hashes the committed governed source bytes and refuses on any drift from the
 *      contract-pinned sha256;
 *   2. builds the candidate r1 payload and HTML;
 *   3. validates with the LIVE registry state (empty, publication disabled) and NO approvals —
 *      the run passes only if the sole rejection is E_PUBLICATION_NOT_APPROVED, i.e. every
 *      §8 invariant holds and only the (correctly absent) human approval blocks publication;
 *   4. additionally confirms that with a hypothetical in-memory approval the payload would be
 *      publishable (§10 case #20) — this records nothing and approves nothing.
 *
 * The candidate output remains uncommitted and non-served: nothing is written unless an explicit
 * `--out <directory>` is provided (which must point outside the repository's committed tree), the
 * live registry stays empty, and `artifact_publication_enabled` stays false.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeSha256Hex,
  generatePublicReport2024FromGovernedBytes,
  serializePublicReport2024Payload
} from '../reports/publicOffensiveEnvironment2024Report.js';
import { renderPublicReport2024Html } from '../reports/publicOffensiveEnvironment2024Html.js';
import { validatePublicReport2024 } from '../reports/publicOffensiveEnvironment2024Validator.js';
import { LIVE_SERVICE_METADATA } from '../reports/publicReportRegistry.js';
import { PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN } from '../contracts/teamstatePublicOffensiveEnvironment2024V1.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const fail = (message: string): never => {
  process.stderr.write(`dryrun:public-report-2024 FAILED: ${message}\n`);
  process.exit(1);
};

const pin = PUBLIC_REPORT_2024_GOVERNED_INPUT_PIN;
const sourceAbs = path.join(REPO_ROOT, pin.path);
const sourceBytes = readFileSync(sourceAbs);
const sourceSha256 = computeSha256Hex(sourceBytes);
if (sourceSha256 !== pin.checksum.value) {
  fail(
    `governed source ${pin.path} sha256 ${sourceSha256} does not match the contract-pinned checksum ` +
      `${pin.checksum.value}; the governed source must not be edited or regenerated here.`
  );
}

const generatedAt = new Date().toISOString();
// Byte-bound generation: checksum, rows, and upstream metadata all come from this exact buffer.
const payload = generatePublicReport2024FromGovernedBytes(sourceBytes, { generatedAt, revision: 1 });
const json = serializePublicReport2024Payload(payload);
const html = renderPublicReport2024Html(payload);

const baseContext = {
  governedSourceBytes: sourceBytes,
  html,
  registry: LIVE_SERVICE_METADATA
};

const preApproval = validatePublicReport2024(payload, { ...baseContext, approvals: [] });
const unexpected = preApproval.rejections.filter((rejection) => rejection.code !== 'E_PUBLICATION_NOT_APPROVED');
if (unexpected.length > 0) {
  fail(
    'validator raised rejections beyond the expected missing publication approval:\n' +
      unexpected.map((rejection) => `  - ${rejection.code}: ${rejection.detail}`).join('\n')
  );
}
if (!preApproval.rejections.some((rejection) => rejection.code === 'E_PUBLICATION_NOT_APPROVED')) {
  fail('validator did not raise E_PUBLICATION_NOT_APPROVED despite no recorded approval — fail-closed gate is broken.');
}
if (preApproval.publishable) {
  fail('validator reported publishable without a recorded human approval — fail-closed gate is broken.');
}

// Hypothetical, in-memory-only approval: proves §10 case #20 would pass. Records/approves nothing.
const hypothetical = validatePublicReport2024(payload, {
  ...baseContext,
  approvals: [
    {
      report_version_id: payload.report_version_id,
      approved_by: 'hypothetical-dry-run-only',
      approved_at: generatedAt
    }
  ]
});
if (!hypothetical.publishable) {
  fail(
    'payload would not be publishable even with a hypothetical approval:\n' +
      hypothetical.rejections.map((rejection) => `  - ${rejection.code}: ${rejection.detail}`).join('\n')
  );
}

const outFlagIndex = process.argv.indexOf('--out');
let writtenNote = 'no files written (pass --out <directory> to write the candidate payload/HTML for review)';
if (outFlagIndex !== -1) {
  const outDir = process.argv[outFlagIndex + 1];
  if (outDir === undefined || outDir.length === 0) {
    fail('--out requires a directory argument');
  }
  const outAbs = path.resolve(outDir);
  const committedTrees = ['data', 'docs', 'exports', 'output', 'src', 'tests', 'scripts'].map((dir) =>
    path.join(REPO_ROOT, dir)
  );
  if (committedTrees.some((tree) => outAbs === tree || outAbs.startsWith(`${tree}${path.sep}`))) {
    fail(
      `--out ${outAbs} points inside the repository's committed tree; dry-run candidate output must remain ` +
        'uncommitted and non-served (issue #90 §6).'
    );
  }
  mkdirSync(outAbs, { recursive: true });
  writeFileSync(path.join(outAbs, `${payload.report_version_id}.candidate.json`), json, 'utf-8');
  writeFileSync(path.join(outAbs, `${payload.report_version_id}.candidate.html`), html, 'utf-8');
  writtenNote = `candidate payload/HTML written to ${outAbs} (uncommitted, non-served)`;
}

const teamsSummary = payload.teams
  .slice(0, 3)
  .map(
    (team) =>
      `${team.team}: pointsForTotal=${team.observed.pointsForTotal}, epaPerPlay=${team.derived.epaPerPlay}, ` +
      `pointsPerDrive=${team.derived.pointsPerDrive}, redZoneTdRate=${team.derived.redZoneTdRate}`
  )
  .join('\n  ');

process.stdout.write(
  [
    'dryrun:public-report-2024 PASSED (fail-closed pre-approval state verified)',
    `  governed source: ${pin.path}`,
    `  governed source sha256 (recomputed locally): ${sourceSha256}`,
    `  coverage: ${payload.coverage.team_count}/${payload.coverage.expected_team_count} teams, ` +
      `${payload.coverage.team_game_row_count}/${payload.coverage.expected_team_game_rows} rows, ` +
      `satisfies_declared_scope=${payload.coverage.satisfies_declared_scope}`,
    `  report_version_id: ${payload.report_version_id}`,
    `  generated_at: ${payload.generated_at}`,
    `  source_snapshot_at: ${payload.source_snapshot_at}`,
    `  candidate JSON sha256: ${computeSha256Hex(json)}`,
    `  candidate HTML sha256: ${computeSha256Hex(html)}`,
    `  payload warnings: ${payload.warnings.length}`,
    `  first teams:\n  ${teamsSummary}`,
    `  pre-approval validation: rejected with exactly E_PUBLICATION_NOT_APPROVED (as required)`,
    `  hypothetical-approval validation: publishable=true (in-memory only; nothing recorded)`,
    `  ${writtenNote}`,
    '  live registry remains empty; artifact_publication_enabled remains false.',
    ''
  ].join('\n')
);
