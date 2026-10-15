'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {inspectReleaseWeek}=require('../compiled/inspectReleaseWeek.js');
const {RELEASE_FIELDS}=require('../compiled/releaseFields.js');
const bytes=x=>Buffer.from(JSON.stringify(x));
const scope=(w=1)=>({season:2026,week:w,games:[`2026_${String(w).padStart(2,'0')}_SEA_SF`]});
function fixture(w=1){
 const s=scope(w);return {schema_version:'weekly_boxscore_publication_candidate_v0',status:'candidate_needs_review',consumer_admitted:false,
  coverage:{game_finality:'unknown',full_week_final:false,schedule_coverage:'matched',scheduled_game_ids:s.games,observed_game_ids:s.games,missing_game_ids:[],unexpected_game_ids:[]},
  candidate:{schema_version:'weekly_boxscore_candidate_v0',status:'candidate_needs_review',consumer_admitted:false,scope:{season:2026,week:w,season_type:'REG'},
   teams:['SEA','SF'].map((t,i)=>({identity:{season:2026,season_type:'REG',week:w,game_id:s.games[0],team:t,opponent_team:i?'SEA':'SF'},
    source:'nflverse_stats_team',source_csv_row:i+2,observed:Object.fromEntries(RELEASE_FIELDS.map(f=>[f,1])),
    reconciliation:Object.fromEntries(RELEASE_FIELDS.map(f=>[f,{status:'matched',player_sum:1,team_value:1}]))}))}};
}
for(let w=1;w<=5;w++)test(`synthetic week ${w}: two reciprocal rows`,()=>{let r=inspectReleaseWeek(bytes(fixture(w)),scope(w));assert.equal(r.rows.length,2);assert.equal(r.rows[0].week,w)});
for(const w of [0,6,18,-1,1.2])test(`reject unsupported week ${w}`,()=>assert.throws(()=>inspectReleaseWeek(bytes(fixture()),scope(w))));
const mutations={
 'wrong year':x=>x.candidate.scope.season=2025,
 'wrong season type':x=>x.candidate.scope.season_type='POST',
 'wrong week':x=>x.candidate.scope.week=2,
 'wrong row week':x=>x.candidate.teams[0].identity.week=2,
 'self opponent':x=>x.candidate.teams[0].identity.opponent_team='SEA',
 'wrong opponent':x=>x.candidate.teams[0].identity.opponent_team='NE',
 'wrong game':x=>x.candidate.teams[0].identity.game_id='2026_01_NE_SEA',
 'wrong team':x=>x.candidate.teams[0].identity.team='NE',
 'duplicate team':x=>x.candidate.teams[1]=structuredClone(x.candidate.teams[0]),
 'missing team':x=>x.candidate.teams.pop(),
 'duplicate csv row':x=>x.candidate.teams[1].source_csv_row=2,
 'invalid source row':x=>x.candidate.teams[0].source_csv_row=1,
 'false admitted':x=>x.consumer_admitted=true,
 'false fact admitted':x=>x.candidate.consumer_admitted=true,
 'wrong envelope schema':x=>x.schema_version='fixture',
 'wrong fact schema':x=>x.candidate.schema_version='fixture',
 'wrong source':x=>x.candidate.teams[0].source='fixture',
 'false final':x=>x.coverage.game_finality='final',
 'false full final':x=>x.coverage.full_week_final=true,
 'unmatched schedule':x=>x.coverage.schedule_coverage='missing',
 'unexpected game coverage':x=>x.coverage.unexpected_game_ids=['2026_01_NE_SEA'],
 'missing game coverage':x=>x.coverage.missing_game_ids=['2026_01_SEA_SF'],
 'mismatched observed game':x=>x.coverage.observed_game_ids=['2026_01_NE_SEA'],
 'conflicting source subtotal':x=>x.candidate.teams[0].reconciliation.attempts.player_sum=2,
 'mismatched team value':x=>x.candidate.teams[0].reconciliation.attempts.team_value=2,
 'missing observed field':x=>delete x.candidate.teams[0].observed.attempts,
 'missing reconciliation':x=>delete x.candidate.teams[0].reconciliation.attempts,
 'float count':x=>x.candidate.teams[0].observed.attempts=1.5,
 'unsafe integer':x=>x.candidate.teams[0].observed.attempts=Number.MAX_SAFE_INTEGER+1,
 'boolean count':x=>x.candidate.teams[0].observed.attempts=true,
 'string count':x=>x.candidate.teams[0].observed.attempts='1',
};
for(const [name,change] of Object.entries(mutations))test(`reject ${name}`,()=>{const x=fixture();change(x);assert.throws(()=>inspectReleaseWeek(bytes(x),scope()))});
for(const f of RELEASE_FIELDS){
 test(`observed zero ${f} retained`,()=>{const x=fixture();x.candidate.teams[0].observed[f]=0;x.candidate.teams[0].reconciliation[f]={status:'matched',player_sum:0,team_value:0};assert.equal(inspectReleaseWeek(bytes(x),scope()).rows[0].observed[f],0)});
 test(`unknown ${f} remains null`,()=>{const x=fixture();x.candidate.teams[0].observed[f]=null;x.candidate.teams[0].reconciliation[f]={status:'unknown',player_sum:null,team_value:null};assert.equal(inspectReleaseWeek(bytes(x),scope()).rows[0].observed[f],null)});
 test(`negative metric policy ${f}`,()=>{const x=fixture();x.candidate.teams[0].observed[f]=-3;x.candidate.teams[0].reconciliation[f]={status:'matched',player_sum:-3,team_value:-3};if(['passing_yards','rushing_yards'].includes(f))assert.equal(inspectReleaseWeek(bytes(x),scope()).rows[0].observed[f],-3);else assert.throws(()=>inspectReleaseWeek(bytes(x),scope()))});
}
test('invalid UTF8 rejects',()=>assert.throws(()=>inspectReleaseWeek(Buffer.from([0xff]),scope())));
test('oversized bytes reject',()=>assert.throws(()=>inspectReleaseWeek(Buffer.alloc(2000001),scope())));
test('empty expected schedule rejects',()=>assert.throws(()=>inspectReleaseWeek(bytes(fixture()),{...scope(),games:[]})));
test('duplicate expected game rejects',()=>assert.throws(()=>inspectReleaseWeek(bytes(fixture()),{...scope(),games:[...scope().games,...scope().games]})));
test('expected schedule wrong week rejects',()=>assert.throws(()=>inspectReleaseWeek(bytes(fixture()),{...scope(),games:['2026_02_SEA_SF']})));
test('input and returned state are not shared',()=>{const b=bytes(fixture()),original=Buffer.from(b);let r=inspectReleaseWeek(b,scope());r.rows[0].observed.attempts=999;assert.deepEqual(b,original);assert.equal(inspectReleaseWeek(b,scope()).rows[0].observed.attempts,1)});
test('extra unsupported metrics are not exported',()=>{const x=fixture();x.candidate.teams[0].observed.epa=42;assert.equal(inspectReleaseWeek(bytes(x),scope()).rows[0].observed.epa,undefined)});
