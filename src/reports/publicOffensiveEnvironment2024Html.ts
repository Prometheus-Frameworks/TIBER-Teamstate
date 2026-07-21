/**
 * Deterministic human-readable rendering for `teamstate_public_offensive_environment_2024_v1`
 * (contract §4, §6).
 *
 * The HTML for a report version is a pure function of its frozen payload: same payload, same
 * bytes. It never renders current/superseded status (strict immutable version pages, §6) — the
 * only navigation aid is a frozen link to the canonical alias whose target text never changes.
 * Every published value is emitted in a machine-recoverable form (`data-*` attributes plus visible
 * text) so HTML/JSON semantic parity (§8 invariant 10) is checkable, not asserted.
 */

import {
  PUBLIC_REPORT_2024_CANONICAL_URL_HTML,
  PUBLIC_REPORT_2024_DERIVED_FIELDS,
  PUBLIC_REPORT_2024_DERIVED_PRECISION,
  PUBLIC_REPORT_2024_OBSERVED_FIELDS,
  type PublicReport2024Payload,
  type PublicReport2024TeamDerived,
  type PublicReport2024TeamObserved
} from '../contracts/teamstatePublicOffensiveEnvironment2024V1.js';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** Fixed-decimal display of an already-rounded published value; `null` renders as an em dash. */
export const formatPublicReport2024Value = (field: string, value: number | null): string => {
  if (value === null) {
    return '—';
  }
  if (typeof value !== 'number') {
    // A missing/malformed JSON value must format to something that cannot match a rendered cell,
    // so parity checking reports it instead of silently treating it like null.
    return String(value);
  }
  const precision = (PUBLIC_REPORT_2024_DERIVED_PRECISION as Record<string, number>)[field];
  return precision === undefined ? String(value) : value.toFixed(precision);
};

const METHODOLOGY_DOC_URL =
  'https://github.com/Prometheus-Frameworks/TIBER-Teamstate/blob/main/docs/contracts/teamstate-public-offensive-environment-2024-v1.md';

const OBSERVED_LABELS: Record<keyof PublicReport2024TeamObserved, string> = {
  pointsForTotal: 'Points for (total)',
  offensivePlaysTotal: 'Offensive plays (total)',
  neutralPlaysTotal: 'Neutral-script plays (total)',
  drivesTotal: 'Drives (total)',
  redZoneTripsTotal: 'Red-zone trips (total)',
  sacksAllowedTotal: 'Sacks allowed (total)',
  turnoversTotal: 'Turnovers (total)'
};

const DERIVED_LABELS: Record<keyof PublicReport2024TeamDerived, string> = {
  pointsForPerGame: 'Points for / game',
  offensivePlaysPerGame: 'Offensive plays / game',
  neutralPlaysPerGame: 'Neutral-script plays / game',
  drivesPerGame: 'Drives / game',
  redZoneTripsPerGame: 'Red-zone trips / game',
  sacksAllowedPerGame: 'Sacks allowed / game',
  turnoversPerGame: 'Turnovers / game',
  secondsPerPlay: 'Seconds / play (play-weighted)',
  epaPerPlay: 'EPA / play (play-weighted)',
  neutralPassRate: 'Neutral-script pass rate (neutral-play-weighted)',
  pointsPerDrive: 'Points / drive (drive-weighted)',
  redZoneTdRate: 'Red-zone TD rate (trip-weighted)'
};

export const renderPublicReport2024Html = (payload: PublicReport2024Payload): string => {
  const scope = payload.declared_scope;
  const versionUrlHtml = payload.version_url.replace(/\.json$/, '');

  const headerCells = [
    '<th scope="col">Team</th>',
    '<th scope="col">Games</th>',
    ...PUBLIC_REPORT_2024_OBSERVED_FIELDS.map(
      (field) => `<th scope="col">${escapeHtml(OBSERVED_LABELS[field])}</th>`
    ),
    ...PUBLIC_REPORT_2024_DERIVED_FIELDS.map(
      (field) => `<th scope="col">${escapeHtml(DERIVED_LABELS[field])}</th>`
    )
  ].join('');

  const teamRows = payload.teams
    .map((team) => {
      const observedCells = PUBLIC_REPORT_2024_OBSERVED_FIELDS.map(
        (field) =>
          `<td data-team="${escapeHtml(team.team)}" data-field="${field}">${escapeHtml(
            formatPublicReport2024Value(field, team.observed[field])
          )}</td>`
      ).join('');
      const derivedCells = PUBLIC_REPORT_2024_DERIVED_FIELDS.map(
        (field) =>
          `<td data-team="${escapeHtml(team.team)}" data-field="${field}">${escapeHtml(
            formatPublicReport2024Value(field, team.derived[field])
          )}</td>`
      ).join('');
      return (
        `<tr><th scope="row" data-team-code="${escapeHtml(team.team)}">${escapeHtml(team.team)}</th>` +
        `<td data-team="${escapeHtml(team.team)}" data-field="gamesPlayed">${team.gamesPlayed}</td>` +
        observedCells +
        derivedCells +
        '</tr>'
      );
    })
    .join('\n        ');

  const warningsBlock =
    payload.warnings.length === 0
      ? '<p data-warnings-empty="true">No zero-denominator warnings fired for any team.</p>'
      : `<ul>${payload.warnings
          .map(
            (warning) =>
              `<li data-warning-team="${escapeHtml(warning.team)}" data-warning-code="${escapeHtml(warning.code)}">` +
              `${escapeHtml(warning.team)}: ${escapeHtml(warning.code)}</li>`
          )
          .join('')}</ul>`;

  const upstreamSources = payload.upstream_sources
    .map(
      (source) =>
        `<li data-source-ref="${escapeHtml(source.source_ref)}">` +
        `<code>${escapeHtml(source.source_ref)}</code> — snapshot ` +
        `<span data-source-snapshot-at="${escapeHtml(source.source_snapshot_at)}">${escapeHtml(source.source_snapshot_at)}</span>, ` +
        (source.checksum === null
          ? 'checksum: not recorded'
          : `${escapeHtml(source.checksum.algorithm)} <code data-source-checksum="${escapeHtml(source.checksum.value)}">${escapeHtml(source.checksum.value)}</code>`) +
        ` (${escapeHtml(source.checksum_verification)})</li>`
    )
    .join('');

  const excludedLanes = payload.excluded_lanes
    .map(
      (lane) =>
        `<li data-excluded-field="${escapeHtml(lane.field)}" data-excluded-reason="${escapeHtml(lane.reason)}">` +
        `<code>${escapeHtml(lane.field)}</code> — <code>${escapeHtml(lane.reason)}</code></li>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>2024 NFL Offensive Environments — Regular-Season Comparison</title>
</head>
<body>
  <article data-report-version-id="${escapeHtml(payload.report_version_id)}">
    <h1>2024 NFL Offensive Environments — Regular-Season Comparison</h1>
    <p>How did all 32 NFL offensive environments compare during the 2024 regular season, based on
    governed observed team-week data?</p>

    <section>
      <h2>Declared scope and coverage</h2>
      <p>Season <span data-scope="season">${scope.season}</span>,
      <span data-scope="phase">${escapeHtml(scope.phase)}</span>:
      all <span data-coverage="team_count">${payload.coverage.team_count}</span> of
      <span data-scope="expected_team_count">${scope.expected_team_count}</span> NFL teams,
      <span data-coverage="team_game_row_count">${payload.coverage.team_game_row_count}</span>/<span data-scope="expected_team_game_rows">${scope.expected_team_game_rows}</span>
      played team-game rows, <span data-scope="expected_games_per_team">${scope.expected_games_per_team}</span> games per team.
      Output meaning: <code data-scope="output_meaning">${escapeHtml(scope.output_meaning)}</code>.</p>
    </section>

    <section>
      <h2>What this report shows — and what it deliberately does not</h2>
      <p>The 12 published fields cover pace (seconds per play), overall efficiency (EPA per play),
      neutral-script pass tendency, red-zone opportunity and efficiency, drive volume and scoring
      efficiency, ball security (turnovers), protection (sacks allowed), and play/points volume.
      Season totals and per-game or weighted-average values are both shown where both exist.</p>
      <p>Not shown, deliberately: pass rate, rush rate, success rate, explosive-play rate, and
      pass-/rush-specific EPA are blocked pending TIBER-Data exposing the exact play-classification
      denominator they need; pressure rate allowed is withheld upstream (unavailable, never
      zero-filled); fantasy point splits are not applicable to a team-environment report; and
      points allowed is outside this report's offensive scope.</p>
      <ul>${excludedLanes}</ul>
    </section>

    <section>
      <h2>Per-team values</h2>
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>
        ${teamRows}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Warnings</h2>
      ${warningsBlock}
    </section>

    <section>
      <h2>Temporal metadata</h2>
      <dl>
        <dt>Data through</dt>
        <dd data-temporal="data_through">${escapeHtml(scope.data_through)}</dd>
        <dt>Source snapshot at</dt>
        <dd data-temporal="source_snapshot_at">${escapeHtml(payload.source_snapshot_at)}</dd>
        <dt>Generated at</dt>
        <dd data-temporal="generated_at">${escapeHtml(payload.generated_at)}</dd>
      </dl>
    </section>

    <section>
      <h2>Provenance and source chain</h2>
      <p>Provenance: <code data-provenance-status="${escapeHtml(payload.provenance_status)}">${escapeHtml(payload.provenance_status)}</code>
      (governance status <code>${escapeHtml(payload.governance.governance_status)}</code>,
      governance source <code>${escapeHtml(payload.governance.governance_source)}</code>).</p>
      <p>Governed input: <code>${escapeHtml(payload.governed_input.repository)}</code> /
      <code>${escapeHtml(payload.governed_input.path)}</code>,
      ${escapeHtml(payload.governed_input.checksum.algorithm)}
      <code data-governed-input-checksum="${escapeHtml(payload.governed_input.checksum.value)}">${escapeHtml(payload.governed_input.checksum.value)}</code>
      (${escapeHtml(payload.governed_input.checksum_verification)}).</p>
      <p>Upstream sources:</p>
      <ul>${upstreamSources}</ul>
      <p>Validation report: <code>${escapeHtml(payload.validation_report.repository)}</code> /
      <code>${escapeHtml(payload.validation_report.path)}</code>.
      Lineage manifest: <code>${escapeHtml(payload.lineage_manifest.repository)}</code> /
      <code>${escapeHtml(payload.lineage_manifest.path)}</code>.</p>
    </section>

    <section>
      <h2>Methodology and identity</h2>
      <p>Methodology version:
      <code data-methodology-version="${escapeHtml(payload.methodology_version)}">${escapeHtml(payload.methodology_version)}</code>
      (<a href="${METHODOLOGY_DOC_URL}">methodology contract</a>).</p>
      <p>This exact report version:
      <code data-version-id="${escapeHtml(payload.report_version_id)}">${escapeHtml(payload.report_version_id)}</code>,
      permanently at <a data-version-url-html="${escapeHtml(versionUrlHtml)}" href="${escapeHtml(versionUrlHtml)}">${escapeHtml(versionUrlHtml)}</a>.</p>
      <p><a data-canonical-link="true" href="${PUBLIC_REPORT_2024_CANONICAL_URL_HTML}">Canonical report location</a>
      — a stable address for whatever version of this report is served canonically.</p>
      <p><a data-json-link="true" href="${escapeHtml(payload.version_url)}">JSON representation of this exact version</a>.</p>
    </section>

    <section>
      <h2>What this report is not</h2>
      <p>This is a historical, observed, governed-source comparison. It is not a current-state
      statement, not a projection or forecast, not a ranking recommendation, and not fantasy,
      betting, or trade advice.</p>
    </section>
  </article>
</body>
</html>
`;
};

/** Semantics recovered from a rendered report page, for HTML/JSON parity checking (§8 inv. 10). */
export interface PublicReport2024HtmlSemantics {
  reportVersionId: string | null;
  methodologyVersion: string | null;
  dataThrough: string | null;
  sourceSnapshotAt: string | null;
  generatedAt: string | null;
  teamCount: number | null;
  teamGameRowCount: number | null;
  /** `team -> field -> visible cell text` for gamesPlayed + all observed/derived fields. */
  teamValues: Map<string, Map<string, string>>;
  warnings: Array<{ team: string; code: string }>;
}

/**
 * Recover published semantics from the deterministic markup above. Reads the *visible* cell text
 * (not just attributes) so a rendering that displays a different value than the JSON — e.g. a
 * different rounding — is caught as a real semantic mismatch.
 */
export const extractPublicReport2024HtmlSemantics = (html: string): PublicReport2024HtmlSemantics => {
  const attr = (pattern: RegExp): string | null => {
    const match = html.match(pattern);
    return match === null ? null : match[1];
  };

  const teamValues = new Map<string, Map<string, string>>();
  const cellPattern = /<t[dh][^>]*data-team="([^"]+)" data-field="([^"]+)"[^>]*>([^<]*)<\/t[dh]>/g;
  for (const match of html.matchAll(cellPattern)) {
    const [, team, field, text] = match;
    if (!teamValues.has(team)) {
      teamValues.set(team, new Map());
    }
    teamValues.get(team)!.set(field, text);
  }

  const warnings: Array<{ team: string; code: string }> = [];
  const warningPattern = /data-warning-team="([^"]+)" data-warning-code="([^"]+)"/g;
  for (const match of html.matchAll(warningPattern)) {
    warnings.push({ team: match[1], code: match[2] });
  }

  const intOrNull = (value: string | null): number | null => {
    if (value === null) {
      return null;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  return {
    reportVersionId: attr(/<article data-report-version-id="([^"]+)">/),
    methodologyVersion: attr(/data-methodology-version="([^"]+)"/),
    dataThrough: attr(/data-temporal="data_through">([^<]*)</),
    sourceSnapshotAt: attr(/data-temporal="source_snapshot_at">([^<]*)</),
    generatedAt: attr(/data-temporal="generated_at">([^<]*)</),
    teamCount: intOrNull(attr(/data-coverage="team_count">([^<]*)</)),
    teamGameRowCount: intOrNull(attr(/data-coverage="team_game_row_count">([^<]*)</)),
    teamValues,
    warnings
  };
};
