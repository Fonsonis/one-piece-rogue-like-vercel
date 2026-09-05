#!/usr/bin/env python3
"""Validate and import the six reviewed, generated character-art batches.

Usage: python scripts/import-dex-art.py /absolute/path/to/dex-art-production
This imports art only; it never rewrites the character database or game engine.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image

project = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
catalog = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    "import fs from 'node:fs';import vm from 'node:vm';const c=vm.createContext({});"
    "vm.runInContext(fs.readFileSync('public/data.js','utf8'),c);"
    "process.stdout.write(vm.runInContext('JSON.stringify(Object.keys(CHARS))',c));"
], cwd=project, text=True))

files = {}
reviews = {}
for batch in range(6):
    root = source / f'agent-{batch}'
    assigned = {c['id'] for c in json.loads((source / f'batch-{batch}.json').read_text())}
    candidates = {p.stem: p for p in (root / 'final').glob('*.png')}
    if candidates.keys() != assigned:
        raise ValueError(f'Batch {batch}: missing {assigned-candidates.keys()}, unexpected {candidates.keys()-assigned}')
    review_path = root / 'manifest.json'
    if not review_path.exists():
        raise ValueError(f'Missing reviewed manifest for batch {batch}')
    reviews[str(batch)] = json.loads(review_path.read_text())
    files.update(candidates)
if files.keys() != set(catalog):
    raise ValueError('The final assets do not match the entire Dex')

manifest = {
    'version': 1,
    'style': 'Luffy Run pixel art',
    'generator': 'image_gen',
    'frames': ['guard', 'windup', 'attack', 'hurt'],
    'cell': {'width': 192, 'height': 192, 'anchor': [96, 180]},
    'characters': {}
}
hashes = set()
warnings = []
for id in catalog:
    path = files[id]
    with Image.open(path) as image:
        if image.size != (768, 192) or image.mode != 'RGBA':
            raise ValueError(f'{id}: expected 768x192 RGBA, got {image.size} {image.mode}')
        poses = []
        pose_hashes = set()
        for frame in range(4):
            cell = image.crop((192*frame, 0, 192*(frame+1), 192))
            alpha = cell.getchannel('A')
            bbox = alpha.getbbox()
            if not bbox or (bbox[2]-bbox[0]) < 12 or (bbox[3]-bbox[1]) < 30:
                raise ValueError(f'{id}/{frame}: empty or implausible pose')
            histogram = alpha.histogram()
            if histogram[0] < 192*192*.2:
                raise ValueError(f'{id}/{frame}: insufficient transparency')
            pose_hash = hashlib.sha256(cell.tobytes()).hexdigest()
            if pose_hash in pose_hashes:
                raise ValueError(f'{id}: repeated pose')
            pose_hashes.add(pose_hash)
            if bbox[0] == 0 or bbox[1] == 0 or bbox[2] == 192 or bbox[3] == 192:
                warnings.append(f'{id}/{frame}: artwork touches cell edge')
            poses.append({'bounds': list(bbox)})
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest in hashes:
            raise ValueError(f'{id}: duplicate character atlas')
        hashes.add(digest)
        manifest['characters'][id] = {'frames': 4, 'sha256': digest, 'poses': poses}

dest = project / 'public/art/characters'
dest.mkdir(parents=True, exist_ok=True)
portraits = project / 'public/art/portraits'
portraits.mkdir(parents=True, exist_ok=True)
for id, path in files.items():
    shutil.copy2(path, dest / f'{id}.png')
    # Still icons do not need room for an extended arm or a projectile. Derive a
    # tightly framed guard portrait so every Dex card remains easily readable.
    with Image.open(path) as image:
        guard = image.crop((0, 0, 192, 192))
        bounds = guard.getchannel('A').getbbox()
        cutout = guard.crop(bounds)
        scale = min(166 / cutout.width, 158 / cutout.height)
        cutout = cutout.resize((round(cutout.width*scale), round(cutout.height*scale)), Image.Resampling.NEAREST)
        portrait = Image.new('RGBA', (192,192))
        portrait.alpha_composite(cutout, ((192-cutout.width)//2, 176-cutout.height))
        portrait.save(portraits / f'{id}.png', optimize=True)
(project / 'public/art/manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':'))+'\n')
docs = project / 'docs'
docs.mkdir(exist_ok=True)
(docs / 'dex-art-review.json').write_text(json.dumps({
    'characterCount': len(catalog), 'poseCount': len(catalog)*4,
    'geometryWarnings': warnings, 'batches': reviews
}, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'characters': len(files), 'poses': len(files)*4, 'warnings': warnings}, ensure_ascii=False))
