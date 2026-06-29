/**
 * Regenerate the full-mode Forecast Run 2 evidence bundle from the vendored governed TIBER-Data
 * 2024 `team_week_raw_v0` source (Teamstate issue #72). Deterministic and byte-stable: run
 *
 *   npm run export:forecast-run2-full
 *
 * (which builds dist first). Writes three committed artifacts:
 *   - the full-mode emitted Forecast Run 2 artifact (golden),
 *   - the Teamstate-side coverage evidence,
 *   - the mirror provenance manifest for the vendored governed source.
 *
 * It does NOT run Forecast, evaluate Forecast's gate, train, score, predict, or emit fantasy product.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { loadTeamWeekRawV0Governed } from '../dist/src/ingest/loadTeamWeekRawV0Governed.js';
import {
  buildTeamWeekRawV0ForecastRun2Artifact,
  FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF
} from '../dist/src/governed/teamWeekRawV0ForecastRun2Artifact.js';
import { buildForecastRun2FullSourceCoverageEvidence } from '../dist/src/governed/forecastRun2FullSourceCoverageEvidence.js';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Repo-relative path of the vendored governed source mirror (byte-identical to TIBER-Data's governed
// artifact). The emitted artifacts store this stable relative path, never an absolute machine path.
const SOURCE_REL = 'data/governed/team_week_raw_v0_2024_real_source_candidate.json';
const ARTIFACT_REL = 'data/fixtures/team_week_raw_forecast_run2/team_week_raw_v0_2024_forecast_run2.full.json';
const EVIDENCE_REL = 'data/fixtures/team_week_raw_forecast_run2/team_week_raw_v0_2024_forecast_run2.coverage_evidence.json';
const MIRROR_REL = 'data/governed/team_week_raw_v0_2024_real_source_candidate.mirror.json';

const writeJson = (relPath, value) => {
  const absPath = path.join(REPO_ROOT, relPath);
  writeFileSync(absPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
  return absPath;
};

const sourceAbs = path.join(REPO_ROOT, SOURCE_REL);
const sourceBytes = readFileSync(sourceAbs);
const sha256 = createHash('sha256').update(sourceBytes).digest('hex');

const consumption = loadTeamWeekRawV0Governed(sourceAbs);
const emitted = buildTeamWeekRawV0ForecastRun2Artifact(consumption, { asOf: FORECAST_RUN2_DEFAULT_CUTOFF_AS_OF });
// Store the stable repo-relative source path in the committed golden artifact (the loader resolves to
// an absolute path at emit time; the committed file must be machine-independent and deterministic).
emitted.sourceArtifactPath = SOURCE_REL;

const evidence = buildForecastRun2FullSourceCoverageEvidence(consumption, emitted, sha256);

const sourceJson = JSON.parse(sourceBytes.toString('utf-8'));
const mirror = {
  kind: 'team_week_raw_v0_governed_source_mirror',
  issue: 'TIBER-Teamstate#72',
  note:
    'Byte-identical, read-only mirror of the governed TIBER-Data 2024 team_week_raw_v0 source. Teamstate ' +
    'does not re-govern, mutate, or re-derive it; governance is echoed from the upstream explicit marker.',
  mirroredArtifactPath: SOURCE_REL,
  upstream: {
    repo: 'Prometheus-Frameworks/TIBER-Data',
    sourceArtifactPath: 'exports/candidates/team_week_raw/team_week_raw_v0_2024_real_source_candidate.json',
    validationReportPath: 'exports/candidates/team_week_raw/team_week_raw_v0_2024_real_source_candidate.validation.json',
    lineageManifestPath: 'data/manifests/team_week_raw_v0_2024_real_source_candidate.manifest.json',
    coverageAuditPath: 'exports/candidates/team_week_raw/team_week_raw_v0_2024_teamstate_coverage_audit.json',
    refs: ['TIBER-Data#181', 'TIBER-Data#182']
  },
  sha256,
  artifact: sourceJson.artifact ?? null,
  season: sourceJson.season ?? null,
  generatedAt: sourceJson.generatedAt ?? null,
  rowCount: Array.isArray(sourceJson.rows) ? sourceJson.rows.length : null,
  teamCount: Array.isArray(sourceJson.rows) ? new Set(sourceJson.rows.map((r) => r.teamCode)).size : null,
  governance: sourceJson.metadata?.governance ?? null,
  provenanceStatus: sourceJson.metadata?.provenanceStatus ?? null
};

writeJson(ARTIFACT_REL, emitted);
writeJson(EVIDENCE_REL, evidence);
writeJson(MIRROR_REL, mirror);

process.stderr.write(
  `forecast-run2-full: ${emitted.readinessStatus} | ${emitted.rowCount} rows / ${emitted.teamCount} teams ` +
    `| source sha256 ${sha256.slice(0, 12)}… | missingTeams ${evidence.input.missingTeams.length}\n`
);
process.stderr.write(`  wrote ${ARTIFACT_REL}\n  wrote ${EVIDENCE_REL}\n  wrote ${MIRROR_REL}\n`);
