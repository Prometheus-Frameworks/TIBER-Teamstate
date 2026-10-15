"""Render the offline profile view. No remote assets, providers, persistent storage or API."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
def render(payload:dict,out:Path)->None:
    # Prevent source text from closing the inert JSON script element.
    data=json.dumps(payload,ensure_ascii=False,allow_nan=False,sort_keys=True,separators=(',',':')).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    out.write_text((ROOT/'code/profile-view.template.html').read_text().replace('__PROFILE_DATA__',data),encoding='utf-8')
