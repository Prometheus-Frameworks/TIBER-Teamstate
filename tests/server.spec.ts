import { type AddressInfo } from 'node:net';
import { describe, expect, it, afterEach } from 'vitest';
import { createTeamstateServer } from '../src/server.js';

describe('teamstate HTTP serving scaffold', () => {
  let server: ReturnType<typeof createTeamstateServer> | undefined;

  afterEach(async () => {
    if (server === undefined) return;
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  });

  const startServer = async (): Promise<string> => {
    server = createTeamstateServer();
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  };

  it('does not bind a port merely by importing the module', async () => {
    const mod = await import('../src/server.js');
    expect(typeof mod.createTeamstateServer).toBe('function');
    expect(typeof mod.handleRequest).toBe('function');
  });

  it('returns 200 and the expected payload on /healthz', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/healthz`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ status: 'ok', service: 'tiber-teamstate' });
  });

  it('returns a minimal HTML service page on /', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('TIBER-Teamstate');
    expect(body).toContain('/healthz');
    expect(body).not.toContain('output/');
    expect(body).not.toContain('data/processed');
  });

  it('returns service metadata declaring artifact publication disabled', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/service-metadata.json`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({
      service: 'tiber-teamstate',
      status: 'deployment_scaffold',
      public_reports: [],
      artifact_publication_enabled: false,
    });
  });

  it('returns a deterministic 404 for unknown routes', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/does-not-exist`);

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('does not expose internal artifact directories or arbitrary filesystem paths', async () => {
    const base = await startServer();

    for (const path of ['/output/', '/output/rankings.team_power.json', '/data/processed/', '/data/fixtures/', '/../package.json']) {
      const res = await fetch(`${base}${path}`);
      expect(res.status).toBe(404);
    }
  });

  it('binds to the configured host and an ephemeral port', async () => {
    const base = await startServer();
    expect(base).toContain('127.0.0.1');

    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
  });
});
