import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadTeamWeekRawV0Governed } from '../src/ingest/loadTeamWeekRawV0Governed.js';
import { renderPublicReport2024Html } from '../src/reports/publicOffensiveEnvironment2024Html.js';
import {
  buildPublicReport2024Payload,
  computeSha256Hex,
  serializePublicReport2024Payload
} from '../src/reports/publicOffensiveEnvironment2024Report.js';
import { lookupRecordedPublicReportPublicationApproval } from '../src/reports/publicReportPublicationApprovals.js';
import {
  createEmptyPublicReportServingState,
  publishPublicReportVersion,
  type PublicReportPublicationRequest
} from '../src/server.js';

const GOVERNED_SOURCE_PATH = path.resolve(
  process.cwd(),
  'data/governed/team_week_raw_v0_2024_real_source_candidate.json'
);
const PUBLISHED_AT = '2026-07-17T00:00:00.000Z';
const governedSourceBytes = readFileSync(GOVERNED_SOURCE_PATH);
const payload = buildPublicReport2024Payload(loadTeamWeekRawV0Governed(GOVERNED_SOURCE_PATH), {
  generatedAt: PUBLISHED_AT,
  governedInputSha256: computeSha256Hex(governedSourceBytes)
});
const json = serializePublicReport2024Payload(payload);
const html = renderPublicReport2024Html(payload);

describe('production publication approval source — Phase 3 disabled state', () => {
  it('contains no recorded approval for the candidate version or content', () => {
    expect(
      lookupRecordedPublicReportPublicationApproval(
        payload.report_version_id,
        computeSha256Hex(json),
        computeSha256Hex(html)
      )
    ).toBeNull();
  });

  it('ignores caller-attached approval data and leaves publication disabled', () => {
    const request = {
      payload,
      html,
      governedSourceBytes,
      publishedAt: PUBLISHED_AT,
      approval: {
        report_version_id: payload.report_version_id,
        approved_by: 'arbitrary-caller',
        approved_at: PUBLISHED_AT,
        json_sha256: computeSha256Hex(json),
        html_sha256: computeSha256Hex(html)
      }
    } as PublicReportPublicationRequest & { approval: unknown };
    const state = createEmptyPublicReportServingState();

    expect(() => publishPublicReportVersion(state, request)).toThrow(/E_PUBLICATION_NOT_APPROVED/);
    expect(state.serviceMetadata.artifact_publication_enabled).toBe(false);
    expect(state.serviceMetadata.public_reports).toEqual([]);
    expect(state.frozenReports.size).toBe(0);
  });
});
