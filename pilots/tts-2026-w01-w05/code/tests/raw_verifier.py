"""Methodologically separate raw-CSV check, written/run by the SAME execution agent.
This is not an independent-agent or human review. No Data/TTS producer is imported.
"""
from pathlib import Path
from decimal import Decimal
from collections import defaultdict
import csv,io,json,hashlib,zipfile,math,datetime
R=Path(__file__).resolve().parents[2]
FIELDS=('attempts','completions','passing_yards','passing_tds','passing_interceptions','sacks_suffered','carries','rushing_yards','rushing_tds','fumbles_lost_total')
def integer(s):
 if s in ('','NA','NaN','null',None):return None
 d=Decimal(s);assert d.is_finite() and d==int(d);return int(d)
def rows(b):return list(csv.DictReader(io.StringIO(b.decode('utf-8-sig'))))
def equal(a,b):
 if isinstance(a,float) or isinstance(b,float):assert a is not None and b is not None and math.isclose(a,b,rel_tol=1e-12,abs_tol=1e-12),(a,b)
 else:assert a==b,(a,b)
o=json.loads((R/'outputs/candidate-r1/team-profiles.json').read_text());counts=defaultdict(int);facts={};players={};schedules={}
with zipfile.ZipFile(R/'inputs/ROP-original.zip') as z:
 root='TIBER-ROP-2026-W01-W05/'
 for w in range(1,6):
  witness=json.loads(z.read(root+f'inputs/private-release/witnesses/w{w:02}.json'))
  paths=[x['path'] for x in witness['members']]
  tr=rows(z.read(root+'inputs/'+next(p for p in paths if p.endswith('/team.csv'))))
  pr=rows(z.read(root+'inputs/'+next(p for p in paths if p.endswith('/player.csv'))))
  sr=rows(z.read(root+'inputs/'+next(p for p in paths if p.endswith('/games.csv'))))
  schedules[w]=[g for g in sr if (g['season'],g['week'],g['game_type'])==('2026',str(w),'REG')]
  for i,x in enumerate(tr,2):
   if (x['season'],x['week'],x['season_type'])==('2026',str(w),'REG'):facts[w,x['game_id'],x['team']]={**x,'_row':i}
  for x in pr:
   if (x['season'],x['week'],x['season_type'])==('2026',str(w),'REG') and x['player_id']:
    players[w,x['game_id'],x['team'],x['player_id']]=x
for s in o['slots']:
 w=s['week'];t=s['team'];g=[g for g in schedules[w] if t in (g['home_team'],g['away_team'])]
 if not g:
  equal(s['status'],'no_game_in_pinned_schedule');assert s['observed'] is None;counts['schedule_no_game_slots']+=1;continue
 equal(len(g),1);equal(s['game_id'],g[0]['game_id']);raw=facts[w,s['game_id'],t];opp=facts[w,s['game_id'],s['opponent']]
 equal(s['source_csv_row'],raw['_row']);equal(s['opponent_source_csv_row'],opp['_row'])
 for f in FIELDS:
  equal(s['observed'][f],integer(raw[f]));counts['baseline_fields_direct_raw']+=1
  equal(s['opponent_observed'][f],integer(opp[f]));counts['opponent_fields_direct_raw']+=1
 pc=s['player_context'];equal(pc['credited_team_targets'],integer(raw['targets']));equal(pc['all_team_carries'],integer(raw['carries']))
 for p in pc['rows']:
  prow=players[w,s['game_id'],t,p['player_id']]
  for f in ('carries','targets','receptions'):
   equal(p[f],integer(prow[f]));counts['rop_attached_counts_direct_raw']+=1
  if p['target_share'] and p['target_share']['status']=='available':
   equal(p['target_share']['denominator'],integer(raw['targets']));equal(p['target_share']['value'],integer(prow['targets'])/integer(raw['targets']));counts['rop_target_share_checks']+=1
  if p['carry_share'] and p['carry_share']['status']=='available':
   equal(p['carry_share']['value'],integer(prow['carries'])/integer(raw['carries']));counts['rop_carry_share_checks']+=1
for p in o['profiles']:
 team=p['team'];n=p['through_week'];eligible=[(w,g) for w,gs in schedules.items() if w<=n for g in gs if team in (g['away_team'],g['home_team'])]
 equal(len(eligible),p['own_offense']['expected_games']);equal(len(eligible),p['faced_offense']['expected_games'])
 own=[facts[w,g['game_id'],team] for w,g in eligible]
 faced=[facts[w,g['game_id'],g['home_team'] if g['away_team']==team else g['away_team']] for w,g in eligible]
 for side,rs in [('own_offense',own),('faced_offense',faced)]:
  for f in FIELDS:
   vs=[integer(x[f]) for x in rs];assert all(v is not None for v in vs)
   equal(p[side]['metrics'][f]['total'],sum(vs));equal(p[side]['metrics'][f]['per_observed_game'],sum(vs)/len(rs));counts['cumulative_field_totals_and_means']+=2
  for key,nf,df,scale in [('completion_pct','completions','attempts',100),('passing_yards_per_attempt','passing_yards','attempts',1),('rushing_yards_per_carry','rushing_yards','carries',1)]:
   numerator=sum(integer(x[nf]) for x in rs);denominator=sum(integer(x[df]) for x in rs)
   equal(p[side]['rates'][key]['value'],scale*numerator/denominator if denominator else None);counts['cumulative_ratio_checks']+=1
report={'method':'same-execution-agent separate raw-CSV verifier; no producer imports; NOT independent review','completed_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'counts':dict(counts),'status':'passed','failures':[]}
(R/'checks/raw-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
