"""Read crew skin alpha bounds; print presentation-only CSS metrics as JSON."""
import json
import subprocess
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
skins = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    "import {combatHarness} from './tests/balance-harness.mjs';"
    "process.stdout.write(combatHarness().exec('JSON.stringify(CREW_SKINS)'));"
], cwd=root, text=True))
sizing = json.loads((root / 'docs/sprite-sizing.json').read_text())
metrics = {}
for base, crews in skins.items():
    for skin in crews.values():
        atlas = Image.open(root / f'public/art/characters/{skin}.png').convert('RGBA')
        if atlas.size != (768, 192):
            raise ValueError(f'Invalid four-cell atlas: {skin}')
        frames = [atlas.crop((i*192, 0, (i+1)*192, 192)).getchannel('A').getbbox() for i in range(4)]
        portrait = Image.open(root / f'public/art/portraits/{skin}.png').convert('RGBA').getchannel('A').getbbox()
        guard = frames[0]
        original = sizing.get(skin, sizing[base])
        target_height = (original['guardBounds'][3]-original['guardBounds'][1])*original['atlasScale']
        scale = target_height/(guard[3]-guard[1])
        center = (guard[0]+guard[2])/2
        portrait_height = (original['portraitBounds'][3]-original['portraitBounds'][1])*original['portraitScale']
        ps = portrait_height/(portrait[3]-portrait[1])
        left = min((b[0]-center)*scale for b in frames)-3
        right = max((b[2]-center)*scale for b in frames)+3
        top = -min((b[1]-180.48)*scale+.48 for b in frames)+3
        bottom = max(0, max((b[3]-180.48)*scale+.48 for b in frames))+3
        metrics[skin] = {
            '--atlas-scale': scale, '--atlas-shift': (96-center)*scale/192,
            '--portrait-scale': ps, '--portrait-shift': (96-(portrait[0]+portrait[2])/2)*ps/192,
            '--motion-fit-x': 192/(right-left), '--motion-fit-y': 192/(top+bottom),
            '--motion-floor': bottom/192, '--motion-center': (right+left)/384,
        }
print(json.dumps(metrics, separators=(',', ':')))
