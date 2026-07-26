import { describe, expect, it } from 'vitest';

import {
  LIVE_SERVICE_METADATA,
  resolveCurrentRegistryEntry,
  validatePublicReportRegistry,
  type PublicReportRegistryEntry,
  type TeamstateServiceMetadata
} from '../src/reports/publicReportRegistry.js';

const CANONICAL = '/nfl/2024/offensive-environments';

const entry = (
  revision: number,
  overrides: Partial<PublicReportRegistryEntry> = {}
): PublicReportRegistryEntry => ({
  report_version_id: `teamstate_public_offensive_environment_2024_v1.r${revision}`,
  canonical_url: CANONICAL,
  version_url: `${CANONICAL}/teamstate_public_offensive_environment_2024_v1.r${revision}`,
  status: 'current',
  superseded_by: null,
  published_at: `2026-07-1${revision}T00:00:00.000Z`,
  ...overrides
});

describe('public report registry (§6, §8 invariant 11)', () => {
  it('live service metadata stays the deployment scaffold: empty registry, publication disabled', () => {
    expect(LIVE_SERVICE_METADATA).toEqual({
      service: 'tiber-teamstate',
      status: 'deployment_scaffold',
      public_reports: [],
      artifact_publication_enabled: false
    });
  });

  it('accepts a well-formed supersession chain terminating in exactly one current entry', () => {
    const registry = [
      entry(1, {
        status: 'superseded',
        superseded_by: 'teamstate_public_offensive_environment_2024_v1.r2'
      }),
      entry(2)
    ];
    expect(validatePublicReportRegistry(registry)).toEqual([]);
  });

  it('flags duplicate currents, dangling pointers, and orphaned superseded entries', () => {
    expect(validatePublicReportRegistry([entry(1), entry(2)]).join(' ')).toMatch(/2 status: "current" entries/);

    const dangling = entry(1, {
      status: 'superseded',
      superseded_by: 'teamstate_public_offensive_environment_2024_v1.r9'
    });
    expect(validatePublicReportRegistry([dangling]).join(' ')).toMatch(/does not resolve/);

    const orphan = entry(1, { status: 'superseded', superseded_by: null });
    expect(validatePublicReportRegistry([orphan]).join(' ')).toMatch(/must name its successor/);
  });

  it('rejects cross-family supersession and malformed entry identity/timestamps', () => {
    const familyB = '/nfl/2023/some-other-report';
    const crossFamily: PublicReportRegistryEntry[] = [
      {
        report_version_id: 'family_a_report.r1',
        canonical_url: CANONICAL,
        version_url: `${CANONICAL}/family_a_report.r1`,
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

    expect(
      validatePublicReportRegistry([entry(1, { published_at: 'sometime last week' })]).join(' ')
    ).toMatch(/malformed published_at/);

    expect(
      validatePublicReportRegistry([entry(1, { version_url: `${CANONICAL}/some-other-id` })]).join(' ')
    ).toMatch(/is not/);
  });

  it('rejects impossible lifecycle topologies: self-supersession, cycles, zero-current families', () => {
    const selfSuperseding = entry(1, {
      status: 'superseded',
      superseded_by: 'teamstate_public_offensive_environment_2024_v1.r1'
    });
    expect(validatePublicReportRegistry([selfSuperseding]).join(' ')).toMatch(/self-supersession is impossible/);

    const cycleA = entry(1, {
      status: 'superseded',
      superseded_by: 'teamstate_public_offensive_environment_2024_v1.r2'
    });
    const cycleB = entry(2, {
      status: 'superseded',
      superseded_by: 'teamstate_public_offensive_environment_2024_v1.r1'
    });
    const cycleErrors = validatePublicReportRegistry([cycleA, cycleB]).join(' ');
    expect(cycleErrors).toMatch(/cycles back to/);
    expect(cycleErrors).toMatch(/no status: "current" entry/);

    // A nonempty family whose every entry is superseded (even without a cycle) is impossible:
    // some entry must currently answer the canonical alias.
    const allSuperseded = [
      entry(1, { status: 'superseded', superseded_by: 'teamstate_public_offensive_environment_2024_v1.r2' }),
      entry(2, { status: 'superseded', superseded_by: 'teamstate_public_offensive_environment_2024_v1.r3' }),
      entry(3, { status: 'superseded', superseded_by: 'teamstate_public_offensive_environment_2024_v1.r1' })
    ];
    expect(validatePublicReportRegistry(allSuperseded).join(' ')).toMatch(/no status: "current" entry/);
  });

  it('resolveCurrentRegistryEntry fails closed to null on empty or ambiguous registries', () => {
    const single: TeamstateServiceMetadata = {
      ...LIVE_SERVICE_METADATA,
      artifact_publication_enabled: true,
      public_reports: [entry(1)]
    };
    expect(resolveCurrentRegistryEntry(single, CANONICAL)?.report_version_id).toBe(
      'teamstate_public_offensive_environment_2024_v1.r1'
    );
    expect(resolveCurrentRegistryEntry(LIVE_SERVICE_METADATA, CANONICAL)).toBeNull();

    const ambiguous: TeamstateServiceMetadata = {
      ...single,
      public_reports: [entry(1), entry(2)]
    };
    expect(resolveCurrentRegistryEntry(ambiguous, CANONICAL)).toBeNull();
  });
});
