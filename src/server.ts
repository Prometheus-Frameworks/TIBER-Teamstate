import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUBLIC_REPORT_2024_CANONICAL_URL_HTML } from './contracts/teamstatePublicOffensiveEnvironment2024V1.js';
import {
  LIVE_SERVICE_METADATA,
  resolveCurrentRegistryEntry,
  validatePublicReportRegistry,
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
export interface FrozenPublicReportContent {
  json: string;
  html: string;
}

/**
 * Everything report serving may read: the mutable registry (`service-metadata.json` state) and the
 * frozen per-version content store. Registry changes never touch frozen content — serving a
 * version URL therefore stays byte-identical across current/superseded flips (§6, §8 invariant 9).
 */
export interface PublicReportServingState {
  serviceMetadata: TeamstateServiceMetadata;
  frozenReports: ReadonlyMap<string, FrozenPublicReportContent>;
}

/**
 * The live deployment state: deployment scaffold, empty registry, publication disabled, no frozen
 * content. Every public-report route fails closed (404) in this state — no partial,
 * fixture-backed, candidate, or best-effort report is ever served pre-approval.
 */
export const LIVE_PUBLIC_REPORT_SERVING_STATE: PublicReportServingState = {
  serviceMetadata: LIVE_SERVICE_METADATA,
  frozenReports: new Map()
};

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
 * disabled, no unambiguous current registry entry, unknown version id, or missing frozen content.
 */
function resolvePublicReportRoute(
  state: PublicReportServingState,
  pathname: string
): { content: FrozenPublicReportContent; format: 'html' | 'json' } | null {
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
    const content = frozenReports.get(reportVersionId);
    return content === undefined ? null : { content, format };
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
