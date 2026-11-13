"""Execution-agent regression suite. All altered records here are synthetic test copies."""
import copy,hashlib,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import release as r

class ReleaseTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.weeks,cls.rop,cls.q=r.load_and_qualify();cls.rows=r.run_tts(cls.weeks)
  cls.out=r.make_output(cls.weeks,cls.rop,cls.rows,cls.q)
 def test_actual_schedule_coverage(self):
  self.assertEqual(self.out['coverage'],dict(teams=32,team_week_slots=160,observed_team_games=158,no_game_slots=2,missing_source_slots=0,observed_fields=1580,null_fields_in_observed_rows=0))
  self.assertEqual([(s['team'],s['week']) for s in self.out['slots'] if s['status']=='no_game_in_pinned_schedule'],[('CAR',5),('KC',5)])
 def test_weighted_not_average_percentage(self):
  a={f:0 for f in r.FIELDS};b=a.copy();a.update(attempts=10,completions=10);b.update(attempts=90,completions=0)
  x=r.aggregate([{'observed':a},{'observed':b}],2)
  self.assertEqual(x['rates']['completion_pct']['value'],10)
 def test_zero_denominator(self):
  a={f:0 for f in r.FIELDS};x=r.aggregate([{'observed':a}],1)
  self.assertIsNone(x['rates']['completion_pct']['value']);self.assertEqual(x['metrics']['attempts']['total'],0)
 def test_missing_denominators_use_paired_population(self):
  a={f:1 for f in r.FIELDS};b=a.copy();a.update(attempts=10,completions=5);b.update(attempts=None,completions=20)
  x=r.aggregate([{'observed':a},{'observed':b}],2)
  self.assertEqual(x['rates']['completion_pct']['value'],50);self.assertEqual(x['rates']['completion_pct']['coverage'],'partial')
  self.assertEqual(x['rates']['completion_pct']['observed_games'],1)
 def test_unavailable_not_zero(self):
  a={f:None for f in r.FIELDS};x=r.aggregate([{'observed':a}],1)
  self.assertIsNone(x['metrics']['carries']['total']);self.assertIsNone(x['metrics']['carries']['per_observed_game'])
 def test_no_games_empty_aggregate(self):
  x=r.aggregate([],0);self.assertIsNone(x['rates']['completion_pct']['value'])
 def test_signed_yards(self):
  a={f:1 for f in r.FIELDS};a['passing_yards']=-5
  self.assertEqual(r.aggregate([{'observed':a}],1)['rates']['passing_yards_per_attempt']['value'],-5)
 def test_missing_game_not_counted_as_observed_zero(self):
  a={f:3 for f in r.FIELDS};x=r.aggregate([{'observed':a}],2)
  self.assertEqual(x['metrics']['carries']['total'],3);self.assertEqual(x['metrics']['carries']['missing_games'],1);self.assertEqual(x['metrics']['carries']['per_observed_game'],3)
 def test_all_opponents_exact_reciprocal(self):
  idx={(x['week'],x['game_id'],x['team']):x for x in self.rows}
  for slot in self.out['slots']:
   if slot['status']=='observed':self.assertEqual(slot['opponent_observed'],idx[slot['week'],slot['game_id'],slot['opponent']]['observed'])
 def test_future_observation_mutation_does_not_change_earlier_profiles(self):
  for cutoff in range(1,5):
   changed=copy.deepcopy(self.rows)
   for row in changed:
    if row['week']>cutoff:row['observed']['sacks_suffered']+=100
   other=r.make_output(self.weeks,self.rop,changed,self.q)
   self.assertEqual([p for p in self.out['profiles'] if p['through_week']<=cutoff],[p for p in other['profiles'] if p['through_week']<=cutoff])
 def test_optional_rop_failure_does_not_erase_tts(self):
  x=r.make_output(self.weeks,None,self.rows,self.q)
  self.assertEqual(x['coverage'],self.out['coverage']);self.assertTrue(all(s['player_context'] is None for s in x['slots']))
 def test_unassigned_source_gaps_not_attached_to_team(self):
  self.assertEqual(len(self.out['unassigned_rop_missing_source_weeks']),106)
  self.assertTrue(all(x['team_membership']=='unverified' and 'team' not in x for x in self.out['unassigned_rop_missing_source_weeks']))
 def test_selected_receivers_not_normalized_to_100(self):
  for s in self.out['slots']:
   p=s['player_context']
   if p:
    self.assertEqual(p['selected_targets']+p['other_or_unselected_targets'],p['credited_team_targets'])
    self.assertEqual(p['selected_carries']+p['other_or_unselected_carries'],p['all_team_carries'])
  self.assertTrue(any(s['player_context'] and s['player_context']['other_or_unselected_targets']>0 for s in self.out['slots']))
 def test_wrong_rop_game_rejected(self):
  rop=copy.deepcopy(self.rop);rop['rows'][0]['game_id']='2026_01_SEA_SF'
  with self.assertRaises(r.IntegrityError):r.make_output(self.weeks,rop,self.rows,self.q)
 def test_wrong_rop_native_id_rejected(self):
  rop=copy.deepcopy(self.rop);rop['rows'][0]['player_id']='fake'
  with self.assertRaises(r.IntegrityError):r.make_output(self.weeks,rop,self.rows,self.q)
 def test_wrong_rop_denominator_rejected(self):
  rop=copy.deepcopy(self.rop);rop['rows'][0]['fields']['carryShare']['denominator']+=1
  with self.assertRaises(r.IntegrityError):r.make_output(self.weeks,rop,self.rows,self.q)
 def test_wrong_rop_candidate_rejected(self):
  rop=copy.deepcopy(self.rop);rop['rows'][0]['input_refs'][0]['candidate_sha256']='0'*64
  with self.assertRaises(r.IntegrityError):r.make_output(self.weeks,rop,self.rows,self.q)
 def test_wrong_rop_count_rejected(self):
  rop=copy.deepcopy(self.rop);rop['rows'][0]['fields']['carries']['value']+=1
  with self.assertRaises(r.IntegrityError):r.make_output(self.weeks,rop,self.rows,self.q)
 def test_duplicate_rop_key_rejected(self):
  rop=copy.deepcopy(self.rop);rop['rows'].append(rop['rows'][0])
  with self.assertRaises(r.IntegrityError):r.make_output(self.weeks,rop,self.rows,self.q)
 def test_duplicate_json_keys_rejected(self):
  with self.assertRaises(r.IntegrityError):r.strict_json('{"x":1,"x":2}')
 def test_nonfinite_json_rejected(self):
  with self.assertRaises(r.IntegrityError):r.strict_json('{"x":NaN}')
 def test_one_byte_alteration_rejected(self):
  with self.assertRaises(r.IntegrityError):r.pin(b'abd',{'size':3,'sha256':r.sha(b'abc')},'synthetic')
 def test_malformed_csv_rejected(self):
  with self.assertRaises(r.IntegrityError):r.table(b'a,b\n1,2,3\n')
 def test_duplicate_csv_header_rejected(self):
  with self.assertRaises(r.IntegrityError):r.table(b'a,a\n1,2\n')
 def test_duplicate_tts_row_rejected(self):
  with self.assertRaises(r.IntegrityError):r.make_output(self.weeks,self.rop,self.rows+[self.rows[0]],self.q)
 def test_no_legacy_scores(self):
  self.assertNotIn('score',self.out)
  self.assertEqual(self.out['metric_fields'],list(r.FIELDS))
 def test_w5_bye_cumulative_denominator(self):
  for t in ('CAR','KC'):
   x=next(p for p in self.out['profiles'] if p['team']==t and p['through_week']==5)
   self.assertEqual(x['own_offense']['expected_games'],4);self.assertEqual(x['own_offense']['metrics']['attempts']['observed_games'],4)
 def test_profile_serialization_deterministic(self):
  self.assertEqual(r.dump(self.out),r.dump(r.make_output(self.weeks,self.rop,self.rows,self.q)))

if __name__=='__main__':unittest.main(verbosity=2)
