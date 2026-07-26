/**
 * Mutable public-report registry (contract §6): current/superseded status and successor pointers
 * live exclusively in `service-metadata.json`'s `public_reports` array — never inside a frozen
 * report payload.
 *
 * This module holds the registry data model and its fail-closed validation only. The publication
 * transition itself lives in `publishPublicReportVersion` (`src/server.ts`), which invokes the
 * report validator INTERNALLY on the raw materials being published — there is deliberately no
 * exported function that accepts a caller-asserted validation result and flips the registry, so
 * a "successful validation" cannot be constructed or replayed into the publication path.
 *
 * The live service state remains the deployment scaffold — empty registry, publication disabled —
 * until a separate, explicit operator approval for an exact `report_version_id`.
 */

export interface PublicReportRegistryEntry {
  readonly report_version_id: string;
  /** Family identity: the canonical HTML alias (e.g. `/nfl/2024/offensive-environments`). */
  readonly canonical_url: string;
  readonly version_url: string;
  readonly status: 'current' | 'superseded';
  readonly superseded_by: string | null;
  readonly published_at: string;
}

export interface TeamstateServiceMetadata {
  readonly service: string;
  readonly status: string;
  readonly public_reports: readonly PublicReportRegistryEntry[];
  readonly artifact_publication_enabled: boolean;
}

/**
 * Return a detached, deeply frozen registry snapshot. The registry is mutable only by replacement:
 * a publication transition creates a new frozen snapshot rather than exposing write authority to
 * a server or caller that already holds an earlier state.
 */
export const freezeTeamstateServiceMetadata = (
  metadata: TeamstateServiceMetadata
): TeamstateServiceMetadata => {
  const publicReports = Object.freeze(
    metadata.public_reports.map((entry) => Object.freeze({ ...entry }))
  );
  return Object.freeze({ ...metadata, public_reports: publicReports });
};

/**
 * The live service state: deployment scaffold, no published reports, publication disabled. This is
 * the only state the deployed service may serve until an explicit, recorded operator approval for
 * a specific `report_version_id` (§8 invariant 12).
 */
export const LIVE_SERVICE_METADATA: TeamstateServiceMetadata = freezeTeamstateServiceMetadata({
  service: 'tiber-teamstate',
  status: 'deployment_scaffold',
  public_reports: [],
  artifact_publication_enabled: false
});

const REGISTRY_ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

const isRegistryIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && REGISTRY_ISO_TIMESTAMP_PATTERN.test(value) && Number.isFinite(Date.parse(value));

/**
 * §8 invariant 11 registry validation. Returns every problem found (empty array = valid).
 *
 * Beyond per-entry shape/identity, the registry's supersession topology must describe a possible
 * lifecycle: no entry supersedes itself, successor chains are acyclic and stay inside one family,
 * and every nonempty family has exactly one `current` entry that terminates its chains.
 */
export const validatePublicReportRegistry = (entries: readonly PublicReportRegistryEntry[]): string[] => {
  const errors: string[] = [];
  const knownIds = new Set(entries.map((entry) => entry.report_version_id));
  if (knownIds.size !== entries.length) {
    errors.push('registry contains duplicate report_version_id entries');
  }
  const entriesById = new Map(entries.map((entry) => [entry.report_version_id, entry]));

  const currentByFamily = new Map<string, number>();
  const entriesByFamily = new Map<string, number>();
  for (const entry of entries) {
    // Complete entry shape/identity: a malformed entry must invalidate the whole registry rather
    // than be partially honored by resolution or serving logic.
    if (
      typeof entry.report_version_id !== 'string' ||
      entry.report_version_id.length === 0 ||
      typeof entry.canonical_url !== 'string' ||
      entry.canonical_url.length === 0 ||
      typeof entry.version_url !== 'string' ||
      entry.version_url.length === 0
    ) {
      errors.push('registry entry is missing report_version_id/canonical_url/version_url');
      continue;
    }
    entriesByFamily.set(entry.canonical_url, (entriesByFamily.get(entry.canonical_url) ?? 0) + 1);
    if (entry.version_url !== `${entry.canonical_url}/${entry.report_version_id}`) {
      errors.push(
        `entry ${entry.report_version_id} has version_url ${entry.version_url}, which is not ` +
          `${entry.canonical_url}/${entry.report_version_id}`
      );
    }
    if (!isRegistryIsoTimestamp(entry.published_at)) {
      errors.push(`entry ${entry.report_version_id} has a malformed published_at (${String(entry.published_at)})`);
    }
    if (entry.status !== 'current' && entry.status !== 'superseded') {
      errors.push(`entry ${entry.report_version_id} has invalid status ${String(entry.status)}`);
    }

    if (entry.status === 'current') {
      currentByFamily.set(entry.canonical_url, (currentByFamily.get(entry.canonical_url) ?? 0) + 1);
      if (entry.superseded_by !== null) {
        errors.push(`current entry ${entry.report_version_id} must have superseded_by: null`);
      }
    } else if (entry.superseded_by === null) {
      errors.push(`superseded entry ${entry.report_version_id} must name its successor in superseded_by`);
    }
    if (entry.superseded_by !== null) {
      if (entry.superseded_by === entry.report_version_id) {
        errors.push(`entry ${entry.report_version_id} names itself as superseded_by; self-supersession is impossible`);
      }
      const successor = entriesById.get(entry.superseded_by);
      if (successor === undefined) {
        errors.push(
          `entry ${entry.report_version_id} names superseded_by ${entry.superseded_by}, which does not resolve ` +
            'to a real report_version_id in the registry'
        );
      } else if (successor.canonical_url !== entry.canonical_url) {
        errors.push(
          `entry ${entry.report_version_id} (family ${entry.canonical_url}) names superseded_by ` +
            `${entry.superseded_by}, which belongs to a different family (${successor.canonical_url}); ` +
            'supersession never crosses report families'
        );
      }
    }
  }

  // Successor chains must be acyclic (they must eventually terminate at a current entry or a
  // detectable dangling pointer, never loop back).
  for (const entry of entries) {
    if (entry.superseded_by === null) {
      continue;
    }
    const seen = new Set<string>([entry.report_version_id]);
    let cursor: string | null = entry.superseded_by;
    while (cursor !== null) {
      if (seen.has(cursor)) {
        errors.push(
          `supersession chain starting at ${entry.report_version_id} cycles back to ${cursor}; ` +
            'successor chains must be acyclic and terminate at a current entry'
        );
        break;
      }
      seen.add(cursor);
      const next: PublicReportRegistryEntry | undefined = entriesById.get(cursor);
      if (next === undefined) {
        break; // Dangling pointer — already reported above.
      }
      cursor = next.superseded_by;
    }
  }

  // Every nonempty family has exactly one current entry: zero currents (all superseded) is an
  // impossible lifecycle state, more than one is ambiguous resolution.
  for (const [family, entryCount] of entriesByFamily) {
    const currentCount = currentByFamily.get(family) ?? 0;
    if (entryCount > 0 && currentCount === 0) {
      errors.push(`report family ${family} has ${entryCount} entr(ies) but no status: "current" entry`);
    }
    if (currentCount > 1) {
      errors.push(`registry names ${currentCount} status: "current" entries for report family ${family}`);
    }
  }
  return errors;
};

/** Resolve the current entry for a report family (`canonical_url`), or null when none exists. */
export const resolveCurrentRegistryEntry = (
  metadata: TeamstateServiceMetadata,
  canonicalUrl: string
): PublicReportRegistryEntry | null => {
  const current = metadata.public_reports.filter(
    (entry) => entry.canonical_url === canonicalUrl && entry.status === 'current'
  );
  // Fail closed on an invalid registry: an ambiguous "current" must resolve to nothing served.
  return current.length === 1 ? current[0] : null;
};
