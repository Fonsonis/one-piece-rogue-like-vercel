# Read-only audit of all four animation cells; writes metrics and review contact sheets.
from PIL import Image,ImageDraw
from pathlib import Path
import json
root=Path('public/art/characters');out=Path('outputs/sprite-audit');out.mkdir(exist_ok=True,parents=True)
ids=sorted(json.load(open('public/art/manifest.json'))['characters'])
report=[]
for id in ids:
 im=Image.open(root/(id+'.png')).convert('RGBA');pix=im.load();white=opaque=edgewhite=border=0;largestrow=0
 for i in range(4):
  cell=im.crop((i*192,0,(i+1)*192,192));p=cell.load()
  for y in range(192):
   run=0
   for x in range(192):
    r,g,b,a=p[x,y]
    if a>128:
     opaque+=1
     if min(r,g,b)>235 and max(r,g,b)-min(r,g,b)<12:
      white+=1;run+=1;largestrow=max(largestrow,run)
      if any(p[xx,yy][3]<32 for xx,yy in [(max(0,x-1),y),(min(191,x+1),y),(x,max(0,y-1)),(x,min(191,y+1))]):edgewhite+=1
     else:run=0
    else:run=0
    if (x in [0,191] or y in [0,191]) and a>128:border+=1
 report.append({'id':id,'whiteFraction':round(white/max(opaque,1),3),'whiteEdge':edgewhite,'whiteRun':largestrow,'opaqueBorder':border})
for start in range(0,len(ids),56):
 subset=ids[start:start+56];page=Image.new('RGB',(1280,7*184),'#132334');d=ImageDraw.Draw(page)
 for i,id in enumerate(subset):
  im=Image.open(root/(id+'.png')).convert('RGBA').crop((0,0,192,192)).resize((160,160),Image.Resampling.NEAREST);x=i%8*160;y=i//8*184;page.paste(im,(x,y),im);d.text((x+3,y+163),id,fill='white')
 page.save(out/f'catalog-{start//56+1}.png')
report.sort(key=lambda r:r['whiteEdge']+r['whiteRun']*5,reverse=True);(out/'metrics.json').write_text(json.dumps(report,indent=2));print(json.dumps(report[:35],indent=2))
