#!/usr/bin/env python3
"""Draws the Clutchly mark (a python brooding a clutch of three eggs, engraved style) as SVG.
Usage: python3 scripts/draw_logo.py [body_width=88] [out=assets/source/clutchly-mark.svg]
Then render it to assets/logo.png at 2048px and run scripts/make_icons.py (see README)."""
import math, sys
INK, CREAM = '#141414', '#fcfcf8'
W = float(sys.argv[1]) if len(sys.argv) > 1 else 84
OUT = sys.argv[2] if len(sys.argv) > 2 else 'assets/source/clutchly-mark.svg'
SCALES = (sys.argv[3] if len(sys.argv) > 3 else '1') == '1'

def catmull(P, per=40):
    out = []
    P = [P[0]] + P + [P[-1]]
    for i in range(1, len(P)-2):
        p0, p1, p2, p3 = P[i-1], P[i], P[i+1], P[i+2]
        for k in range(per):
            t = k/per; t2, t3 = t*t, t*t*t
            out.append(tuple(0.5*((2*p1[j]) + (-p0[j]+p2[j])*t + (2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2 + (-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3) for j in (0, 1)))
    out.append(P[-2]); return out

def resample(pts, step=3.0):
    out = [pts[0]]; acc = 0
    for i in range(1, len(pts)):
        (x0, y0), (x1, y1) = pts[i-1], pts[i]; d = math.hypot(x1-x0, y1-y0)
        while acc + d >= step:
            t = (step - acc)/d; x0, y0 = x0 + (x1-x0)*t, y0 + (y1-y0)*t; out.append((x0, y0)); d = math.hypot(x1-x0, y1-y0); acc = 0
        acc += d
    return out

def frame(pts):
    out = []
    for i in range(len(pts)):
        x0, y0 = pts[max(i-2, 0)]; x1, y1 = pts[min(i+2, len(pts)-1)]
        dx, dy = x1-x0, y1-y0; n = math.hypot(dx, dy) or 1
        out.append((dx/n, dy/n, -dy/n, dx/n))
    return out

def egg_path(cx, cy, w, h):
    t, b = cy - h/2, cy + h/2
    return (f"M{cx},{t} C{cx+w*0.42},{t} {cx+w*0.5},{cy-h*0.05} {cx+w*0.5},{cy+h*0.12} "
            f"C{cx+w*0.5},{b-h*0.12} {cx+w*0.28},{b} {cx},{b} C{cx-w*0.28},{b} {cx-w*0.5},{b-h*0.12} {cx-w*0.5},{cy+h*0.12} "
            f"C{cx-w*0.5},{cy-h*0.05} {cx-w*0.42},{t} {cx},{t} Z")

# Spine: tail tip lower right, around the left, over the top, down the right, then the neck curls in over the tail
# and the head comes to rest on the lower-right egg, facing into the clutch.
ctrl = [(800, 858), (690, 882), (520, 880), (350, 846), (222, 748), (160, 590), (182, 420), (272, 282), (410, 196), (566, 178),
        (712, 228), (822, 336), (870, 486), (852, 640), (790, 748), (712, 790), (640, 770)]
spine = resample(catmull(ctrl), 3.0)
N = len(spine); L = (N-1)*3.0
HEAD = 120  # length of head along the spine (px)
ws = []
for i in range(N):
    s = i*3.0; t = s / L
    if t < 0.22: w = W * (t/0.22)**0.8          # tail taper
    elif s > L - HEAD:                                       # head: slight swell then rounded snout
        u = (s - (L - HEAD)) / HEAD
        w = W * (0.86 + 0.24*math.sin(math.pi*min(u, 0.6)/0.6*0.5)) * (math.sqrt(max(0, 1 - ((u-0.45)/0.55)**2)) if u > 0.45 else 1)
    elif s > L - HEAD - 60: w = W * (1 - 0.14*((s - (L-HEAD-60))/60))  # neck pinch
    else: w = W
    ws.append(max(w, 0.0))
fr = frame(spine)
Lft = [(x+nx*w/2, y+ny*w/2) for (x, y), w, (tx, ty, nx, ny) in zip(spine, ws, fr)]
Rgt = [(x-nx*w/2, y-ny*w/2) for (x, y), w, (tx, ty, nx, ny) in zip(spine, ws, fr)]
body_d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in Lft + Rgt[::-1]) + ' Z'

# Engraved scales: staggered crescents, smaller on the head, none over the eye.
marks = []
hx, hy = spine[-1]; tx_, ty_, nx_, ny_ = fr[-1]
eye_i = N - 1 - int(HEAD*0.42/3)
ex, ey = spine[eye_i][0] + fr[eye_i][2]*ws[eye_i]*0.2, spine[eye_i][1] + fr[eye_i][3]*ws[eye_i]*0.2
for i in range(4, N-6):
    s = i*3.0; on_head = s > L - HEAD
    step = 11 if on_head else 15
    if int(s) % step >= 3: continue
    (x, y), w, (tx, ty, nx, ny) = spine[i], ws[i], fr[i]
    rows = max(1, round((4 if on_head else 5) * w / W))
    row_i = (int(s)//step) % 2
    for r in range(rows):
        off = ((r + 0.5)/rows - 0.5) * w * 0.84
        sx, sy = x + nx*off + tx*(step/2 if (r+row_i) % 2 else 0), y + ny*off + ty*(step/2 if (r+row_i) % 2 else 0)
        if math.hypot(sx-ex, sy-ey) < 20: continue
        sz = (6.5 if on_head else 8.5) * min(1, w/(W*0.6))
        a = (sx - nx*sz*0.6, sy - ny*sz*0.6); b_ = (sx + nx*sz*0.6, sy + ny*sz*0.6); c = (sx - tx*sz*0.9, sy - ty*sz*0.9)
        marks.append(f'M{a[0]:.1f},{a[1]:.1f} Q{c[0]:.1f},{c[1]:.1f} {b_[0]:.1f},{b_[1]:.1f}')
scale_g = f'<g clip-path="url(#bc)"><path d="{" ".join(marks)}" fill="none" stroke="{INK}" stroke-width="2.5" stroke-linecap="round"/></g>' if SCALES else ''

# Face: eye with a brow, mouth line, forked tongue from the snout.
bi = N - 1 - int(HEAD*0.55/3); be = N - 1 - int(HEAD*0.28/3)
brow = f'M{spine[bi][0]+fr[bi][2]*ws[bi]*0.36:.1f},{spine[bi][1]+fr[bi][3]*ws[bi]*0.36:.1f} Q{ex+fr[eye_i][2]*14:.1f},{ey+fr[eye_i][3]*14:.1f} {spine[be][0]+fr[be][2]*ws[be]*0.3:.1f},{spine[be][1]+fr[be][3]*ws[be]*0.3:.1f}'
mi = N - 1 - int(HEAD*0.42/3); mm = N - 1 - int(HEAD*0.2/3)
mouth = f'M{spine[mi][0]-fr[mi][2]*ws[mi]*0.12:.1f},{spine[mi][1]-fr[mi][3]*ws[mi]*0.12:.1f} Q{spine[mm][0]-fr[mm][2]*ws[mm]*0.2:.1f},{spine[mm][1]-fr[mm][3]*ws[mm]*0.2:.1f} {spine[N-3][0]-fr[N-3][2]*4:.1f},{spine[N-3][1]-fr[N-3][3]*4:.1f}'
def T(u, v): return (hx + tx_*u + nx_*v, hy + ty_*u + ny_*v)
t0, t1, f1, f2 = T(2, 0), T(46, 2), T(66, -12), T(68, 12)
tongue = f'<path d="M{t0[0]:.1f},{t0[1]:.1f} Q{T(24, 6)[0]:.1f},{T(24, 6)[1]:.1f} {t1[0]:.1f},{t1[1]:.1f} L{f1[0]:.1f},{f1[1]:.1f} M{t1[0]:.1f},{t1[1]:.1f} L{f2[0]:.1f},{f2[1]:.1f}" stroke="{INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
face = (f'<path d="{brow}" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round"/>'
        f'<path d="{mouth}" stroke="{INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
        f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="8.5" fill="{INK}"/><circle cx="{ex-2:.1f}" cy="{ey-2.5:.1f}" r="2.4" fill="{CREAM}"/>')

# Eggs: light engraved crescent shading on the lower right of each.
eggs, defs = [], []
for i, (cx, cy) in enumerate([(500, 410), (396, 590), (604, 590)]):
    d = egg_path(cx, cy, 196, 252); d_in = egg_path(cx - 22, cy - 26, 196*0.97, 252*0.97)
    defs.append(f'<mask id="m{i}"><path d="{d}" fill="#fff"/><path d="{d_in}" fill="#000"/></mask>')
    hatch = ''.join(f'<line x1="{cx-200+k*8}" y1="{cy+200}" x2="{cx-200+k*8+260}" y2="{cy-60}" stroke="{INK}" stroke-width="2"/>' for k in range(0, 60))
    eggs.append(f'<path d="{d}" fill="{CREAM}"/><g mask="url(#m{i})">{hatch}</g><path d="{d}" fill="none" stroke="{INK}" stroke-width="12" stroke-linejoin="round"/>')

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">'
       f'<defs>{"".join(defs)}<clipPath id="bc"><path d="{body_d}"/></clipPath></defs>'
       + ''.join(eggs) + tongue +
       f'<path d="{body_d}" fill="{CREAM}" stroke="{INK}" stroke-width="10" stroke-linejoin="round"/>' + scale_g + face + '</svg>')
open(OUT, 'w').write(svg); print(OUT, 'body length', int(L))
