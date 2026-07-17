/**
 * Mutable public-report registry (contract §6): current/superseded status and successor pointers
 * live exclusively in `service-metadata.json`'s `public_reports` array — never inside a frozen
 * report payload.
 *
 * Supersession is atomic by construction: `applyPublicReportPublication` builds the complete
 * successor registry (new entry `current`, prior entry flipped to `superseded` with its
 * `superseded_by` set) as one pure value, validated before it is returned — there is no
 * intermediate state where two entries are `current` for the same report family.
 *
 * The live service state remains the deployment scaffold — empty registry, publication disabled —
 * until a separate, explicit operator approval for an exact `report_version_id`.
 */

export interface PublicReportRegistryEntry {
  report_version_id: string;
  /** Family identity: the canonical HTML alias (e.g. `/nfl/2024/offensive-environments`). */
  canonical_url: string;
  version_url: string;
  status: 'current' | 'superseded';
  superseded_by: string | null;
  published_at: string;
}

export interface TeamstateServiceMetadata {
  service: string;
  status: string;
  public_reports: PublicReportRegistryEntry[];
  artifact_publication_enabled: boolean;
}

/**
 * The live service state: deployment scaffold, no published reports, publication disabled. This is
 * the only state the deployed service may serve until an explicit, recorded operator approval for
 * a specific `report_version_id` (§8 invariant 12).
 */
export const LIVE_SERVICE_METADATA: TeamstateServiceMetadata = {
  service: 'tiber-teamstate',
  status: 'deployment_scaffold',
  public_reports: [],
  artifact_publication_enabled: false
};

/** §8 invariant 11 registry validation. Returns every problem found (empty array = valid). */
export const validatePublicReportRegistry = (entries: readonly PublicReportRegistryEntry[]): string[] => {
  const errors: string[] = [];
  const knownIds = new Set(entries.map((entry) => entry.report_version_id));
  if (knownIds.size !== entries.length) {
    errors.push('registry contains duplicate report_version_id entries');
  }

  const currentByFamily = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status === 'current') {
      currentByFamily.set(entry.canonical_url, (currentByFamily.get(entry.canonical_url) ?? 0) + 1);
      if (entry.superseded_by !== null) {
        errors.push(`current entry ${entry.report_version_id} must have superseded_by: null`);
      }
    } else if (entry.superseded_by === null) {
      errors.push(`superseded entry ${entry.report_version_id} must name its successor in superseded_by`);
    }
    if (entry.superseded_by !== null && !knownIds.has(entry.superseded_by)) {
      errors.push(
        `entry ${entry.report_version_id} names superseded_by ${entry.superseded_by}, which does not resolve ` +
          'to a real report_version_id in the registry'
      );
    }
  }
  for (const [family, count] of currentByFamily) {
    if (count > 1) {
      errors.push(`registry names ${count} status: "current" entries for report family ${family}`);
    }
  }
  return errors;
};

export interface PublicReportPublicationInput {
  report_version_id: string;
  canonical_url: string;
  version_url: string;
  published_at: string;
}

/**
 * Atomically publish `entry` as the current version of its report family, flipping any prior
 * current entry to `superseded` (with `superseded_by` pointing at the new version) in the same
 * pure step. Returns a new metadata value; never mutates the input, and never touches frozen
 * report payloads. Throws (publishing nothing) rather than returning an invalid registry.
 */
export const applyPublicReportPublication = (
  metadata: TeamstateServiceMetadata,
  entry: PublicReportPublicationInput
): TeamstateServiceMetadata => {
  if (metadata.public_reports.some((existing) => existing.report_version_id === entry.report_version_id)) {
    throw new Error(
      `registry publication refused: report_version_id ${entry.report_version_id} is already registered; ` +
        'a changed regeneration must mint a new report_version_id (§6).'
    );
  }

  const successorRegistry: PublicReportRegistryEntry[] = [
    ...metadata.public_reports.map((existing) =>
      existing.canonical_url === entry.canonical_url && existing.status === 'current'
        ? { ...existing, status: 'superseded' as const, superseded_by: entry.report_version_id }
        : { ...existing }
    ),
    {
      report_version_id: entry.report_version_id,
      canonical_url: entry.canonical_url,
      version_url: entry.version_url,
      status: 'current',
      superseded_by: null,
      published_at: entry.published_at
    }
  ];

  const errors = validatePublicReportRegistry(successorRegistry);
  if (errors.length > 0) {
    throw new Error(`registry publication refused: successor registry is invalid: ${errors.join('; ')}`);
  }

  return {
    ...metadata,
    public_reports: successorRegistry,
    artifact_publication_enabled: true
  };
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
