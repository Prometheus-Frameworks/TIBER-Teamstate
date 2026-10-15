/** Local Weeks 1-5 successor derived mechanically from the exact upstream Week 4 inspector.
 * Ten metrics, reconciliation, signed-value and identity rules are preserved.
 * Week/game population is passed from a separately authenticated release binding.
 * This pure inspector is not source admission, independent review, or authority.
 */
import { RELEASE_FIELDS, type ReleaseField, type ReleaseScope } from './releaseFields.js';

type ObjectValue = Record<string, unknown>;
export function object(value: unknown): ObjectValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as ObjectValue;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected array');
  return value;
}
function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`Invalid ${label}`);
}
function games(value: unknown, expected: ReleaseScope): void {
  const entries = list(value);
  if (entries.length !== expected.games.length || new Set(entries).size !== entries.length ||
      expected.games.some(game => !entries.includes(game))) throw new Error('Invalid game membership');
}
export interface ProvisionalTeamRow {
  season: 2026; season_type: 'REG'; week: number;
  game_id: string; team: string; opponent_team: string;
  source: 'nflverse_stats_team'; source_csv_row: number;
  observed: Record<ReleaseField, number | null>;
  reconciliation: Record<ReleaseField, { status: 'matched' | 'unknown'; player_sum: number | null; team_value: number | null }>;
}
function numberOrNull(value: unknown, field: ReleaseField): number | null {
  if (value === null) return null;
  const signed = field === 'passing_yards' || field === 'rushing_yards';
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Math.abs(value) > 1_000_000 ||
      (!signed && value < 0)) throw new Error(`Invalid metric ${field}`);
  return value;
}

/** Shape inspection only: accepts synthetic JSON, grants no source/use/run authority. */
export function inspectReleaseWeek(bytes: Uint8Array, expected: ReleaseScope) {
  if (expected.season !== 2026 || !Number.isInteger(expected.week) || expected.week < 1 || expected.week > 5)
    throw new Error('Unsupported release scope');
  if (expected.games.length < 1 || expected.games.length > 16 || new Set(expected.games).size !== expected.games.length)
    throw new Error('Invalid expected schedule');
  const expectedTeams = new Set<string>();
  for (const game of expected.games) {
    if (typeof game !== 'string' || !new RegExp(`^2026_${String(expected.week).padStart(2, '0')}_[A-Z]{2,3}_[A-Z]{2,3}$`).test(game))
      throw new Error('Wrong expected game scope');
    const pair = game.split('_').slice(2);
    for (const team of pair) { if (expectedTeams.has(team)) throw new Error('Duplicate expected team'); expectedTeams.add(team); }
  }
  if (bytes.byteLength > 2_000_000) throw new Error('Candidate too large');
  const envelope = object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  equal(envelope.schema_version, 'weekly_boxscore_publication_candidate_v0', 'envelope schema');
  equal(envelope.status, 'candidate_needs_review', 'candidate status');
  equal(envelope.consumer_admitted, false, 'consumer admission');
  const candidate = object(envelope.candidate);
  equal(candidate.schema_version, 'weekly_boxscore_candidate_v0', 'facts schema');
  equal(candidate.status, 'candidate_needs_review', 'facts status');
  equal(candidate.consumer_admitted, false, 'facts admission');
  const scope = object(candidate.scope);
  equal(scope.season, 2026, 'season'); equal(scope.week, expected.week, 'week'); equal(scope.season_type, 'REG', 'season type');
  const coverage = object(envelope.coverage);
  equal(coverage.game_finality, 'unknown', 'finality'); equal(coverage.full_week_final, false, 'final week');
  equal(coverage.schedule_coverage, 'matched', 'schedule coverage');
  games(coverage.scheduled_game_ids, expected); games(coverage.observed_game_ids, expected);
  if (list(coverage.missing_game_ids).length || list(coverage.unexpected_game_ids).length) throw new Error('Incomplete coverage');
  const sourceRows = list(candidate.teams);
  if (sourceRows.length !== expected.games.length * 2) throw new Error('Team row count disagrees with exact schedule');
  const seen = new Set<string>(); const seenTeams = new Set<string>(); const seenSourceRows = new Set<number>();
  const rows: ProvisionalTeamRow[] = sourceRows.map(value => {
    const row = object(value); const id = object(row.identity);
    equal(id.season, 2026, 'row season'); equal(id.week, expected.week, 'row week'); equal(id.season_type, 'REG', 'row type');
    if (typeof id.game_id !== 'string' || !expected.games.includes(id.game_id)) throw new Error('Unexpected game');
    const pair = id.game_id.split('_').slice(2);
    if (typeof id.team !== 'string' || typeof id.opponent_team !== 'string' ||
        id.team === id.opponent_team || !pair.includes(id.team) || !pair.includes(id.opponent_team)) throw new Error('Invalid opponent pair');
    const key = `${id.game_id}/${id.team}`;
    if (seen.has(key) || seenTeams.has(id.team)) throw new Error('Duplicate team');
    seen.add(key); seenTeams.add(id.team);
    equal(row.source, 'nflverse_stats_team', 'team source');
    if (typeof row.source_csv_row !== 'number' || !Number.isSafeInteger(row.source_csv_row) || row.source_csv_row < 2 ||
        seenSourceRows.has(row.source_csv_row)) throw new Error('Invalid source row');
    seenSourceRows.add(row.source_csv_row);
    const observed = object(row.observed); const reconciled = object(row.reconciliation);
    const metrics = {} as ProvisionalTeamRow['observed'];
    const checks = {} as ProvisionalTeamRow['reconciliation'];
    for (const field of RELEASE_FIELDS) {
      const value = numberOrNull(observed[field], field);
      const check = object(reconciled[field]);
      const total = numberOrNull(check.team_value, field);
      const subtotal = numberOrNull(check.player_sum, field);
      equal(total, value, 'reconciliation team value');
      const status = value === null || subtotal === null ? 'unknown' : 'matched';
      equal(check.status, status, 'reconciliation status');
      if (status === 'matched' && subtotal !== value) throw new Error('Conflicting subtotal');
      metrics[field] = value; checks[field] = { status, player_sum: subtotal, team_value: total };
    }
    return { season: 2026, season_type: 'REG', week: expected.week, game_id: id.game_id, team: id.team,
      opponent_team: id.opponent_team, source: 'nflverse_stats_team', source_csv_row: row.source_csv_row,
      observed: metrics, reconciliation: checks };
  });
  for (const game of expected.games) {
    for (const team of game.split('_').slice(2)) if (!seen.has(`${game}/${team}`)) throw new Error('Missing game/team');
  }
  rows.sort((a,b) => a.game_id < b.game_id ? -1 : a.game_id > b.game_id ? 1 : a.team < b.team ? -1 : a.team > b.team ? 1 : 0);
  const fieldReadiness = RELEASE_FIELDS.map(field => ({ field,
    finiteCount: rows.filter(row => row.observed[field] !== null).length,
    nullCount: rows.filter(row => row.observed[field] === null).length,
    reconciliationUnknownCount: rows.filter(row => row.reconciliation[field].status === 'unknown').length
  }));
  return { kind: 'unadmitted_shape_inspection' as const, rows, fieldReadiness };
}
