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

const REGISTRY_ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

const isRegistryIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && REGISTRY_ISO_TIMESTAMP_PATTERN.test(value) && Number.isFinite(Date.parse(value));

/** §8 invariant 11 registry validation. Returns every problem found (empty array = valid). */
export const validatePublicReportRegistry = (entries: readonly PublicReportRegistryEntry[]): string[] => {
  const errors: string[] = [];
  const knownIds = new Set(entries.map((entry) => entry.report_version_id));
  if (knownIds.size !== entries.length) {
    errors.push('registry contains duplicate report_version_id entries');
  }
  const entriesById = new Map(entries.map((entry) => [entry.report_version_id, entry]));

  const currentByFamily = new Map<string, number>();
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
 * The complete evidence the publication transition requires (§8 invariant 12, §10 case #20):
 * a fully successful validation result for the exact candidate (zero rejections — a case-#20
 * outcome, produced by `validatePublicReport2024` with its complete evidence package, carrying
 * the validator's internally generated content binding) and the recorded explicit human approval
 * for the exact `report_version_id` being published. Structural types are used (not the
 * validator's own) to keep this module dependency-free; the fields carry the validator's result
 * and approval record verbatim.
 */
export interface PublicReportPublicationEvidence {
  validation: {
    publishable: boolean;
    rejections: ReadonlyArray<unknown>;
    /**
     * The validator's internally generated binding: exact `report_version_id` plus sha256 digests
     * of the canonical JSON and validated HTML. Required — it is what makes a case-#20 result
     * non-transferable to any other version or content.
     */
    binding: {
      report_version_id: string;
      json_sha256: string;
      html_sha256: string;
    } | null;
  };
  approval: {
    report_version_id: string;
    approved_by: string;
    approved_at: string;
  };
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

const PUBLICATION_ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

const isWellFormedApproval = (approval: PublicReportPublicationEvidence['approval']): boolean =>
  typeof approval.report_version_id === 'string' &&
  approval.report_version_id.length > 0 &&
  typeof approval.approved_by === 'string' &&
  approval.approved_by.trim().length > 0 &&
  typeof approval.approved_at === 'string' &&
  PUBLICATION_ISO_TIMESTAMP_PATTERN.test(approval.approved_at) &&
  Number.isFinite(Date.parse(approval.approved_at));

/**
 * Atomically publish `entry` as the current version of its report family, flipping any prior
 * current entry to `superseded` (with `superseded_by` pointing at the new version) in the same
 * pure step. Returns a new metadata value; never mutates the input, and never touches frozen
 * report payloads. Throws (publishing nothing) rather than returning an invalid registry.
 *
 * This is the ONLY path that may set `artifact_publication_enabled: true`, and it is gated on
 * `evidence`: a complete, successful (zero-rejection) validation result plus a well-formed
 * explicit human approval for exactly `entry.report_version_id`. Anything less throws — a
 * validator pass alone is necessary but not sufficient, and an approval alone proves nothing
 * about the payload (§8 invariant 12; §10 case #20 is the only publishable state).
 */
export const applyPublicReportPublication = (
  metadata: TeamstateServiceMetadata,
  entry: PublicReportPublicationInput,
  evidence: PublicReportPublicationEvidence
): TeamstateServiceMetadata => {
  if (evidence.validation.publishable !== true || evidence.validation.rejections.length !== 0) {
    throw new Error(
      `registry publication refused: validation evidence for ${entry.report_version_id} is not a complete ` +
        `case-#20 success (publishable=${String(evidence.validation.publishable)}, ` +
        `${evidence.validation.rejections.length} rejection(s)); publication requires zero rejections.`
    );
  }
  const binding = evidence.validation.binding;
  if (
    binding === null ||
    typeof binding.json_sha256 !== 'string' ||
    !SHA256_HEX.test(binding.json_sha256) ||
    typeof binding.html_sha256 !== 'string' ||
    !SHA256_HEX.test(binding.html_sha256)
  ) {
    throw new Error(
      `registry publication refused: validation evidence for ${entry.report_version_id} carries no well-formed ` +
        'content binding; only a validator-generated case-#20 result can publish.'
    );
  }
  if (binding.report_version_id !== entry.report_version_id) {
    throw new Error(
      `registry publication refused: validation evidence is bound to report_version_id ` +
        `${binding.report_version_id}, but the entry being published is ${entry.report_version_id}; ` +
        'a validation result is never transferable across versions.'
    );
  }
  if (!isWellFormedApproval(evidence.approval)) {
    throw new Error(
      `registry publication refused: approval record for ${entry.report_version_id} is malformed; ` +
        'approved_by must be a non-empty identity and approved_at a valid ISO-8601 timestamp (§8 invariant 12).'
    );
  }
  if (evidence.approval.report_version_id !== entry.report_version_id) {
    throw new Error(
      `registry publication refused: approval names report_version_id ${evidence.approval.report_version_id}, ` +
        `but the entry being published is ${entry.report_version_id}; approval is exact-version, never transferable.`
    );
  }
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
