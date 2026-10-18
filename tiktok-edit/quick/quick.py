#!/usr/bin/env python3
"""quick.py: song window + recipe -> vertical 720x1280 TikTok clip, hook variants. ffmpeg only.
usage: python quick.py recipe.json      (recipe: song, beats, shots, hooks, out_prefix)
Cuts are one bar (4 beats) per shot, slow-mo via speed<1, warm grade + grain, hook text variants."""
import json, subprocess, sys, os, time, tempfile
R = json.load(open(sys.argv[1])); ROOT = os.path.dirname(os.path.abspath(sys.argv[1]))
os.chdir(os.path.join(ROOT, '..'))
beats = R['beats']; shots = R['shots']; SRC = R['source']; FONT = 'fonts/bundled/DejaVuSans-Bold.ttf'
W, H = R.get('size', [720, 1280]); t0 = time.time()
tmp = tempfile.mkdtemp(prefix='quick_')
GRADE = "eq=contrast=1.05:saturation=1.08,colorbalance=rm=0.04:bm=-0.04,vignette=angle=PI/5,noise=alls=5:allf=t+u"
def run(c): subprocess.run(c, check=True, stderr=subprocess.DEVNULL)
segs = []
for i, s in enumerate(shots):
    a, b = beats[4*i], beats[min(4*i+4, len(beats)-1)]
    bar = b - a; sp = s.get('speed', 1.0); need = bar*sp
    cw = round(1080*W/H/2)*2; cx = round(s.get('fx', 0.5)*(1920-cw)/2)*2
    out = f'{tmp}/s{i:02d}.mp4'
    run(['ffmpeg','-y','-v','error','-ss',f"{s['t']}",'-t',f'{need+0.1:.3f}','-i',SRC,'-vf',
         f'crop={cw}:1080:{cx}:0,scale={W}:{H},setpts=PTS/{sp},fps=30,{GRADE}','-t',f'{bar:.3f}','-an',
         '-c:v','libx264','-crf','21','-preset','veryfast','-pix_fmt','yuv420p',out])
    segs.append(out)
open(f'{tmp}/l.txt','w').write(''.join(f"file '{os.path.abspath(p)}'\n" for p in segs))
dur = beats[min(4*len(shots), len(beats)-1)] - beats[0]
run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',f'{tmp}/l.txt','-ss',f'{beats[0]}','-t',f'{dur:.3f}',
     '-i',R['song'],'-map','0:v','-map','1:a','-af',f'afade=t=in:d=0.05,afade=t=out:st={dur-0.9:.2f}:d=0.85',
     '-c:v','copy','-c:a','aac','-b:a','192k','-shortest',f'{tmp}/base.mp4'])
for name, text in R['hooks'].items():
    out = f"out/{R['out_prefix']}_{name}.mp4"
    if text:
        open(f'{tmp}/t_{name}.txt','w').write(text)
        vf = (f"drawtext=fontfile={FONT}:textfile={tmp}/t_{name}.txt:fontsize=58:fontcolor=white:line_spacing=10:"
              f"x=(w-text_w)/2:y=h*0.72:box=1:boxcolor=black@0.45:boxborderw=22:"
              f"alpha='if(lt(t,0.25),t/0.25,if(gt(t,2.1),max(0,(2.4-t)/0.3),1))':enable='lt(t,2.4)'")
        run(['ffmpeg','-y','-v','error','-i',f'{tmp}/base.mp4','-vf',vf,'-c:v','libx264','-crf','21','-preset','veryfast','-c:a','copy',out])
    else:
        subprocess.run(['cp', f'{tmp}/base.mp4', out], check=True)
    print('wrote', out)
print(f'total {time.time()-t0:.1f}s, clip {dur:.1f}s')
