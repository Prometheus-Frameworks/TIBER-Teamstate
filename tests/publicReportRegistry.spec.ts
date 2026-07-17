import { describe, expect, it } from 'vitest';

import {
  LIVE_SERVICE_METADATA,
  applyPublicReportPublication,
  resolveCurrentRegistryEntry,
  validatePublicReportRegistry,
  type PublicReportPublicationEvidence,
  type PublicReportRegistryEntry,
  type TeamstateServiceMetadata
} from '../src/reports/publicReportRegistry.js';

const CANONICAL = '/nfl/2024/offensive-environments';

const entryInput = (revision: number) => ({
  report_version_id: `teamstate_public_offensive_environment_2024_v1.r${revision}`,
  canonical_url: CANONICAL,
  version_url: `${CANONICAL}/teamstate_public_offensive_environment_2024_v1.r${revision}`,
  published_at: `2026-07-1${revision}T00:00:00.000Z`
});

const evidenceFor = (revision: number): PublicReportPublicationEvidence => ({
  validation: {
    publishable: true,
    rejections: [],
    binding: {
      report_version_id: `teamstate_public_offensive_environment_2024_v1.r${revision}`,
      json_sha256: 'a'.repeat(64),
      html_sha256: 'b'.repeat(64)
    }
  },
  approval: {
    report_version_id: `teamstate_public_offensive_environment_2024_v1.r${revision}`,
    approved_by: 'test-operator',
    approved_at: '2026-07-17T00:00:00.000Z'
  }
});

describe('public report registry (§6)', () => {
  it('live service metadata stays the deployment scaffold: empty registry, publication disabled', () => {
    expect(LIVE_SERVICE_METADATA).toEqual({
      service: 'tiber-teamstate',
      status: 'deployment_scaffold',
      public_reports: [],
      artifact_publication_enabled: false
    });
  });

  it('publishes a first version as current without mutating the input metadata', () => {
    const before = JSON.parse(JSON.stringify(LIVE_SERVICE_METADATA));
    const next = applyPublicReportPublication(LIVE_SERVICE_METADATA, entryInput(1), evidenceFor(1));

    expect(LIVE_SERVICE_METADATA).toEqual(before);
    expect(next.artifact_publication_enabled).toBe(true);
    expect(next.public_reports).toEqual([
      {
        ...entryInput(1),
        status: 'current',
        superseded_by: null
      }
    ]);
  });

  it('flips current → superseded atomically in a single pure step when publishing a successor', () => {
    const first = applyPublicReportPublication(LIVE_SERVICE_METADATA, entryInput(1), evidenceFor(1));
    const second = applyPublicReportPublication(first, entryInput(2), evidenceFor(2));

    // The prior state object is untouched (no intermediate/partial mutation is observable).
    expect(first.public_reports).toHaveLength(1);
    expect(first.public_reports[0].status).toBe('current');

    expect(second.public_reports).toHaveLength(2);
    const [r1, r2] = second.public_reports;
    expect(r1.status).toBe('superseded');
    expect(r1.superseded_by).toBe('teamstate_public_offensive_environment_2024_v1.r2');
    expect(r2.status).toBe('current');
    expect(r2.superseded_by).toBeNull();
    expect(validatePublicReportRegistry(second.public_reports)).toEqual([]);
    expect(
      second.public_reports.filter((entry) => entry.canonical_url === CANONICAL && entry.status === 'current')
    ).toHaveLength(1);
  });

  it('refuses to re-register an already-registered report_version_id', () => {
    const first = applyPublicReportPublication(LIVE_SERVICE_METADATA, entryInput(1), evidenceFor(1));
    expect(() => applyPublicReportPublication(first, entryInput(1), evidenceFor(1))).toThrow(/already registered/);
  });

  it('refuses publication without a complete case-#20 validation result', () => {
    const notPublishable: PublicReportPublicationEvidence = {
      ...evidenceFor(1),
      validation: { ...evidenceFor(1).validation, publishable: false }
    };
    expect(() => applyPublicReportPublication(LIVE_SERVICE_METADATA, entryInput(1), notPublishable)).toThrow(
      /not a complete case-#20 success/
    );

    const withRejections: PublicReportPublicationEvidence = {
      ...evidenceFor(1),
      validation: {
        ...evidenceFor(1).validation,
        rejections: [{ code: 'E_PUBLICATION_NOT_APPROVED', detail: 'x' }]
      }
    };
    expect(() => applyPublicReportPublication(LIVE_SERVICE_METADATA, entryInput(1), withRejections)).toThrow(
      /not a complete case-#20 success/
    );
  });

  it('refuses publication on a malformed or wrong-version approval record', () => {
    const emptyApprover: PublicReportPublicationEvidence = {
      ...evidenceFor(1),
      approval: { ...evidenceFor(1).approval, approved_by: '   ' }
    };
    expect(() => applyPublicReportPublication(LIVE_SERVICE_METADATA, entryInput(1), emptyApprover)).toThrow(
      /malformed/
    );

    const invalidTimestamp: PublicReportPublicationEvidence = {
      ...evidenceFor(1),
      approval: { ...evidenceFor(1).approval, approved_at: 'yesterday' }
    };
    expect(() => applyPublicReportPublication(LIVE_SERVICE_METADATA, entryInput(1), invalidTimestamp)).toThrow(
      /malformed/
    );

    // Evidence for a different version can never publish this one — the binding check fires first.
    const wrongVersion: PublicReportPublicationEvidence = evidenceFor(2);
    expect(() => applyPublicReportPublication(LIVE_SERVICE_METADATA, entryInput(1), wrongVersion)).toThrow(
      /never transferable/
    );

    // Same-binding, wrong-approval: the approval must also name the exact version being published.
    const mismatchedApproval: PublicReportPublicationEvidence = {
      validation: evidenceFor(1).validation,
      approval: evidenceFor(2).approval
    };
    expect(() => applyPublicReportPublication(LIVE_SERVICE_METADATA, entryInput(1), mismatchedApproval)).toThrow(
      /exact-version/
    );
  });

  it('refuses publication when the validation binding is absent or names a different version', () => {
    const noBinding: PublicReportPublicationEvidence = {
      ...evidenceFor(1),
      validation: { publishable: true, rejections: [], binding: null }
    };
    expect(() => applyPublicReportPublication(LIVE_SERVICE_METADATA, entryInput(1), noBinding)).toThrow(
      /no well-formed\s+content binding/
    );

    // A genuine result for r1 must never be able to publish r2 — the binding is exact-version.
    const r1EvidenceForR2Entry: PublicReportPublicationEvidence = {
      validation: evidenceFor(1).validation,
      approval: evidenceFor(2).approval
    };
    expect(() => applyPublicReportPublication(LIVE_SERVICE_METADATA, entryInput(2), r1EvidenceForR2Entry)).toThrow(
      /never transferable/
    );
  });

  it('rejects cross-family supersession and malformed published_at in registry validation', () => {
    const familyA = '/nfl/2024/offensive-environments';
    const familyB = '/nfl/2023/some-other-report';
    const crossFamily: PublicReportRegistryEntry[] = [
      {
        report_version_id: 'family_a_report.r1',
        canonical_url: familyA,
        version_url: `${familyA}/family_a_report.r1`,
        status: 'superseded',
        superseded_by: 'family_b_report.r1',
        published_at: '2026-07-17T00:00:00.000Z'
      },
      {
        report_version_id: 'family_b_report.r1',
        canonical_url: familyB,
        version_url: `${familyB}/family_b_report.r1`,
        status: 'current',
        superseded_by: null,
        published_at: '2026-07-17T00:00:00.000Z'
      }
    ];
    expect(validatePublicReportRegistry(crossFamily).join(' ')).toMatch(/supersession never crosses report families/);

    const malformedPublishedAt: PublicReportRegistryEntry[] = [
      { ...entryInput(1), status: 'current', superseded_by: null, published_at: 'sometime last week' }
    ];
    expect(validatePublicReportRegistry(malformedPublishedAt).join(' ')).toMatch(/malformed published_at/);

    const inconsistentVersionUrl: PublicReportRegistryEntry[] = [
      {
        ...entryInput(1),
        version_url: `${CANONICAL}/some-other-id`,
        status: 'current',
        superseded_by: null
      }
    ];
    expect(validatePublicReportRegistry(inconsistentVersionUrl).join(' ')).toMatch(/is not/);
  });

  it('validatePublicReportRegistry flags duplicate currents, dangling pointers, and orphaned superseded entries', () => {
    const current = (revision: number): PublicReportRegistryEntry => ({
      ...entryInput(revision),
      status: 'current',
      superseded_by: null
    });
    expect(validatePublicReportRegistry([current(1), current(2)]).join(' ')).toMatch(/2 status: "current" entries/);

    const dangling: PublicReportRegistryEntry = {
      ...entryInput(1),
      status: 'superseded',
      superseded_by: 'teamstate_public_offensive_environment_2024_v1.r9'
    };
    expect(validatePublicReportRegistry([dangling]).join(' ')).toMatch(/does not resolve/);

    const orphan: PublicReportRegistryEntry = { ...entryInput(1), status: 'superseded', superseded_by: null };
    expect(validatePublicReportRegistry([orphan]).join(' ')).toMatch(/must name its successor/);
  });

  it('resolveCurrentRegistryEntry fails closed to null on ambiguous registries', () => {
    const first = applyPublicReportPublication(LIVE_SERVICE_METADATA, entryInput(1), evidenceFor(1));
    expect(resolveCurrentRegistryEntry(first, CANONICAL)?.report_version_id).toBe(
      'teamstate_public_offensive_environment_2024_v1.r1'
    );
    expect(resolveCurrentRegistryEntry(LIVE_SERVICE_METADATA, CANONICAL)).toBeNull();

    const ambiguous: TeamstateServiceMetadata = {
      ...first,
      public_reports: [
        { ...entryInput(1), status: 'current', superseded_by: null },
        { ...entryInput(2), status: 'current', superseded_by: null }
      ]
    };
    expect(resolveCurrentRegistryEntry(ambiguous, CANONICAL)).toBeNull();
  });
});
