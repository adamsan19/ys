import asyncio
import aiohttp
import json
import os
import time
import random
import re
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import sys

# ============================================================================
# KONFIGURASI
# ============================================================================
DATA_PER_PAGE = 200
PREFIX2_LIMIT = 500

CONFIGS = {
    'doodstream': {
        'api_url': 'https://doodapi.com/api/file/list',
        'api_key': '112623ifbcbltzajwjrpjx', # GANTI DENGAN API KEY ANDA
        'per_page': 200,
        'request_delay': 0.5,
        'max_retries': 3,
        'concurrent_requests': 5
    },
    'lulustream': {
        'api_url': 'https://api.lulustream.com/api/file/list',
        'api_key': '37943j35tc5i1bg3gje5y', # GANTI DENGAN API KEY ANDA
        'per_page': 500,
        'request_delay': 0.5,
        'max_retries': 3,
        'concurrent_requests': 5
    }
}

# ============================================================================
# DATA NORMALIZER
# ============================================================================
class DataNormalizer:
    def clean_and_format_title(self, title: str) -> str:
        if not title: return ''
        clean_title = re.sub(r'([a-z])([A-Z])', r'\1 \2', title)
        clean_title = re.sub(r'([a-zA-Z])[^a-zA-Z\s]+([a-zA-Z])', r'\1 \2', clean_title)
        clean_title = re.sub(r'[^a-zA-Z\s]', '', clean_title)
        clean_title = re.sub(r'\s+', ' ', clean_title).strip().title()
        
        words = clean_title.split()
        if len(words) < 10:
            words += self.get_random_words(5)
        
        unique_words = list(dict.fromkeys(words))
        return ' '.join(unique_words[:12])
    
    def get_random_words(self, count: int) -> List[str]:
        words = [
            'Viral', 'Indo', 'Twitter', 'Tiktok', 'Video', 'HD', 'Terbaru', 'SMA',
            'Jilbab', 'Colmek', 'Live', 'Bokep', 'Skandal', 'Guru', 'Mahasiswa',
            'Update', 'Full', 'Streaming', 'Doodstream', 'Lulustream', 'Terbaru'
        ]
        random.shuffle(words)
        return words[:count]
    
    def parse_duration(self, duration) -> int:
        if isinstance(duration, (int, float)): return int(duration)
        if isinstance(duration, str):
            parts = list(reversed(duration.split(':')))
            seconds = 0
            for idx, val in enumerate(parts):
                try: seconds += int(val) * (60 ** idx)
                except: pass
            return seconds
        return 0

    def generate_category_name(self, title: str) -> str:
        if 'jilbab' in title.lower(): return 'Video Jilbab'
        if 'skandal' in title.lower(): return 'Video Skandal'
        if 'indo' in title.lower(): return 'Video Indo'
        return 'Video Viral'

    def normalize_data(self, api_data: Dict, api_source: str) -> List[Dict]:
        items = []
        if not api_data.get('result') or not isinstance(api_data['result'].get('files'), list):
            return items
        
        for item in api_data['result']['files']:
            filecode = item.get('file_code') or item.get('filecode', '')
            raw_title = item.get('title') or item.get('file_title', '')
            clean_title = self.clean_and_format_title(raw_title)
            duration = self.parse_duration(item.get('length') or item.get('file_length', 0))
            
            n_item = {
                "f": filecode,
                "t": clean_title,
                "si": item.get('single_img') or item.get('player_img', ''),
                "sp": item.get('splash_img') or item.get('player_img', ''),
                "d": duration,
                "vw": int(item.get('views', 0) or item.get('file_views', 0)),
                "up": item.get('uploaded', ''),
                "pe": item.get('protected_embed', ''),
                "pd": item.get('download_url', ''),
                "k": self.generate_category_name(clean_title),
                "src": api_source
            }
            items.append(n_item)
        return items

# ============================================================================
# ASYNC CLIENT
# ============================================================================
class AsyncAPIClient:
    def __init__(self):
        self.normalizer = DataNormalizer()
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session: await self.session.close()

    async def fetch_all(self, config: Dict, source_name: str):
        print(f"🚀 Fetching {source_name}...")
        all_data = []
        url = f"{config['api_url']}?key={config['api_key']}&per_page={config['per_page']}&page=1"
        
        try:
            async with self.session.get(url) as r:
                if r.status != 200: return []
                data = await r.json()
                files = self.normalizer.normalize_data(data, source_name)
                all_data.extend(files)
                
                total_pages = data.get('result', {}).get('total_pages') or data.get('result', {}).get('pages', 1)
                tasks = []
                for p in range(2, total_pages + 1):
                    tasks.append(self.fetch_page(config, source_name, p))
                
                results = await asyncio.gather(*tasks)
                for res in results: all_data.extend(res)
        except Exception as e:
            print(f"Error {source_name}: {e}")
        print(f"✅ {source_name}: {len(all_data)} videos")
        return all_data

    async def fetch_page(self, config: Dict, source_name: str, page: int):
        url = f"{config['api_url']}?key={config['api_key']}&per_page={config['per_page']}&page={page}"
        try:
            await asyncio.sleep(config.get('request_delay', 0.5))
            async with self.session.get(url) as r:
                if r.status == 200:
                    data = await r.json()
                    return self.normalizer.normalize_data(data, source_name)
        except: pass
        return []

# ============================================================================
# GENERATOR FUNCTIONS
# ============================================================================
def normalize_text(t): return re.sub(r'[^a-z0-9]', '', (t or "").lower())
def get_prefix2(t): return (t[:2] if len(t) >= 2 else t+"_") if t else "__"

def generate_shards(videos: List[Dict]):
    print("\n⚙️ Generating Shards & Indexes...")
    out = Path("public/data")
    (out / "detail").mkdir(parents=True, exist_ok=True)
    (out / "list").mkdir(parents=True, exist_ok=True)
    (out / "index").mkdir(parents=True, exist_ok=True)

    batch_shards = {}
    prefix2_map = {}
    lookup = {}
    
    total = len(videos)
    per_page = 200
    total_pages = (total + per_page - 1) // per_page
    list_data = {i: [] for i in range(1, total_pages + 1)}

    for i, v in enumerate(videos):
        vid = v.get('f')
        if not vid: continue
        
        h = hashlib.md5(vid.encode()).hexdigest()[:2]
        
        if h not in batch_shards: batch_shards[h] = []
        batch_shards[h].append(v)
        
        lookup[vid] = h
        
        norm = normalize_text(v.get('t', ''))
        p2 = get_prefix2(norm)
        if p2 not in prefix2_map: prefix2_map[p2] = []
        prefix2_map[p2].append({"f": vid, "t": v.get('t', ''), "si": v.get('si'), "vw": v.get('vw')})
        
        page = (i // per_page) + 1
        list_data[page].append({"file_code": vid, "title": v.get('t'), "single_img": v.get('si'), "views": v.get('vw')})

    print(f"💾 Writing {len(batch_shards)} detail shards...")
    for k, items in batch_shards.items():
        with open(out / "detail" / f"{k}.json", "w") as f:
            json.dump(items, f, separators=(",", ":"))
    
    with open(out / "lookup_shard.json", "w") as f:
        json.dump(lookup, f, separators=(",", ":"))
    
    print(f"🔍 Writing search indexes...")
    for p2, items in prefix2_map.items():
        if len(items) <= PREFIX2_LIMIT:
            with open(out / "index" / f"{p2}.json", "w") as f:
                json.dump(items, f, separators=(",", ":"))

    print(f"📄 Writing {total_pages} list files...")
    for p, items in list_data.items():
        payload = {"status": 200, "msg": "OK", "result": {"total_pages": total_pages, "files": items}}
        with open(out / "list" / f"{p}.json", "w") as f:
            json.dump(payload, f, separators=(",", ":"))

    with open(out / "meta.json", "w") as f:
        json.dump({"total": total, "per_page": per_page}, f)

async def main():
    print("🚀 Starting Production Fetch...")
    async with AsyncAPIClient() as client:
        tasks = [client.fetch_all(cfg, name) for name, cfg in CONFIGS.items()]
        results = await asyncio.gather(*tasks)
        
    all_videos = []
    for res in results: all_videos.extend(res)
    
    unique = {v['f']: v for v in all_videos}.values()
    videos = list(unique)
    videos.sort(key=lambda x: x.get('vw', 0), reverse=True)
    
    print(f"📊 Total Unique Videos: {len(videos)}")
    generate_shards(videos)
    print("✅ DONE. Ready to deploy.")

if __name__ == "__main__":
    try: import aiohttp
    except:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "aiohttp"])
    asyncio.run(main())

