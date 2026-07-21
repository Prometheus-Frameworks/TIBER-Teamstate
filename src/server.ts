import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PUBLIC_REPORT_2024_CANONICAL_URL_HTML,
  PUBLIC_REPORT_2024_CANONICAL_URL_JSON,
  TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_ARTIFACT,
  TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_SCHEMA_VERSION,
  buildPublicReport2024VersionUrlJson
} from './contracts/teamstatePublicOffensiveEnvironment2024V1.js';
import type { PublicReport2024Payload } from './contracts/teamstatePublicOffensiveEnvironment2024V1.js';
import {
  computeSha256Hex,
  serializePublicReport2024Payload
} from './reports/publicOffensiveEnvironment2024Report.js';
import { validatePublicReport2024 } from './reports/publicOffensiveEnvironment2024Validator.js';
import { renderPublicReport2024Html } from './reports/publicOffensiveEnvironment2024Html.js';
import { lookupRecordedPublicReportPublicationApproval } from './reports/publicReportPublicationApprovals.js';
import {
  freezeTeamstateServiceMetadata,
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

/** Read-only access to byte-stable content for already-published versions. */
export interface FrozenPublicReportStoreView {
  readonly size: number;
  has(reportVersionId: string): boolean;
  resolve(reportVersionId: string): FrozenPublicReportRecord | null;
}

const FROZEN_REPORT_STORE_TOKEN = Symbol('tiber-teamstate-frozen-report-store');
const FROZEN_REPORT_RECORDS = new WeakMap<FrozenPublicReportStore, ReadonlyMap<string, FrozenPublicReportRecord>>();

/** Re-check frozen digests, family identity, and JSON/HTML parity at the final serving boundary. */
const verifyFrozenPublicReportRecord = (
  reportVersionId: string,
  record: FrozenPublicReportRecord | null
): FrozenPublicReportRecord | null => {
  if (record === null) {
    return null;
  }

  // Capture every field once. A deliberately supplied structural view may implement fields as
  // getters; verification and the eventual response must use the same immutable values.
  const snapshot: FrozenPublicReportRecord = Object.freeze({
    reportVersionId: record.reportVersionId,
    json: record.json,
    html: record.html,
    jsonSha256: record.jsonSha256,
    htmlSha256: record.htmlSha256
  });
  if (snapshot.reportVersionId !== reportVersionId) {
    return null;
  }
  if (
    computeSha256Hex(snapshot.json) !== snapshot.jsonSha256 ||
    computeSha256Hex(snapshot.html) !== snapshot.htmlSha256
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(snapshot.json) as PublicReport2024Payload;
    if (
      payload.report_version_id !== reportVersionId ||
      payload.artifact !== TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_ARTIFACT ||
      payload.schema_version !== TEAMSTATE_PUBLIC_OFFENSIVE_ENVIRONMENT_2024_V1_SCHEMA_VERSION ||
      payload.canonical_url !== PUBLIC_REPORT_2024_CANONICAL_URL_JSON ||
      payload.version_url !== buildPublicReport2024VersionUrlJson(reportVersionId) ||
      renderPublicReport2024Html(payload) !== snapshot.html
    ) {
      return null;
    }
  } catch {
    return null;
  }
  if (!snapshot.html.includes(`data-report-version-id="${reportVersionId}"`)) {
    return null;
  }
  return snapshot;
};

/** Read-only store implementation. Membership writes are deliberately module-private. */
class FrozenPublicReportStore implements FrozenPublicReportStoreView {
  constructor(
    token: typeof FROZEN_REPORT_STORE_TOKEN,
    records: ReadonlyMap<string, FrozenPublicReportRecord> = new Map()
  ) {
    if (token !== FROZEN_REPORT_STORE_TOKEN) {
      throw new Error('frozen report store construction is not internally authorized');
    }
    FROZEN_REPORT_RECORDS.set(this, records);
    Object.freeze(this);
  }

  #records(): ReadonlyMap<string, FrozenPublicReportRecord> {
    const records = FROZEN_REPORT_RECORDS.get(this);
    if (records === undefined) {
      throw new Error('frozen report store is not an internally constructed store');
    }
    return records;
  }

  has(reportVersionId: string): boolean {
    return this.#records().has(reportVersionId);
  }

  get size(): number {
    return this.#records().size;
  }

  /**
   * Resolve frozen content for serving, failing closed to null unless the retained digests still
   * match the bytes and the content itself declares exactly this version.
   */
  resolve(reportVersionId: string): FrozenPublicReportRecord | null {
    return verifyFrozenPublicReportRecord(reportVersionId, this.#records().get(reportVersionId) ?? null);
  }
}

// The instance is frozen in the constructor; freezing the shared prototype prevents a holder of a
// read-only view from replacing `resolve` for every internally constructed store.
Object.freeze(FrozenPublicReportStore.prototype);

/**
 * Module-private membership transition. Only the internally validating publisher can call this
 * helper; callers receive a read-only view with no register/remove/replace operation.
 */
const withValidatedFrozenReport = (
  store: FrozenPublicReportStoreView,
  record: FrozenPublicReportRecord
): FrozenPublicReportStore => {
  if (!(store instanceof FrozenPublicReportStore)) {
    throw new Error('publication refused: frozen report store is not an internally constructed store');
  }
  const records = FROZEN_REPORT_RECORDS.get(store);
  if (records === undefined) {
    throw new Error('publication refused: frozen report store state is unavailable');
  }
  if (records.has(record.reportVersionId)) {
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
  const successor = new Map(records);
  successor.set(record.reportVersionId, Object.freeze({ ...record }));
  return new FrozenPublicReportStore(FROZEN_REPORT_STORE_TOKEN, successor);
};

/**
 * Everything report serving may read: a replace-only, deeply frozen registry snapshot and the
 * encapsulated frozen per-version content store. Registry transitions never touch earlier frozen
 * content, so a version URL stays byte-identical across current/superseded flips (§6, §8 invariant
 * 9).
 */
export interface PublicReportServingState {
  readonly serviceMetadata: TeamstateServiceMetadata;
  readonly frozenReports: FrozenPublicReportStoreView;
}

/**
 * The live deployment state: deployment scaffold, empty registry, publication disabled, no frozen
 * content. Every public-report route fails closed (404) in this state — no partial,
 * fixture-backed, candidate, or best-effort report is ever served pre-approval.
 */
export const createEmptyPublicReportServingState = (): PublicReportServingState =>
  Object.freeze({
    serviceMetadata: LIVE_SERVICE_METADATA,
    frozenReports: new FrozenPublicReportStore(FROZEN_REPORT_STORE_TOKEN)
  });

/** Raw materials for a publication — validation happens INSIDE the publisher, not before it. */
export interface PublicReportPublicationRequest {
  payload: PublicReport2024Payload;
  html: string;
  /** The committed governed source bytes — handed to the internal validation as its root of trust. */
  governedSourceBytes: Buffer;
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
  return freezeTeamstateServiceMetadata({
    ...metadata,
    public_reports: successorRegistry,
    artifact_publication_enabled: true
  });
}

/**
 * Serialize once, then parse back to a detached plain-data snapshot. Validation, identity,
 * approval lookup, hashing, and serving all operate on this exact snapshot and these exact bytes;
 * no later serialization of the caller-owned object can diverge from what was checked.
 */
const snapshotPublicationPayload = (
  payload: PublicReport2024Payload
): { payload: PublicReport2024Payload; json: string } => {
  let json: string;
  try {
    json = serializePublicReport2024Payload(payload);
  } catch (error) {
    throw new Error(`publication refused: payload could not be serialized: ${(error as Error).message}`);
  }

  let snapshot: unknown;
  try {
    snapshot = JSON.parse(json) as unknown;
  } catch (error) {
    throw new Error(`publication refused: serialized payload is not valid JSON: ${(error as Error).message}`);
  }
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) {
    throw new Error('publication refused: serialized payload is not a JSON object');
  }

  const parsedPayload = snapshot as PublicReport2024Payload;
  if (serializePublicReport2024Payload(parsedPayload) !== json) {
    throw new Error('publication refused: serialized payload does not reproduce canonical JSON bytes');
  }
  return { payload: parsedPayload, json };
};

/**
 * Atomically publish one report version from raw materials. This is the ONLY publication path,
 * and it invokes `validatePublicReport2024` internally on the exact payload/HTML/governed bytes
 * being published — there is no caller-supplied "successful validation" object to accept or
 * replay. The registry entry's canonical/version
 * identities are likewise derived internally from the contract (a validated report can never be
 * registered under another family), the atomic current→superseded flip is checked against the
 * full registry validator, and the frozen content is registered in the encapsulated store under
 * the validator's own content-binding digests. Throws (publishing nothing) on any failure.
 */
export function publishPublicReportVersion(
  state: PublicReportServingState,
  request: PublicReportPublicationRequest
): PublicReportServingState {
  const { html, governedSourceBytes, publishedAt } = request;
  const snapshot = snapshotPublicationPayload(request.payload);
  const payload = snapshot.payload;
  const json = snapshot.json;
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

  const jsonSha256 = computeSha256Hex(json);
  const htmlSha256 = computeSha256Hex(html);
  const approval = lookupRecordedPublicReportPublicationApproval(reportVersionId, jsonSha256, htmlSha256);

  // The internal case-#20 gate (§8 invariant 12; §10 — only case #20 publishes). Approval is read
  // from the module-owned operator registry and is absent in Phase 3 production state; it is never
  // accepted from this caller's request.
  const validation = validatePublicReport2024(payload, {
    governedSourceBytes,
    html,
    registry: state.serviceMetadata,
    approvals: approval === null ? [] : [approval]
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

  const frozenReports = withValidatedFrozenReport(state.frozenReports, {
    reportVersionId,
    json,
    html,
    jsonSha256: binding.json_sha256,
    htmlSha256: binding.html_sha256
  });

  return Object.freeze({ serviceMetadata, frozenReports });
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
    const content = verifyFrozenPublicReportRecord(reportVersionId, frozenReports.resolve(reportVersionId));
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
  state: PublicReportServingState = createEmptyPublicReportServingState()
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

export function createTeamstateServer(state: PublicReportServingState = createEmptyPublicReportServingState()) {
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
