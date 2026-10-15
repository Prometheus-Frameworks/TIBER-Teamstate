"""Public synthetic entry-point regressions; never certify retained private data.

Only ROOT and the archive's expected byte identity are replaced. The actual
loader, raw Data builder, TypeScript bridge, joins and aggregation all execute.
"""
import copy
import csv
import io
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import release as r

TEAMS = 'ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LA LAC LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split()
OPTIONAL = ('outputs/player-weeks.json', 'review/output-review.json')


def csv_bytes(rows):
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue().encode()


def synthetic_members():
    """Made-up counts and schedules, with independently constructed byte pins."""
    module = r.data_module()
    members = {'input-manifest.json': r.dump({'fixture': 'synthetic-only'})}
    candidates = []
    clock = '2026-10-15T00:00:00Z'
    license_raw = b'Synthetic test notice; no real source data.\n'
    attribution = {'license': 'CC BY 4.0', 'license_sha256': r.sha(license_raw)}
    for week in range(1, 6):
        base = f'private-release/w{week:02}'
        scope = {'season': 2026, 'season_type': 'REG', 'week': week}
        schedule, teams, players = [], [], []
        for i in range(0, len(TEAMS), 2):
            away, home = TEAMS[i:i + 2]
            game = f'2026_{week:02}_{away}_{home}'
            schedule.append(dict(season=2026, game_type='REG', week=week,
                                 game_id=game, away_team=away, home_team=home,
                                 gameday=f'2026-09-{week:02}'))
            for j, (team, opponent) in enumerate(((away, home), (home, away))):
                row = dict(season=2026, week=week, season_type='REG', game_id=game,
                           team=team, opponent_team=opponent)
                row.update({f: 1 for f in module.FIELDS})
                row.update(passing_yards=week * 10, sacks_suffered=week - 1)
                # Observed team rows may legitimately have missing individual fields.
                if team == 'SEA' and week == 2:
                    row.update(passing_yards='', sacks_suffered='')
                teams.append(row)
                players.append({**row, 'player_id': f'00-{i + j + 1:07}',
                                'player_display_name': f'Synthetic Player {i + j + 1}',
                                'position': 'QB'})
        team_raw, player_raw, schedule_raw = map(csv_bytes, (teams, players, schedule))
        receipt = {'status': 'unadmitted_candidate_source_snapshot',
                   'requested_scope': scope, 'snapshot_compiled_at': clock,
                   'attribution': attribution, 'sources': {}}
        for kind, raw in (('team', team_raw), ('player', player_raw)):
            receipt['sources'][kind] = dict(byte_count=len(raw), sha256=r.sha(raw),
                                           release_asset_updated_at=clock,
                                           retrieval_completed_at=clock)
        sr = dict(byte_count=len(schedule_raw), sha256=r.sha(schedule_raw),
                  retrieval_completed_at=clock, attribution=attribution)
        receipt_raw = r.dump(receipt)
        facts = module.build_candidate(player_raw, team_raw, receipt)
        game_ids = sorted(x['game_id'] for x in schedule)
        candidate = dict(schema_version='weekly_boxscore_publication_candidate_v0',
                         status='candidate_needs_review', consumer_admitted=False,
                         candidate=facts, source_receipt_sha256=r.sha(receipt_raw),
                         schedule_receipt=sr,
                         coverage=dict(game_finality='unknown', full_week_final=False,
                                       schedule_coverage='matched', scheduled_game_ids=game_ids,
                                       observed_game_ids=game_ids, missing_game_ids=[],
                                       unexpected_game_ids=[]))
        week_members = {'team.csv': team_raw, 'player.csv': player_raw,
                        'games.csv': schedule_raw, 'receipt.json': receipt_raw,
                        'LICENSE.md': license_raw}
        # The schedule receipt lives in its own directory.
        for name, raw in week_members.items():
            members[f'inputs/{base}/{name}'] = raw
        members[f'inputs/{base}/schedule/games.csv'] = members.pop(f'inputs/{base}/games.csv')
        members[f'inputs/{base}/schedule/receipt.json'] = r.dump(sr)
        members[f'inputs/{base}/schedule/LICENSE.md'] = license_raw
        candidate_path = f'{base}/candidate.json'
        candidate_raw = r.dump(candidate)
        members[f'inputs/{candidate_path}'] = candidate_raw
        pins = [dict(path=p.removeprefix('inputs/'), size=len(raw), sha256=r.sha(raw))
                for p, raw in members.items() if p.startswith(f'inputs/{base}/')]
        witness = dict(scope={'season': 2026, 'seasonType': 'REG', 'week': week},
                       members=pins, candidate_path=candidate_path,
                       candidate_sha256=r.sha(candidate_raw), build_completed_at=clock)
        members[f'inputs/private-release/witnesses/w{week:02}.json'] = r.dump(witness)
        candidates.append(dict(week=week, candidate_sha256=r.sha(candidate_raw)))
    members['inputs/private-release/independent-input-review-r2.json'] = r.dump(dict(
        input_manifest_sha256=r.sha(members['input-manifest.json']), disposition='clean',
        material_findings=[], candidates=candidates, reviewer='synthetic-fixture', completed_at=clock))
    rop = dict(run_id='synthetic-fixture', population_count=0, rows=[],
               input_manifest_sha256=r.sha(members['input-manifest.json']))
    members[OPTIONAL[0]] = r.dump(rop)
    members[OPTIONAL[1]] = r.dump(dict(disposition='clean', run_id=rop['run_id'],
        output_files=[dict(path=OPTIONAL[0], size=len(members[OPTIONAL[0]]),
                           sha256=r.sha(members[OPTIONAL[0]]))]))
    members['MANIFEST.json'] = r.dump({'files': [dict(path=p, size=len(raw), sha256=r.sha(raw))
                                               for p, raw in members.items()]})
    return members


class EntryPointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.members = synthetic_members()

    def produce(self, members=None, include_rop=False, archive_drift=False, overrides=None):
        members = self.members if members is None else members
        with tempfile.TemporaryDirectory(prefix='tts-synthetic-') as tmp:
            root = Path(tmp)
            shutil.copytree(r.ROOT / 'code', root / 'code',
                            ignore=shutil.ignore_patterns('tests', '__pycache__'))
            (root / 'inputs').mkdir()
            (root / 'records').mkdir()
            (root / 'records/release-identity.json').write_bytes(r.dump({'release_id': 'synthetic-only'}))
            archive = root / 'inputs/ROP-original.zip'
            with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
                for path, raw in members.items():
                    z.writestr(r.PREFIX + path, raw)
            raw = archive.read_bytes()
            expected_hash = r.sha(raw)
            if archive_drift:
                archive.write_bytes(raw + b'altered')
            with patch.multiple(r, ROOT=root, ROP_HASH=expected_hash,
                                ROP_BYTES=len(raw)):
                # Actual ZIP reads must never touch a disabled attachment, even
                # when its member is listed in the source manifest.
                original_read = zipfile.ZipFile.read
                def guarded_read(z, name, *args, **kwargs):
                    if not include_rop and name.removeprefix(r.PREFIX) in OPTIONAL:
                        raise AssertionError('Disabled ROP attachment was read')
                    if overrides and name.removeprefix(r.PREFIX) in overrides:
                        return overrides[name.removeprefix(r.PREFIX)]
                    return original_read(z, name, *args, **kwargs)
                with patch.object(zipfile.ZipFile, 'read', guarded_read):
                    return r.produce(include_rop=include_rop)

    def test_outer_entry_point_skips_disabled_rop_reads(self):
        out = self.produce()
        self.assertEqual(out['rop_attachment_status'], 'unavailable_not_required_for_tts')
        self.assertEqual(out['coverage']['observed_team_games'], 160)
        self.assertTrue(all(s['player_context'] is None for s in out['slots']))

    def test_missing_optional_members_do_not_block_disabled_attachment(self):
        for path in OPTIONAL:
            with self.subTest(path=path):
                members = copy.deepcopy(self.members)
                del members[path]  # Original synthetic manifest still lists it.
                self.assertEqual(self.produce(members)['coverage']['teams'], 32)

    def test_invalid_optional_members_do_not_block_disabled_attachment(self):
        for path in OPTIONAL:
            with self.subTest(path=path):
                members = copy.deepcopy(self.members)
                members[path] = b'{invalid optional JSON'
                self.assertEqual(self.produce(members)['rop_attachment_status'],
                                 'unavailable_not_required_for_tts')

    def test_enabled_attachment_still_qualifies(self):
        out = self.produce(include_rop=True)
        self.assertEqual(out['rop_attachment_status'], 'attached_from_exact_retained_release')
        baseline = self.produce()
        self.assertEqual(out['coverage'], baseline['coverage'])
        self.assertEqual(out['profiles'], baseline['profiles'])

    def test_enabled_missing_or_invalid_attachment_is_not_certified(self):
        for path in OPTIONAL:
            for invalid in (False, True):
                with self.subTest(path=path, invalid=invalid):
                    members = copy.deepcopy(self.members)
                    if invalid:
                        members[path] = b'bad'
                    else:
                        del members[path]
                    with self.assertRaises((KeyError, ValueError)):
                        self.produce(members, include_rop=True)

    def test_missing_required_team_input_still_aborts(self):
        required = ['inputs/private-release/w01/' + p for p in
                    ('team.csv', 'player.csv', 'schedule/games.csv', 'candidate.json')]
        required.append('inputs/private-release/independent-input-review-r2.json')
        for path in required:
            with self.subTest(path=path):
                members = copy.deepcopy(self.members)
                del members[path]
                with self.assertRaises(KeyError):
                    self.produce(members)

    def test_rop_review_failure_is_separate_from_required_tts_qualification(self):
        members = copy.deepcopy(self.members)
        path = OPTIONAL[1]
        review = r.strict_json(members[path])
        review['disposition'] = 'not_clean'
        members[path] = r.dump(review)
        manifest = r.strict_json(members['MANIFEST.json'])
        for item in manifest['files']:
            if item['path'] == path:
                item.update(size=len(members[path]), sha256=r.sha(members[path]))
        members['MANIFEST.json'] = r.dump(manifest)
        with self.assertRaisesRegex(r.IntegrityError, 'Retained ROP review'):
            self.produce(members, include_rop=True)
        self.assertEqual(self.produce(members)['coverage']['teams'], 32)

    def test_required_member_digest_drift_still_aborts(self):
        with self.assertRaisesRegex(r.IntegrityError, 'SHA-256'):
            path = 'inputs/private-release/w01/team.csv'
            original = self.members[path]
            self.produce(overrides={path: original.replace(b'2026', b'2025', 1)})

    def test_invalid_required_data_review_still_aborts(self):
        members = copy.deepcopy(self.members)
        path = 'inputs/private-release/independent-input-review-r2.json'
        review = r.strict_json(members[path])
        review['disposition'] = 'not_clean'
        members[path] = r.dump(review)
        # Repin the synthetic container manifest; the semantic review check must fail.
        manifest = r.strict_json(members['MANIFEST.json'])
        for item in manifest['files']:
            if item['path'] == path:
                item.update(size=len(members[path]), sha256=r.sha(members[path]))
        members['MANIFEST.json'] = r.dump(manifest)
        with self.assertRaisesRegex(r.IntegrityError, 'Existing Data input review'):
            self.produce(members)

    def test_container_identity_stays_required(self):
        with self.assertRaisesRegex(r.IntegrityError, 'Original ROP archive'):
            self.produce(archive_drift=True)

    def test_incomplete_observations_preserve_nulls_and_partial_denominators(self):
        out = self.produce()
        slot = next(s for s in out['slots'] if s['team'] == 'SEA' and s['week'] == 2)
        self.assertEqual(slot['status'], 'observed')
        self.assertIsNone(slot['observed']['sacks_suffered'])
        self.assertIsNone(slot['observed']['passing_yards'])
        profile = next(p for p in out['profiles'] if p['team'] == 'SEA' and p['through_week'] == 2)
        self.assertIsNone(profile['weekly_changes'][0]['deltas']['sacks_suffered'])
        self.assertIsNone(profile['weekly_changes'][0]['deltas']['passing_yards'])
        self.assertEqual(profile['own_offense']['metrics']['passing_yards']['status'], 'partial')
        self.assertEqual(profile['own_offense']['metrics']['passing_yards']['observed_games'], 1)
        first = next(s for s in out['slots'] if s['team'] == 'SEA' and s['week'] == 1)
        self.assertEqual(first['observed']['sacks_suffered'], 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
