import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUBLIC_REPORT_2024_CANONICAL_URL_HTML } from './contracts/teamstatePublicOffensiveEnvironment2024V1.js';
import type { PublicReport2024Payload } from './contracts/teamstatePublicOffensiveEnvironment2024V1.js';
import {
  computeSha256Hex,
  serializePublicReport2024Payload
} from './reports/publicOffensiveEnvironment2024Report.js';
import {
  validatePublicReport2024,
  type PublicationApprovalRecord
} from './reports/publicOffensiveEnvironment2024Validator.js';
import {
  LIVE_SERVICE_METADATA,
  resolveCurrentRegistryEntry,
  validatePublicReportRegistry,
  type PublicReportRegistryEntry,
  type TeamstateServiceMetadata
} from './reports/publicReportRegistry.js';

const SERVICE_NAME = 'tiber-teamstate';

const HTML_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TIBER-Teamstate</title>
</head>
<body>
  <h1>TIBER-Teamstate</h1>
  <p>This is the TIBER-Teamstate public pilot. The service is online.</p>
  <p>Public football reports are not yet published. Internal repository artifacts are not
  automatically public.</p>
  <p><code>/healthz</code> is available for deployment checks.</p>
  <p>Future public routes remain subject to the publication eligibility contract.</p>
</body>
</html>
`;

/** Frozen, byte-stable content for one published report version (§6): never mutated after publish. */
export interface FrozenPublicReportRecord {
  readonly reportVersionId: string;
  readonly json: string;
  readonly html: string;
  /** Digests retained from the validator's content binding at publication time. */
  readonly jsonSha256: string;
  readonly htmlSha256: string;
}

/**
 * Encapsulated frozen-content store (§6, §8 invariant 9). Records live in a `#`-private map as
 * `Object.freeze`d values with their validated digests retained; there is no mutation or removal
 * API, registration never overwrites, registration verifies the bytes against the digests, and
 * resolution re-verifies both the retained digests and the content's own declared identity before
 * anything is served. The immutable identity binds the bytes, not just the id printed inside them.
 */
export class FrozenPublicReportStore {
  readonly #records = new Map<string, FrozenPublicReportRecord>();

  /**
   * Register validated frozen content under its version id. The bytes must match the supplied
   * digests (the validator's binding), and an already-registered id is never overwritten.
   */
  register(record: FrozenPublicReportRecord): void {
    if (this.#records.has(record.reportVersionId)) {
      throw new Error(
        `frozen store refused: content already exists for ${record.reportVersionId} and is never overwritten (§6).`
      );
    }
    if (computeSha256Hex(record.json) !== record.jsonSha256) {
      throw new Error(`frozen store refused: JSON bytes for ${record.reportVersionId} do not match the validated digest.`);
    }
    if (computeSha256Hex(record.html) !== record.htmlSha256) {
      throw new Error(`frozen store refused: HTML bytes for ${record.reportVersionId} do not match the validated digest.`);
    }
    this.#records.set(record.reportVersionId, Object.freeze({ ...record }));
  }

  /** Pure-functional successor store: this store's records plus one newly registered record. */
  withRegistered(record: FrozenPublicReportRecord): FrozenPublicReportStore {
    const next = new FrozenPublicReportStore();
    for (const [id, existing] of this.#records) {
      next.#records.set(id, existing);
    }
    next.register(record);
    return next;
  }

  has(reportVersionId: string): boolean {
    return this.#records.has(reportVersionId);
  }

  get size(): number {
    return this.#records.size;
  }

  /**
   * Resolve frozen content for serving, failing closed to null unless the retained digests still
   * match the bytes and the content itself declares exactly this version.
   */
  resolve(reportVersionId: string): FrozenPublicReportRecord | null {
    const record = this.#records.get(reportVersionId);
    if (record === undefined || record.reportVersionId !== reportVersionId) {
      return null;
    }
    if (computeSha256Hex(record.json) !== record.jsonSha256 || computeSha256Hex(record.html) !== record.htmlSha256) {
      return null;
    }
    try {
      const declared = (JSON.parse(record.json) as { report_version_id?: unknown }).report_version_id;
      if (declared !== reportVersionId) {
        return null;
      }
    } catch {
      return null;
    }
    if (!record.html.includes(`data-report-version-id="${reportVersionId}"`)) {
      return null;
    }
    return record;
  }
}

/**
 * Everything report serving may read: the mutable registry (`service-metadata.json` state) and the
 * encapsulated frozen per-version content store. Registry changes never touch frozen content —
 * serving a version URL therefore stays byte-identical across current/superseded flips (§6, §8
 * invariant 9).
 */
export interface PublicReportServingState {
  serviceMetadata: TeamstateServiceMetadata;
  frozenReports: FrozenPublicReportStore;
}

/**
 * The live deployment state: deployment scaffold, empty registry, publication disabled, no frozen
 * content. Every public-report route fails closed (404) in this state — no partial,
 * fixture-backed, candidate, or best-effort report is ever served pre-approval.
 */
export const LIVE_PUBLIC_REPORT_SERVING_STATE: PublicReportServingState = {
  serviceMetadata: LIVE_SERVICE_METADATA,
  frozenReports: new FrozenPublicReportStore()
};

/** Raw materials for a publication — validation happens INSIDE the publisher, not before it. */
export interface PublicReportPublicationRequest {
  payload: PublicReport2024Payload;
  html: string;
  /** The committed governed source bytes — handed to the internal validation as its root of trust. */
  governedSourceBytes: Buffer;
  /** The recorded explicit human approval for exactly this payload's `report_version_id`. */
  approval: PublicationApprovalRecord;
  /** ISO-8601 timestamp recorded on the registry entry. */
  publishedAt: string;
}

const PUBLISHED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/** Atomic same-family current→superseded flip; throws rather than producing an invalid registry. */
function applyRegistrySupersession(
  metadata: TeamstateServiceMetadata,
  entry: Omit<PublicReportRegistryEntry, 'status' | 'superseded_by'>
): TeamstateServiceMetadata {
  const successorRegistry: PublicReportRegistryEntry[] = [
    ...metadata.public_reports.map((existing) =>
      existing.canonical_url === entry.canonical_url && existing.status === 'current'
        ? { ...existing, status: 'superseded' as const, superseded_by: entry.report_version_id }
        : { ...existing }
    ),
    { ...entry, status: 'current', superseded_by: null }
  ];
  const errors = validatePublicReportRegistry(successorRegistry);
  if (errors.length > 0) {
    throw new Error(`publication refused: successor registry would be invalid: ${errors.join('; ')}`);
  }
  return { ...metadata, public_reports: successorRegistry, artifact_publication_enabled: true };
}

/**
 * Atomically publish one report version from raw materials. This is the ONLY publication path,
 * and it is not evidence-driven: `validatePublicReport2024` is invoked HERE, internally, on the
 * exact payload/HTML/governed bytes being published — there is no caller-suppliable "successful
 * validation" object to construct, mutate, or replay. The registry entry's canonical/version
 * identities are likewise derived internally from the contract (a validated report can never be
 * registered under another family), the atomic current→superseded flip is checked against the
 * full registry validator, and the frozen content is registered in the encapsulated store under
 * the validator's own content-binding digests. Throws (publishing nothing) on any failure.
 */
export function publishPublicReportVersion(
  state: PublicReportServingState,
  request: PublicReportPublicationRequest
): PublicReportServingState {
  const { payload, html, governedSourceBytes, approval, publishedAt } = request;
  const reportVersionId = payload.report_version_id;

  if (typeof publishedAt !== 'string' || !PUBLISHED_AT_PATTERN.test(publishedAt) || !Number.isFinite(Date.parse(publishedAt))) {
    throw new Error(`publication refused: publishedAt ${String(publishedAt)} is not a valid ISO-8601 timestamp.`);
  }
  if (state.frozenReports.has(reportVersionId)) {
    throw new Error(
      `publication refused: frozen content already exists for ${reportVersionId} and is never overwritten; ` +
        'a changed regeneration must mint a new report_version_id (§6).'
    );
  }
  if (state.serviceMetadata.public_reports.some((entry) => entry.report_version_id === reportVersionId)) {
    throw new Error(
      `publication refused: report_version_id ${reportVersionId} is already registered; a changed regeneration ` +
        'must mint a new report_version_id (§6).'
    );
  }

  // The internal, non-bypassable case-#20 gate (§8 invariant 12; §10 — only case #20 publishes).
  const validation = validatePublicReport2024(payload, {
    governedSourceBytes,
    html,
    registry: state.serviceMetadata,
    approvals: [approval]
  });
  if (!validation.publishable || validation.binding === null) {
    throw new Error(
      `publication refused: internal validation rejected ${reportVersionId} with ` +
        `[${validation.rejections.map((rejection) => rejection.code).join(', ')}]; only a full case-#20 pass publishes.`
    );
  }
  const binding = validation.binding;

  // Registry identities are derived from the contract, never caller-supplied: the offensive-
  // environments payload can only ever be registered under the offensive-environments family.
  const serviceMetadata = applyRegistrySupersession(state.serviceMetadata, {
    report_version_id: reportVersionId,
    canonical_url: PUBLIC_REPORT_2024_CANONICAL_URL_HTML,
    version_url: `${PUBLIC_REPORT_2024_CANONICAL_URL_HTML}/${reportVersionId}`,
    published_at: publishedAt
  });

  const json = serializePublicReport2024Payload(payload);
  const frozenReports = state.frozenReports.withRegistered({
    reportVersionId,
    json,
    html,
    jsonSha256: binding.json_sha256,
    htmlSha256: binding.html_sha256
  });

  return { serviceMetadata, frozenReports };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function sendHtml(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

/** Serve pre-serialized frozen JSON bytes verbatim, so published content stays byte-stable. */
function sendFrozenJson(res: ServerResponse, body: string): void {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function sendNotFound(res: ServerResponse): void {
  sendJson(res, 404, { status: 'not_found' });
}

/**
 * Resolve a public-report route to frozen content, failing closed on every gap: publication
 * disabled, invalid registry, no unambiguous current entry, unknown version id, family mismatch,
 * or frozen content that fails its digest/identity re-verification.
 */
function resolvePublicReportRoute(
  state: PublicReportServingState,
  pathname: string
): { content: FrozenPublicReportRecord; format: 'html' | 'json' } | null {
  const { serviceMetadata, frozenReports } = state;
  if (serviceMetadata.artifact_publication_enabled !== true) {
    return null;
  }
  // An invalid registry (e.g. two "current" entries for one family) serves nothing at all —
  // fail closed on every report route rather than guessing which entry the operator meant.
  if (validatePublicReportRegistry(serviceMetadata.public_reports).length > 0) {
    return null;
  }

  const resolveVersion = (reportVersionId: string, format: 'html' | 'json') => {
    // Only registered versions are servable — frozen content alone (e.g. a candidate or fixture)
    // must never be reachable without its registry entry — and the entry must belong to THIS
    // report family: a structurally valid entry registered under another canonical_url must not
    // be reachable through the offensive-environments identity.
    const entry = serviceMetadata.public_reports.find(
      (candidate) =>
        candidate.report_version_id === reportVersionId &&
        candidate.canonical_url === PUBLIC_REPORT_2024_CANONICAL_URL_HTML &&
        candidate.version_url === `${PUBLIC_REPORT_2024_CANONICAL_URL_HTML}/${reportVersionId}`
    );
    if (entry === undefined) {
      return null;
    }
    // The store re-verifies retained digests and the content's own declared identity (§8 inv. 9).
    const content = frozenReports.resolve(reportVersionId);
    return content === null ? null : { content, format };
  };

  if (pathname === PUBLIC_REPORT_2024_CANONICAL_URL_HTML || pathname === `${PUBLIC_REPORT_2024_CANONICAL_URL_HTML}.json`) {
    const currentEntry = resolveCurrentRegistryEntry(serviceMetadata, PUBLIC_REPORT_2024_CANONICAL_URL_HTML);
    if (currentEntry === null) {
      return null;
    }
    return resolveVersion(currentEntry.report_version_id, pathname.endsWith('.json') ? 'json' : 'html');
  }

  const versionPrefix = `${PUBLIC_REPORT_2024_CANONICAL_URL_HTML}/`;
  if (pathname.startsWith(versionPrefix)) {
    const rest = pathname.slice(versionPrefix.length);
    if (rest.length === 0 || rest.includes('/')) {
      return null;
    }
    const format = rest.endsWith('.json') ? 'json' : 'html';
    const reportVersionId = format === 'json' ? rest.slice(0, -'.json'.length) : rest;
    if (reportVersionId.length === 0) {
      return null;
    }
    return resolveVersion(reportVersionId, format);
  }

  return null;
}

export function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  state: PublicReportServingState = LIVE_PUBLIC_REPORT_SERVING_STATE
): void {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/healthz') {
    sendJson(res, 200, { status: 'ok', service: SERVICE_NAME });
    return;
  }

  if (url.pathname === '/service-metadata.json') {
    sendJson(res, 200, state.serviceMetadata);
    return;
  }

  if (
    url.pathname === PUBLIC_REPORT_2024_CANONICAL_URL_HTML ||
    url.pathname.startsWith(`${PUBLIC_REPORT_2024_CANONICAL_URL_HTML}.json`) ||
    url.pathname.startsWith(`${PUBLIC_REPORT_2024_CANONICAL_URL_HTML}/`)
  ) {
    const resolved = resolvePublicReportRoute(state, url.pathname);
    if (resolved === null) {
      sendNotFound(res);
      return;
    }
    if (resolved.format === 'json') {
      sendFrozenJson(res, resolved.content.json);
    } else {
      sendHtml(res, 200, resolved.content.html);
    }
    return;
  }

  if (url.pathname === '/') {
    sendHtml(res, 200, HTML_PAGE);
    return;
  }

  sendNotFound(res);
}

export function createTeamstateServer(state: PublicReportServingState = LIVE_PUBLIC_REPORT_SERVING_STATE) {
  return createServer((req, res) => handleRequest(req, res, state));
}

export const isDirectExecution = (metaUrl: string, argvPath: string | undefined): boolean => {
  if (!argvPath) {
    return false;
  }

  const moduleFilePath = path.normalize(path.resolve(fileURLToPath(metaUrl)));
  const entryFilePath = path.normalize(path.resolve(argvPath));

  return moduleFilePath === entryFilePath;
};

if (isDirectExecution(import.meta.url, process.argv[1])) {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const host = '0.0.0.0';

  const server = createTeamstateServer();
  server.listen(port, host, () => {
    console.log(`${SERVICE_NAME} listening on http://${host}:${port}`);
  });
}
