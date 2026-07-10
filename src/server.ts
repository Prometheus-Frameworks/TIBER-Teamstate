import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function sendHtml(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/healthz') {
    sendJson(res, 200, { status: 'ok', service: SERVICE_NAME });
    return;
  }

  if (url.pathname === '/service-metadata.json') {
    sendJson(res, 200, {
      service: SERVICE_NAME,
      status: 'deployment_scaffold',
      public_reports: [],
      artifact_publication_enabled: false,
    });
    return;
  }

  if (url.pathname === '/') {
    sendHtml(res, 200, HTML_PAGE);
    return;
  }

  sendJson(res, 404, { status: 'not_found' });
}

export function createTeamstateServer() {
  return createServer(handleRequest);
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
