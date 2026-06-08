# Whitemarch map compaction + recentre. One-off transform used to reshape the live
# handcrafted_map row on 2026-05-30. See scripts/whitemarch-backups/README-compaction-20260530.md
#
# Reads a {"tiles": {...}} dump at /tmp/wm_truth.json, packs the in-wall wards into a
# compact blob (pack_place), wraps them in a single morphological-close wall, rewrites
# door targets, recentres so the Grand Market Grain Square sits at 0,0, and remaps the
# sealed_structures from /tmp/sealed_live.json. Writes {"tiles","sealed_structures"} to
# /tmp/wm_after.json and prints invariants (content/doors/reachability preserved).
#   usage: python3 whitemarch-compact.py [scale=0.6] [wall_close_K=3]
import json, math, sys
from collections import deque, Counter
S = float(sys.argv[1]) if len(sys.argv)>1 else 0.6
raw=json.load(open('/tmp/wm_truth.json'))['tiles']
def pk(k): a,b=k.split(','); return (int(a),int(b))
def kk(t): return "%d,%d"%(t[0],t[1])
T={pk(k):v for k,v in raw.items()}
DIRS=[(1,0),(-1,0),(0,1),(0,-1),(1,-1),(-1,1)]
def nb(x,y): return [(x+dx,y+dy) for dx,dy in DIRS]
def kind(v):
    t=v.get('terrain'); return 'water' if t=='water' else 'wall' if t=='wall' else 'content'
content={c for c,v in T.items() if kind(v)=='content'}
walls  ={c for c,v in T.items() if kind(v)=='wall'}
water  ={c for c,v in T.items() if kind(v)=='water'}
env=content|walls
C=(sum(c[0] for c in env)/len(env), sum(c[1] for c in env)/len(env))

def comps(cells):
    cells=set(cells); seen=set(); out=[]
    for c in cells:
        if c in seen: continue
        q=deque([c]); seen.add(c); comp=[c]
        while q:
            p=q.popleft()
            for n in nb(*p):
                if n in cells and n not in seen: seen.add(n); comp.append(n); q.append(n)
        out.append(comp)
    return out
def cen(cl): return (sum(p[0] for p in cl)/len(cl), sum(p[1] for p in cl)/len(cl))

def parent(c): return (T[c].get('poi') or {}).get('parentName') or ''
content_cl=comps(content)
water_cl=comps(water)
# satellites: clusters dominated by Outer Works / Caravanserai
def is_sat(cl):
    cnt=Counter(parent(c) for c in cl)
    top=cnt.most_common(1)[0][0]
    return top in ('The Outer Works','The Caravanserai')

placed={}; newmap={}
def hexd(dx,dy): return (abs(dx)+abs(dy)+abs(dx+dy))//2
def radial_place(cl,fmin):                       # for satellites/water: move toward C till clear
    g=cen(cl); f=fmin
    while f<=1.0001:
        off=(round(C[0]+f*(g[0]-C[0])-g[0]), round(C[1]+f*(g[1]-C[1])-g[1]))
        tgt=[(p[0]+off[0],p[1]+off[1]) for p in cl]
        if all(t not in placed for t in tgt): return off,tgt
        f+=0.04
    dx,dy=g[0]-C[0],g[1]-C[1]; n=math.hypot(dx,dy) or 1
    for r in range(60):
        off=(round(dx/n*r),round(dy/n*r))
        tgt=[(p[0]+off[0],p[1]+off[1]) for p in cl]
        if all(t not in placed for t in tgt): return off,tgt
    return (0,0),list(cl)

def pack_place(cl):                              # snug against placed mass, nearest C, max contact
    g=cen(cl)
    tx,ty=round(C[0]+S*(g[0]-C[0])), round(C[1]+S*(g[1]-C[1]))
    base=(tx-round(g[0]), ty-round(g[1]))
    if not placed:
        return base,[(p[0]+base[0],p[1]+base[1]) for p in cl]
    for r in range(0,60):
        cand=[]
        for dx in range(-r,r+1):
            for dy in range(-r,r+1):
                if hexd(dx,dy)!=r: continue
                off=(base[0]+dx, base[1]+dy)
                tgt=[(p[0]+off[0],p[1]+off[1]) for p in cl]
                if any(t in placed for t in tgt): continue
                contact=sum(1 for t in tgt for nn in nb(*t) if placed.get(nn)=='content')
                if contact>0:
                    cx=sum(t[0] for t in tgt)/len(tgt); cy=sum(t[1] for t in tgt)/len(tgt)
                    cand.append((-contact,(cx-C[0])**2+(cy-C[1])**2,off,tgt))
        if cand:
            cand.sort(key=lambda z:(z[0],z[1])); return cand[0][2],cand[0][3]
    return radial_place(cl,S)

inwall=[c for c in content_cl if not is_sat(c)]
sats  =[c for c in content_cl if is_sat(c)]
inwall.sort(key=len,reverse=True)               # biggest ward anchors the blob
for cl in inwall:
    off,tgt=pack_place(cl)
    for p,t in zip(cl,tgt): newmap[p]=t; placed[t]='content'
inwall_old={c for cl in inwall for c in cl}
for cl in sats:                                  # outposts: radial inward (stay outside wall)
    off,tgt=radial_place(cl,S)
    for p,t in zip(cl,tgt): newmap[p]=t; placed[t]='content'
water_cl.sort(key=lambda cl:-len(cl))
for cl in water_cl:
    off,tgt=radial_place(cl,S)
    for p,t in zip(cl,tgt): newmap[p]=t; placed.setdefault(t,'water')

# recenter on in-wall content centroid, then snap so a civic tile sits at 0,0
inwall_new=[newmap[c] for c in inwall_old if newmap.get(c)]
Cn=(sum(t[0] for t in inwall_new)/len(inwall_new), sum(t[1] for t in inwall_new)/len(inwall_new))
# anchor the player-start tile (Grand Market Grain Square) at 0,0 so it matches
# initial-state.js currentTile {0,0} + the opening narration ("where you stand now")
_gs=[c for c in T if ((T[c].get('poi') or {}).get('part'))=='grain-square']
anchor=newmap[_gs[0]] if (_gs and newmap.get(_gs[0])) else min(inwall_new, key=lambda t:(t[0]-Cn[0])**2+(t[1]-Cn[1])**2)
R=(-anchor[0],-anchor[1])
def fin(t): return (t[0]+R[0],t[1]+R[1]) if t else None
def remap(old):
    t=newmap.get(old,'__')
    if t=='__': t=(round(C[0]+S*(old[0]-C[0])),round(C[1]+S*(old[1]-C[1])))
    return fin(t)

# 3) build tiles (content+water), remap+filter doors
out={}
for old,v in T.items():
    if kind(v)=='wall': continue   # walls rebuilt below
    nt=fin(newmap.get(old))
    if nt is None: continue
    nv=dict(v); nv.pop('doors',None)
    if v.get('doors'):
        nd=[]
        for d in v['doors']:
            tg=remap((d['x'],d['y']))
            if tg and tg in [(nt[0]+dx,nt[1]+dy) for dx,dy in DIRS]:
                nd.append({'x':tg[0],'y':tg[1]})
        if nd: nv['doors']=nd
    out[kk(nt)]=nv

newcells={pk(k):v for k,v in out.items()}
ncontent={c for c,v in newcells.items() if kind(v)=='content'}
nwater={c for c,v in newcells.items() if kind(v)=='water'}
# in-wall content new coords
inwall_set={fin(newmap[c]) for c in inwall_old if newmap.get(c)}

# 4) single iconic wall: morphological CLOSE of in-wall content (fill gaps between wards
#    into one hull), then wrap one wall ring around it. Inter-ward gaps -> interior plazas.
K=int(sys.argv[2]) if len(sys.argv)>2 else 3
occupied=set(newcells)
def dilate(cells,k):
    s=set(cells); fr=set(cells)
    for _ in range(k):
        nf={n for c in fr for n in nb(*c) if n not in s}
        s|=nf; fr=nf
    return s
def erode(cells,k):
    cur=set(cells)
    for _ in range(k):
        b={c for c in cur if any(n not in cur for n in nb(*c))}
        cur-=b
    return cur
closed=erode(dilate(inwall_set,K),K) | set(inwall_set)   # extensive: hull >= content
xs=[c[0] for c in closed]; ys=[c[1] for c in closed]
X0,X1,Y0,Y1=min(xs)-3,max(xs)+3,min(ys)-3,max(ys)+3
start=(X0,Y0); outside={start}; q=deque([start])
while q:                                  # flood exterior; blocked by hull and by any tile
    x,y=q.popleft()
    for n in nb(x,y):
        if X0<=n[0]<=X1 and Y0<=n[1]<=Y1 and n not in outside and n not in closed and n not in occupied:
            outside.add(n); q.append(n)
road_new={c for c in ncontent if newcells[c].get('terrain')=='road'}
wall_tiles=set()
for e in outside:                         # one ring just outside the hull
    if e in occupied: continue
    if any(a in closed for a in nb(*e)):
        if any(a in road_new for a in nb(*e)): continue   # gate at road exits
        wall_tiles.add(e)
for w in wall_tiles:
    out[kk(w)]={'terrain':'wall','material':'stone'}

# ================= INVARIANTS + reachability =================
oc={pk(k):v for k,v in out.items()}
nc={c for c,v in oc.items() if kind(v)=='content'}
nw={c for c,v in oc.items() if kind(v)=='wall'}
nwat={c for c,v in oc.items() if kind(v)=='water'}
def passable(a,b):
    va,vb=oc.get(a),oc.get(b)
    if not vb or kind(vb) in ('wall','water'): return False
    da,db=va.get('doors'),vb.get('doors')
    aok=(not da) or any(d['x']==b[0] and d['y']==b[1] for d in da)
    bok=(not db) or any(d['x']==a[0] and d['y']==a[1] for d in db)
    return aok and bok
# reachability from 0,0
src=(0,0); seen={src} if src in oc else set(); q=deque(seen)
while q:
    p=q.popleft()
    for n in nb(*p):
        if n not in seen and passable(p,n): seen.add(n); q.append(n)
reach_content=len([c for c in nc if c in seen])
# split in-wall vs satellite content reachability
inwall_new_content={c for c in nc if c in inwall_set}
sat_new_content=nc-inwall_new_content
reach_inwall=len([c for c in inwall_new_content if c in seen])
# largest walkable component sizes
wcells={c for c in oc if kind(oc[c])=='content'}
wseen=set(); wcomps=[]
for c in wcells:
    if c in wseen: continue
    cc=[c]; wseen.add(c); q2=deque([c])
    while q2:
        p=q2.popleft()
        for n in nb(*p):
            if n in wcells and n not in wseen and passable(p,n): wseen.add(n); cc.append(n); q2.append(n)
    wcomps.append(cc)
wcomps.sort(key=len,reverse=True)
json.dump({'tiles':out}, open('/tmp/wm_after.json','w'))
# ---- sealed_structures: remap coords that map to real tiles; drop the rest; drop inert ----
def seal_pt(p):
    old=(p['x'],p['y'])
    t=newmap.get(old)
    if t is None: return None
    f=fin(t); return {'x':f[0],'y':f[1]}
SEAL=json.load(open('/tmp/sealed_live.json'))
new_sealed=[]; seal_report=[]
for s in SEAL:
    ns={'name':s['name']}; kept=0; dropped=0
    if 'entry' in s:
        v=seal_pt(s['entry']);
        if v: ns['entry']=v; kept+=1
        else: dropped+=1
    if 'outside' in s:
        v=seal_pt(s['outside'])
        if v: ns['outside']=v; kept+=1
        else: dropped+=1
    if 'gates' in s:
        g=[]
        for a,b in s['gates']:
            ra,rb=seal_pt(a),seal_pt(b)
            if ra and rb: g.append([ra,rb]); kept+=2
            else: dropped+=2
        if g: ns['gates']=g
    if 'links' in s:
        L=[]
        for a,b in s['links']:
            ra,rb=seal_pt(a),seal_pt(b)
            if ra and rb: L.append([ra,rb]); kept+=2
            else: dropped+=2
        if L: ns['links']=L
    if 'interior' in s:
        I=[seal_pt(p) for p in s['interior']]
        I=[p for p in I if p]
        kept+=len(I); dropped+=len(s['interior'])-len(I)
        if I: ns['interior']=I
    inert = ('gates' not in ns) and ('interior' not in ns)
    seal_report.append((s['name'],kept,dropped,inert))
    if not inert: new_sealed.append(ns)
json.dump({'tiles':out,'sealed_structures':new_sealed}, open('/tmp/wm_after.json','w'))
print("--- sealed_structures ---")
for nm,k,d,inert in seal_report:
    print("   %-32s kept %2d / dropped %2d %s"%(nm,k,d,"  [DROPPED: inert, was already stale]" if inert else ""))
print("sealed kept: %d/6"%len(new_sealed))
def bb(cells):
    xs=[c[0] for c in cells]; ys=[c[1] for c in cells]; return (min(xs),max(xs),min(ys),max(ys))
print("=== s=%.2f ==="%S)
print("tiles %d -> %d  | content %d->%d  wall %d->%d  water %d->%d"%(
    len(T),len(out),len(content),len(nc),len(walls),len(nw),len(water),len(nwat)))
print("CONTENT preserved:", len(nc)==len(content))
print("content components %d -> %d"%(len(content_cl),len(comps(nc))))
print("0,0 ->", (oc.get((0,0)) or {}).get('terrain'), ((oc.get((0,0)) or {}).get('poi') or {}).get('name'))
print("reachable from 0,0: in-wall %d/%d  | satellites %d (separate by design)"%(
    reach_inwall,len(inwall_new_content),len(sat_new_content)))
print("walkable passable-components (top5 sizes): %s"%[len(c) for c in wcomps[:5]])
# door validity
bad=0;tot=0
for k,v in out.items():
    o=pk(k)
    for d in v.get('doors',[]):
        tot+=1
        if (d['x'],d['y']) not in nb(*o): bad+=1
print("doors %d, non-adjacent %d (should be 0)"%(tot,bad))
print("bbox content old %s -> new %s"%(bb(content),bb(nc)))
print("bbox ALL old %s -> new %s"%(bb(set(T)),bb(set(oc))))
def screenw(cells):
    sx=[c[0]+c[1]/2 for c in cells]; return max(sx)-min(sx), max(c[1] for c in cells)-min(c[1] for c in cells)
print("city(content+wall) screen WxH old %s -> new %s"%(
    tuple(round(x) for x in screenw(env)), tuple(round(x) for x in screenw(nc|nw))))
