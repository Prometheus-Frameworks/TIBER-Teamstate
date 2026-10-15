"""Private TTS W1-W5 release: authenticated retained data -> existing TTS successor -> profiles.

No network, no ROP execution, no provider activation, no source mutation. The source
archive and original records are immutable. This executor's checks are NOT an
independent review. Exact final release review remains a separate gate.
"""
from __future__ import annotations
import base64, csv, hashlib, importlib.util, io, json, math, re, subprocess, zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'TIBER-ROP-2026-W01-W05/'
ROP_HASH = 'd2bb08b185c7ec73d80480ccc7cbc234ce02d89ac6d57308f6bcfa34ff69af13'
FIELDS = ('attempts','completions','passing_yards','passing_tds','passing_interceptions',
          'sacks_suffered','carries','rushing_yards','rushing_tds','fumbles_lost_total')
RATES = {'completion_pct':('completions','attempts',100),
         'passing_yards_per_attempt':('passing_yards','attempts',1),
         'rushing_yards_per_carry':('rushing_yards','carries',1)}
UNKNOWN = ['EPA','success rate','neutral pass rate / PROE','pace','drives','red-zone rates',
           'pressures','time to throw','routes','coverage / man-zone','separation',
           'motion / personnel','blocking quality','scoreboard points','fantasy projections',
           'opponent-adjusted quality','coaching trust','game-script causality']

class IntegrityError(ValueError): pass

def sha(raw: bytes) -> str: return hashlib.sha256(raw).hexdigest()
def strict_json(raw: bytes | str) -> Any:
    def unique(pairs):
        result = {}
        for k,v in pairs:
            if k in result: raise IntegrityError(f'Duplicate JSON key: {k}')
            result[k] = v
        return result
    def bad(v): raise IntegrityError(f'Nonfinite JSON constant: {v}')
    return json.loads(raw, object_pairs_hook=unique, parse_constant=bad)
def dump(value: Any) -> bytes:
    return (json.dumps(value,ensure_ascii=False,allow_nan=False,sort_keys=True,indent=2)+'\n').encode()
def need(condition: bool, message: str) -> None:
    if not condition: raise IntegrityError(message)
def same(a: Any,b: Any,label: str) -> None: need(a==b,label)
def pin(raw: bytes, expected: dict, label: str) -> None:
    same(len(raw),expected['size'],label+' size');same(sha(raw),expected['sha256'],label+' SHA-256')
def table(raw: bytes) -> list[dict]:
    reader=csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
    need(reader.fieldnames is not None and len(set(reader.fieldnames))==len(reader.fieldnames),'Duplicate/missing CSV header')
    rows=list(reader)
    need(all(None not in row and all(v is not None for v in row.values()) for row in rows),'Malformed CSV row')
    return rows

def data_module():
    p=ROOT/'code/upstream/build_weekly_boxscore_candidate_v0.py'
    same(sha(p.read_bytes()),'e3195d836b2fcc77895ff05a8722f8fb24b50d0fdde50bf0b36730b9d8ef920d','Retained Data builder')
    spec=importlib.util.spec_from_file_location('retained_data_facts',p)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    return mod

def load_and_qualify() -> tuple[dict,dict,dict]:
    """Recheck retained archive, receipts, independent Data input bindings, raw facts and schedule."""
    archive=ROOT/'inputs/ROP-original.zip';raw=archive.read_bytes()
    same(sha(raw),ROP_HASH,'Original ROP archive');same(len(raw),24420710,'Original ROP archive size')
    need(archive.is_file() and not archive.is_symlink(),'Source archive is not a regular file')
    module=data_module();weeks={};pins=[];totals=Counter()
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        names=z.namelist();same(len(names),len(set(names)),'Duplicate ZIP member')
        def read(path: str) -> bytes:
            need('..' not in Path(path).parts and not path.startswith('/'),'Unsafe source path')
            return z.read(PREFIX+path)
        manifest=strict_json(read('MANIFEST.json'))
        for item in manifest['files']:
            pin(read(item['path']),item,item['path']);totals['source_manifest_members']+=1
        input_m=read('input-manifest.json')
        review=strict_json(read('inputs/private-release/independent-input-review-r2.json'))
        same(review['input_manifest_sha256'],sha(input_m),'Existing Data review input binding')
        same(review['disposition'],'clean','Existing Data input review');same(review['material_findings'],[],'Data findings')
        review_candidates={x['week']:x['candidate_sha256'] for x in review['candidates']}
        for week in range(1,6):
            witness_path=f'inputs/private-release/witnesses/w{week:02}.json'
            wb=read(witness_path);witness=strict_json(wb)
            same(witness['scope'],{'season':2026,'seasonType':'REG','week':week},'Witness scope')
            for item in witness['members']:pin(read('inputs/'+item['path']),item,item['path'])
            cp='inputs/'+witness['candidate_path']; cb=read(cp);c=strict_json(cb)
            same(sha(cb),review_candidates[week],'Candidate not covered by retained Data review')
            same(sha(cb),witness['candidate_sha256'],'Candidate witness digest')
            members=[x['path'] for x in witness['members']]
            find=lambda suffix: next(x for x in members if x.endswith(suffix))
            team_path=find('/team.csv');player_path=find('/player.csv');schedule_path=find('/games.csv')
            source_receipt_path=str(Path(team_path).parent/'receipt.json')
            schedule_receipt_path=str(Path(schedule_path).parent/'receipt.json')
            receipt=strict_json(read('inputs/'+source_receipt_path))
            sr=strict_json(read('inputs/'+schedule_receipt_path))
            same(c['source_receipt_sha256'],sha(read('inputs/'+source_receipt_path)),'Embedded source receipt pin')
            same(c['candidate']['source_receipt'],receipt,'Embedded source receipt differs')
            same(receipt['requested_scope'],{'season':2026,'season_type':'REG','week':week},'Receipt scope')
            for kind,p in [('team',team_path),('player',player_path)]:
                rp=receipt['sources'][kind];pin(read('inputs/'+p),{'size':rp['byte_count'],'sha256':rp['sha256']},kind)
            pin(read('inputs/'+schedule_path),{'size':sr['byte_count'],'sha256':sr['sha256']},'Schedule')
            for k,v in sr.items():same(c['schedule_receipt'].get(k),v,'Embedded schedule receipt '+k)
            for rc,parent in [(receipt,Path(team_path).parent),(sr,Path(schedule_path).parent)]:
                same(rc['attribution']['license'],'CC BY 4.0','Retained source license')
                lb=read('inputs/'+str(parent/'LICENSE.md'))
                same(sha(lb),rc['attribution']['license_sha256'],'Retained source license pin')
            # Reuse the original, inspected Data fact builder as a consistency check.
            # No acquisition main(), source publication or ROP program is called.
            rebuilt=module.build_candidate(read('inputs/'+player_path),read('inputs/'+team_path),receipt)
            same(rebuilt['teams'],c['candidate']['teams'],'Retained Data team facts differ from their raw evidence')
            schedules=table(read('inputs/'+schedule_path))
            full_regular=[x for x in schedules if x['season']=='2026' and x['game_type']=='REG']
            full_ids=[x['game_id'] for x in full_regular]
            need(len(full_ids)==len(set(full_ids)),'Duplicate retained full-season game')
            team_universe=sorted({x[k] for x in full_regular for k in ['home_team','away_team']})
            same(len(team_universe),32,'Retained schedule team universe')
            schedule=[x for x in full_regular if x['week']==str(week)]
            appearances=[t for g in schedule for t in [g['away_team'],g['home_team']]]
            need(len(appearances)==len(set(appearances)),'Duplicate team in weekly schedule')
            games=sorted(x['game_id'] for x in schedule)
            for g in schedule:
                same(g['game_id'],f"2026_{week:02}_{g['away_team']}_{g['home_team']}",'Schedule native identity')
                need(re.fullmatch(r'\d{4}-\d{2}-\d{2}',g['gameday']) is not None,'Missing schedule date')
            same(games,c['coverage']['scheduled_game_ids'],'Independent schedule membership')
            same(games,c['coverage']['observed_game_ids'],'Observed membership')
            same(c['coverage']['missing_game_ids'],[],'Retained missing game')
            same(c['coverage']['unexpected_game_ids'],[],'Retained unexpected game')
            no_game=[t for t in team_universe if t not in appearances]
            # No-game is a property of the pinned complete schedule inventory, not inferred from the boxscore.
            # It makes no claim about later schedule corrections or current availability.
            weeks[week]={'scope':{'season':2026,'week':week,'games':games},'candidate_bytes':cb,'candidate':c,
                'team_universe':team_universe,'no_game':no_game,'schedule':schedule,'witness':witness,
                'source':{'candidate_path':cp,'candidate_sha256':sha(cb),'witness_path':witness_path,'witness_sha256':sha(wb),
                    'source_receipt_path':'inputs/'+source_receipt_path,'source_receipt_sha256':sha(read('inputs/'+source_receipt_path)),
                    'team_csv_path':'inputs/'+team_path,'team_csv_sha256':sha(read('inputs/'+team_path)),
                    'schedule_path':'inputs/'+schedule_path,'schedule_sha256':sr['sha256'],
                    'team_release_asset_updated_at':receipt['sources']['team']['release_asset_updated_at'],
                    'team_retrieved_at':receipt['sources']['team']['retrieval_completed_at'],
                    'schedule_retrieved_at':sr['retrieval_completed_at'],'data_generated_at':witness['build_completed_at'],
                    'attribution':receipt['attribution'],'upstream_finality':'unknown','correction':'open','evidence_cutoff':None}}
            totals['raw_team_rows']+=len(rebuilt['teams']);totals['baseline_operands_reconciled']+=len(rebuilt['teams'])*len(FIELDS)
        same(len({tuple(x['team_universe']) for x in weeks.values()}),1,'Team universe drift across pinned schedules')
        rop_raw=read('outputs/player-weeks.json');rop=strict_json(rop_raw)
        rr=strict_json(read('review/output-review.json'))
        rp=next(x for x in rr['output_files'] if x['path']=='outputs/player-weeks.json');pin(rop_raw,rp,'Reviewed ROP evidence')
        same(rr['disposition'],'clean','Retained ROP review')
        same(rr['run_id'],rop['run_id'],'Retained ROP run')
        same(rop['input_manifest_sha256'],sha(input_m),'ROP input manifest')
        rop['original_payload_sha256']=sha(rop_raw)
    report={'method':'execution-agent qualification; NOT independent final-release review','checks':dict(totals),
        'source_archive_sha256':ROP_HASH,'existing_data_review':{'disposition':review['disposition'],'reviewer':review['reviewer'],
        'completed_at':review['completed_at'],'input_manifest_sha256':review['input_manifest_sha256']},
        'week_coverage':[{'week':w,'games':len(x['scope']['games']),'team_games':len(x['schedule'])*2,
                         'no_game_in_pinned_schedule':x['no_game'],'source':x['source']} for w,x in weeks.items()],
        'limits':['Source rights inherited from exact retained notices and prior bounded assessment, not blanket clearance.',
                  'No current-provider refresh or original-cutoff availability claim.','Raw/candidate consistency is same-source evidence.']}
    return weeks,rop,report

def run_tts(weeks: dict) -> list[dict]:
    request=[{'scope':v['scope'],'bytes':base64.b64encode(v['candidate_bytes']).decode()} for _,v in sorted(weeks.items())]
    result=subprocess.run(['node',str(ROOT/'code/inspect-batch.cjs')],input=json.dumps(request),text=True,capture_output=True,timeout=40)
    if result.returncode: raise IntegrityError('TTS inspector rejected input: '+result.stderr[:3000])
    batches=strict_json(result.stdout)
    same(len(batches),len(weeks),'TTS batch count')
    return [r for b in batches for r in b['rows']]

def ratio(n: int|None,d: int|None,scale: int=1) -> dict:
    ok=n is not None and d is not None and d>0
    return {'numerator':n,'denominator':d,'value':scale*n/d if ok else None,'scale':scale,
            'status':'available' if ok else 'unavailable','reason':None if ok else 'missing_or_zero_denominator'}

def aggregate(rows: list[dict], expected_games: int) -> dict:
    """All arithmetic uses only supplied records; incomplete totals are labelled partial."""
    metrics={}
    for field in FIELDS:
        values=[r['observed'][field] for r in rows]
        finite=[v for v in values if v is not None]
        total=sum(finite) if finite else None
        metrics[field]={'total':total,'observed_games':len(finite),'expected_games':expected_games,
           'missing_games':expected_games-len(finite),'per_observed_game':total/len(finite) if finite else None,
           'status':'complete' if len(finite)==expected_games and expected_games>0 else 'partial' if finite else 'unavailable'}
    rates={}
    for name,(nf,df,scale) in RATES.items():
        # Paired valid operands, never mismatched missing-field populations.
        pairs=[(r['observed'][nf],r['observed'][df]) for r in rows
               if r['observed'][nf] is not None and r['observed'][df] is not None]
        value=ratio(sum(x[0] for x in pairs) if pairs else None,sum(x[1] for x in pairs) if pairs else None,scale)
        value.update({'observed_games':len(pairs),'expected_games':expected_games,
                      'coverage':'complete' if len(pairs)==expected_games and expected_games>0 else 'partial' if pairs else 'unavailable',
                      'formula':f'{scale} * sum({nf}) / sum({df})'})
        rates[name]=value
    return {'observed_records':len(rows),'expected_games':expected_games,'metrics':metrics,'rates':rates}

def attach_rop(rop: dict, weeks: dict, row_index: dict) -> tuple[dict,list[dict]]:
    attached=defaultdict(list);unknown=[];seen=set()
    for row in rop['rows']:
        identity=(row['player_id'],row['week']);need(identity not in seen,'Duplicate retained ROP player/week');seen.add(identity)
        same(row['season'],2026,'ROP season');same(row['season_type'],'REG','ROP season type')
        need(1<=row['week']<=5,'ROP week scope');need(re.fullmatch(r'00-\d{7}',row['player_id']) is not None,'ROP native identity')
        if row['coverage_status']!='observed':
            unknown.append({'player_id':row['player_id'],'player_name':row['player_name'],'position':row['position'],'week':row['week'],
                'status':row['coverage_status'],'team_membership':'unverified','reason':'No source row; not assigned to a team or labelled bye/injury.'})
            continue
        same(row['identity_status'],'source_native_resolved','ROP identity qualification')
        same(len(row['segments']),1,'Multi-segment ROP projection needs a separate explicitly segmented view')
        key=(row['week'],row['game_id'],row['team']);need(key in row_index,'ROP game/team absent from TTS')
        same(row['opponent'],row_index[key]['opponent_team'],'ROP opponent')
        same(row['input_refs'][0]['candidate_sha256'],weeks[row['week']]['source']['candidate_sha256'],'ROP/TTS candidate drift')
        fields=row['fields'];cand=weeks[row['week']]['candidate']['candidate']
        native=next((p for p in cand['players'] if p['identity']['player_id']==row['player_id'] and p['identity']['game_id']==row['game_id'] and p['identity']['team']==row['team']),None)
        need(native is not None,'ROP native ID not found in candidate')
        for f,nf in [('carries','carries'),('targets','targets'),('receptions','receptions'),('passAttempts','attempts')]:
            same(fields[f]['value'],native['observed'][nf],'ROP count differs from retained native source')
        for share,denf,nf in [('carryShare','carries','carries'),('targetShare','targets','targets'),('passAttemptShare','attempts','passAttempts')]:
            if share not in fields:continue
            s=fields[share]
            if s['status']=='available':
                same(s['numerator'],fields[nf]['value'],'ROP share numerator')
                ct=next(t for t in cand['teams'] if t['identity']['game_id']==row['game_id'] and t['identity']['team']==row['team'])
                same(s['denominator'],ct['observed'][denf],'ROP team denominator')
                need(s['denominator']>0 and math.isclose(s['value'],s['numerator']/s['denominator'],abs_tol=1e-12),'ROP share arithmetic')
        attached[key].append({'player_id':row['player_id'],'player_name':row['player_name'],'position':row['position'],
            'week':row['week'],'team':row['team'],'opponent':row['opponent'],'game_id':row['game_id'],
            'carries':fields['carries']['value'],'targets':fields['targets']['value'],'receptions':fields['receptions']['value'],
            'carry_share':fields.get('carryShare'),'target_share':fields.get('targetShare'),
            'pass_attempt_share':fields.get('passAttemptShare'),'pass_attempts':fields['passAttempts']['value'],
            'source_payload_sha256':rop['original_payload_sha256'],'state_path':row['state_path'],
            'source_refs':row['input_refs'],'coverage_status':'observed','source_generated_at':row['generated_at']})
    return dict(attached),unknown

def make_output(weeks: dict,rop: dict | None,rows: list[dict],qualification: dict) -> dict:
    index={(r['week'],r['game_id'],r['team']):r for r in rows}
    same(len(index),len(rows),'Duplicate TTS output row')
    attached,unknown=attach_rop(rop,weeks,index) if rop is not None else ({},[])
    teams=weeks[1]['team_universe'];slots=[]
    for team in teams:
        for week in range(1,6):
            w=weeks[week];schedule=[g for g in w['schedule'] if team in (g['away_team'],g['home_team'])]
            if not schedule:
                slots.append({'team':team,'week':week,'season':2026,'season_type':'REG','status':'no_game_in_pinned_schedule',
                    'game_id':None,'opponent':None,'gameday':None,'observed':None,'opponent_observed':None,
                    'player_context':None,'source':w['source'],
                    'reason':'Verified against the full retained weekly schedule, not inferred from missing boxscore; later schedule corrections not tested.'})
                continue
            same(len(schedule),1,'Multiple team games in week');game=schedule[0];key=(week,game['game_id'],team)
            if key not in index:
                slots.append({'team':team,'week':week,'season':2026,'season_type':'REG','status':'missing_source_evidence','observed':None,
                    'opponent_observed':None,'player_context':None,'source':w['source'],'game_id':game['game_id'],
                    'opponent':game['home_team'] if team==game['away_team'] else game['away_team'],'gameday':game['gameday']})
                continue
            row=index[key];other=index[(week,row['game_id'],row['opponent_team'])]
            roster=sorted(attached.get(key,[]),key=lambda p:(p['position'],p['player_id']))
            ct=next(t for t in w['candidate']['candidate']['teams'] if t['identity']['game_id']==row['game_id'] and t['identity']['team']==team)
            # Denominator is the original credited-team target count in the ROP source, not a new TTS metric.
            td=ct['observed']['targets'];cs=row['observed']['carries']
            st=sum(p['targets'] for p in roster) if all(p['targets'] is not None for p in roster) else None
            sc=sum(p['carries'] for p in roster) if all(p['carries'] is not None for p in roster) else None
            if td is not None and st is not None:need(st<=td,'Selected targets exceed source denominator')
            if cs is not None and sc is not None:need(sc<=cs,'Selected carries exceed source denominator')
            slots.append({'team':team,'week':week,'season':2026,'season_type':'REG','status':'observed','game_id':row['game_id'],
               'opponent':row['opponent_team'],'gameday':game['gameday'],'observed':row['observed'],
               'source_csv_row':row['source_csv_row'],'reconciliation':row['reconciliation'],'source':w['source'],
               'rates':{n:{**ratio(row['observed'][nf],row['observed'][df],scale),'formula':f'{scale} * {nf} / {df}'} for n,(nf,df,scale) in RATES.items()},
               'opponent_observed':other['observed'],'opponent_source_csv_row':other['source_csv_row'],
               'opponent_output_label':'Same-game faced-offense output, unadjusted; not an independent witness or defensive rating.',
               'player_context':{'rows':roster,'selection_size':rop['population_count'],'source_payload_sha256':rop['original_payload_sha256'],
                  'credited_team_targets':td,'selected_targets':st,'other_or_unselected_targets':td-st if td is not None and st is not None else None,
                  'all_team_carries':cs,'selected_carries':sc,'other_or_unselected_carries':cs-sc if cs is not None and sc is not None else None,
                  'denominator_source':'Original matching ROP Data team record; targets are receiver-credited, not pass attempts.',
                  'missing_identities':'Global missing-source player weeks are retained separately; team membership is not inferred.'} if rop is not None else None})
    profiles=[]
    for team in teams:
        for through in range(1,6):
            within=[s for s in slots if s['team']==team and s['week']<=through]
            good=[s for s in within if s['status']=='observed']
            expected=sum(s['status']!='no_game_in_pinned_schedule' for s in within)
            own=aggregate(good,expected)
            faced=aggregate([{'observed':s['opponent_observed']} for s in good],expected)
            profiles.append({'team':team,'through_week':through,'scope':'Retrospective through-week view, not original-cutoff availability',
                'week_keys':[[x['team'],x['week']] for x in within],'own_offense':own,'faced_offense':faced,
                'weekly_changes':[{'week':b['week'],'previous_observed_week':a['week'],'previous_opponent':a['opponent'],'opponent':b['opponent'],
                    'deltas':{f:b['observed'][f]-a['observed'][f] if b['observed'][f] is not None and a['observed'][f] is not None else None for f in FIELDS}}
                    for a,b in zip(good,good[1:])],
                'question_scope':'Questions only. Counts do not identify game-script causes, player routes, coverage or coaching trust.'})
    return {'schema_version':'tts_private_team_profiles_v1','release_identity':strict_json((ROOT/'records/release-identity.json').read_bytes()),'revision':'candidate-r1','season':2026,'season_type':'REG','weeks':[1,2,3,4,5],
        'status':'private_candidate_pending_independent_release_review','source_archive_sha256':ROP_HASH,'team_codes':teams,
        'coverage':{'teams':len(teams),'team_week_slots':len(slots),'observed_team_games':sum(s['status']=='observed' for s in slots),
           'no_game_slots':sum(s['status']=='no_game_in_pinned_schedule' for s in slots),
           'missing_source_slots':sum(s['status']=='missing_source_evidence' for s in slots),
           'observed_fields':sum(v is not None for s in slots if s['status']=='observed' for v in s['observed'].values()),
           'null_fields_in_observed_rows':sum(v is None for s in slots if s['status']=='observed' for v in s['observed'].values())},
        'qualification':qualification,'rop_attachment_status':'attached_from_exact_retained_release' if rop is not None else 'unavailable_not_required_for_tts','metric_fields':list(FIELDS),'unsupported':UNKNOWN,
        'slots':slots,'profiles':profiles,'unassigned_rop_missing_source_weeks':unknown,
        'limits':['Provisional retained snapshots; unknown game finality and open corrections.',
                  'No original-weekly-cutoff availability claim; retrospective snapshots retain their actual retrieval clocks.',
                  'Faced-offense joins are unadjusted and share source lineage with team/player observations.',
                  'No independent final TTS code/output review has been performed in this execution context.',
                  'Repeated private reading requested by Joe; qualified recurring Playbook use pending final review.'],
        'external_actions':{'github_writes':False,'deployment':False,'rop_rerun':False,'new_acquisition':False,'schedule_changes':False}}

def produce(include_rop: bool = True) -> dict:
    weeks,rop,qualification=load_and_qualify()
    rows=run_tts(weeks)
    return make_output(weeks,rop if include_rop else None,rows,qualification)

def write_payload(output: dict,directory: Path) -> None:
    directory.mkdir(parents=True,exist_ok=False)
    (directory/'team-profiles.json').write_bytes(dump(output))
    coverage=[{k:s.get(k) for k in ['team','week','season','season_type','status','game_id','opponent','gameday','reason']} for s in output['slots']]
    (directory/'coverage.json').write_bytes(dump(coverage))
    rows=[]
    for s in output['slots']:
        r={k:s.get(k) for k in ['team','week','season','season_type','status','game_id','opponent','gameday']}
        r.update({f:s['observed'].get(f) if s['observed'] is not None else None for f in FIELDS})
        r.update({'source_candidate_sha256':s['source']['candidate_sha256'],'team_csv_sha256':s['source']['team_csv_sha256'],
                  'source_csv_row':s.get('source_csv_row'),'finality':'unknown','correction':'open'})
        rows.append(r)
    with (directory/'team-weeks.csv').open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    with (directory/'coverage.csv').open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=list(coverage[0]));writer.writeheader();writer.writerows(coverage)
    (directory/'input-qualification.json').write_bytes(dump(output['qualification']))
    (directory/'rop-unassigned-gaps.json').write_bytes(dump(output['unassigned_rop_missing_source_weeks']))
