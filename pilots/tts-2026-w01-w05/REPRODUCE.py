#!/usr/bin/env python3
"""Reproduce the private frozen TTS payload offline into a NEW directory.
Python 3.10+ and Node 22 are required; no npm install or external service is used.
"""
from pathlib import Path
import argparse,datetime,hashlib,json,sys
ROOT=Path(__file__).resolve().parent
sys.dont_write_bytecode=True
sys.path.insert(0,str(ROOT/'code'))
import release,render_view

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
 out=args.out.resolve()
 if out.exists():raise SystemExit('Refusing to overwrite an existing path. Choose a new output directory.')
 for protected in ['inputs','history','records','code','checks','review','outputs']:
  if out.is_relative_to(ROOT/protected):raise SystemExit('Output may not be inside retained source/code/record/output directories.')
 pins=json.loads((ROOT/'INPUT_CODE_MANIFEST.json').read_text())
 for item in pins['files']:
  p=ROOT/item['path']
  if p.is_symlink() or not p.is_file():raise SystemExit('Non-regular pinned input: '+item['path'])
  release.pin(p.read_bytes(),item,item['path'])
 started=datetime.datetime.now(datetime.timezone.utc).isoformat()
 payload=release.produce();release.write_payload(payload,out)
 render_view.render(payload,out/'TIBER-TTS-2026-W01-W05.html')
 expected=json.loads((ROOT/'records/expected-payloads.json').read_text());verified=[]
 for pin in expected['files']:
  p=out/pin['path'];release.pin(p.read_bytes(),pin,pin['path']);verified.append(pin['path'])
 record={'started_at_utc':started,'completed_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'mode':'offline verification replay, retaining frozen release identity; not a fresh football update',
  'matched_files':verified,'status':'byte_identical','external_calls':False,'rop_producer_invoked':False}
 (out/'reproduction-attempt.json').write_text(json.dumps(record,indent=2)+'\n')
 print(json.dumps(record,indent=2))

if __name__=='__main__':main()
