'use strict';
// Execute the actual template script against a small in-memory DOM. These
// synthetic presentation controls are not a browser or private-data review.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../profile-view.template.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const fields = ['attempts', 'completions', 'passing_yards', 'passing_tds', 'passing_interceptions',
  'sacks_suffered', 'carries', 'rushing_yards', 'rushing_tds', 'fumbles_lost_total'];

function fixture(previous = {}, last = {}, playerContext = null) {
  const slots = [previous, last].map((changes, i) => ({team: 'SEA', week: i + 1, status: 'observed',
    opponent: i ? 'SF' : 'LA', gameday: '2026-09-01',
    observed: {...Object.fromEntries(fields.map(f => [f, 1])), sacks_suffered: i,
      passing_yards: i ? 150 : 100, ...changes},
    opponent_observed: Object.fromEntries(fields.map(f => [f, 1])),
    player_context: i ? playerContext : null, source: {fixture: 'synthetic-only'}}));
  const metrics = Object.fromEntries(fields.map(f => [f,
    {total: 1, per_observed_game: 1, observed_games: 2, expected_games: 2, status: 'complete'}]));
  const summary = {observed_records: 2, metrics, rates: {
    completion_pct: {value: 1}, passing_yards_per_attempt: {value: 1}, rushing_yards_per_carry: {value: 1}}};
  return {team_codes: ['SEA'], metric_fields: fields, slots,
    profiles: [{team: 'SEA', through_week: 2, own_offense: summary, faced_offense: summary}],
    coverage: {teams: 1}, release_identity: {release_id: 'synthetic-only'}, source_archive_sha256: 'synthetic'};
}

function render(data) {
  const elements = new Map();
  function getElementById(id) {
    if (!elements.has(id)) elements.set(id, {value: id === 'through' ? '2' : '',
      textContent: id === 'data' ? JSON.stringify(data) : '', innerHTML: '',
      addEventListener() {}});
    return elements.get(id);
  }
  vm.runInNewContext(script, {document: {getElementById}, Blob, URL, setTimeout});
  return id => getElementById(id);
}

test('complete last-two observations retain both numerical comparisons', () => {
  const text = render(fixture())('observations').innerHTML;
  assert.match(text, /sacks suffered changed from 0 to 1/);
  assert.match(text, /passing yards changed from 100 to 150/);
});
for (const [field, label] of [['sacks_suffered', 'sacks suffered'], ['passing_yards', 'passing yards']]) {
  for (const which of ['previous', 'last', 'both']) {
    test(`null ${field} in ${which} observation is unavailable, not a comparison`, () => {
      const a = which !== 'last' ? {[field]: null} : {};
      const b = which !== 'previous' ? {[field]: null} : {};
      const view = render(fixture(a, b));
      const text = view('observations').innerHTML;
      assert.doesNotMatch(text, new RegExp(`${label} changed from`));
      assert.match(text, /comparison unavailable/i);
      assert.doesNotMatch(text, /\b(null|undefined|NaN|Infinity)\b/);
      const other = field === 'sacks_suffered' ? 'passing yards' : 'sacks suffered';
      assert.match(text, new RegExp(`${other} changed from`));
      assert.match(view('history').innerHTML, /—/);
    });
  }
  for (const value of [undefined, '1']) {
    test(`missing/nonnumeric ${field} (${String(value)}) cannot form a comparison`, () => {
      const text = render(fixture({[field]: value}))('observations').innerHTML;
      assert.doesNotMatch(text, new RegExp(`${label} changed from`));
      assert.doesNotMatch(text, /\b(null|undefined|NaN|Infinity)\b/);
    });
  }
}
test('both metrics missing retain an explicit gap and no changes', () => {
  const text = render(fixture({sacks_suffered: null}, {passing_yards: null}))('observations').innerHTML;
  assert.doesNotMatch(text, /changed from/);
  assert.match(text, /comparison unavailable/i);
});
test('zero and signed yards are valid observations', () => {
  const text = render(fixture({passing_yards: -5}, {sacks_suffered: 0, passing_yards: 0}))('observations').innerHTML;
  assert.match(text, /sacks suffered changed from 0 to 0/);
  assert.match(text, /passing yards changed from -5 to 0/);
});
test('one observed game does not invent a previous comparison', () => {
  const data = fixture();
  data.slots[0] = {team: 'SEA', week: 1, status: 'missing_source_evidence', observed: null};
  const text = render(data)('observations').innerHTML;
  assert.doesNotMatch(text, /changed from/);
});
test('no supported games do not invent observations', () => {
  const data = fixture();
  for (const slot of data.slots) {slot.status = 'missing_source_evidence'; slot.observed = null;}
  assert.doesNotMatch(render(data)('observations').innerHTML, /changed from|range from/);
});
test('missing selected-player counts are formatted as unavailable in prose', () => {
  const pc = {rows: [], selected_targets: null, credited_team_targets: null,
    other_or_unselected_targets: null, selected_carries: null,
    all_team_carries: null, other_or_unselected_carries: null};
  const text = render(fixture({}, {}, pc))('player-remainder').textContent;
  assert.doesNotMatch(text, /\bnull\b/);
  assert.match(text, /—/);
});
