"""Measure alpha bounds only; never modify the sprites. Re-run after changing atlas art/motions."""
import json, math
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
sizing=json.loads((root/'docs/sprite-sizing.json').read_text())
metrics={}; css=['/* All four poses plus conservative +/-13deg recoil, 8% stretch, 15px lunge and shadows. */']
for id, info in sizing.items():
    im=Image.open(root/f'public/art/characters/{id}.png').convert('RGBA')
    scale=info['atlasScale']; center=(info['guardBounds'][0]+info['guardBounds'][2])/2
    bounds=[]; points=[]
    for pose in range(4):
        box=im.crop((pose*192,0,(pose+1)*192,192)).getchannel('A').getbbox()
        bounds.append(box)
        for x in (box[0],box[2]):
            for y in (box[1],box[3]):
                # An enclosing rectangle over all rotation angles also contains interpolation.
                dx=x-96; dy=y-180.48; radius=math.hypot(dx,dy); angle=math.atan2(dy,dx)
                angles=[math.radians(-13),math.radians(13),0]
                for extremum in (0,math.pi/2,math.pi,3*math.pi/2,-math.pi/2,-math.pi):
                    a=extremum-angle
                    if -math.radians(13)<=a<=math.radians(13): angles.append(a)
                for a in angles:
                    for stretch in (0.985,1,1.08):
                        xx=(dx*math.cos(a)-dy*math.sin(a))*stretch
                        yy=(dx*math.sin(a)+dy*math.cos(a))*stretch
                        for shift in (-15,15):
                            for lift in (-3,5): points.append(((xx+96-center+shift)*scale,(yy+lift)*scale+0.48))
    left=min(p[0] for p in points)-3; right=max(p[0] for p in points)+3; half=(right-left)/2; centerShift=(right+left)/2; top=-min(p[1] for p in points)+3; bottom=max(0,max(p[1] for p in points))+3
    metrics[id]={'frames':bounds,'halfWidth':half,'centerShift':centerShift,'top':top,'bottom':bottom}
    css.append(f'[data-character="{id}"]{{--motion-fit-x:{192/(2*half):.8f};--motion-fit-y:{192/(top+bottom):.8f};--motion-floor:{bottom/192:.8f};--motion-center:{centerShift/192:.8f}}}')
(root/'public/art/motion-bounds.css').write_text('\n'.join(css)+'\n')
(root/'docs/motion-bounds.json').write_text(json.dumps(metrics,separators=(',',':'))+'\n')
print(f'Measured all 4 poses and motion envelope for {len(metrics)} characters.')
