"""Bounded raster-skeleton proposals. Never grants stroke-order approval.

Only an independently reviewed proposal may become a versioned repair. Keeping
this boundary explicit prevents a geometrically plausible skeleton being silently
promoted as a real Chinese writing route.
"""
from collections import deque
import math
import numpy as np
from PIL import Image, ImageDraw

def derive_median(surface, guide=None):
    if surface.is_empty or surface.area<=0:
        return {'status':'unresolved','reason':'empty outline','approved':False}
    min_x,min_y,max_x,max_y=surface.bounds
    scale=252/max(max_x-min_x,max_y-min_y,1)
    raster=Image.new('L',(260,260),0);draw=ImageDraw.Draw(raster)
    parts=list(surface.geoms) if hasattr(surface,'geoms') else [surface]
    pixel=lambda p: ((p[0]-min_x)*scale+4,(p[1]-min_y)*scale+4)
    for part in parts:
        if not hasattr(part,'exterior'): continue
        draw.polygon([pixel(p) for p in part.exterior.coords],fill=1)
        for ring in part.interiors: draw.polygon([pixel(p) for p in ring.coords],fill=0)
    grid=np.asarray(raster,dtype=np.uint8).astype(bool).copy()
    # Zhang-Suen's two subiterations; a 260px bounded grid converges in <=260
    # peel rounds. This stage proposes topology; it cannot certify pen order.
    iterations=0
    for iterations in range(520):
        changed=False
        for phase in (0,1):
            p=[grid[:-2,1:-1],grid[:-2,2:],grid[1:-1,2:],grid[2:,2:],grid[2:,1:-1],grid[2:,:-2],grid[1:-1,:-2],grid[:-2,:-2]]
            neighbors=sum(a.astype(np.uint8) for a in p)
            transitions=sum((~p[i]&p[(i+1)%8]).astype(np.uint8) for i in range(8))
            if phase==0: c1=~(p[0]&p[2]&p[4]);c2=~(p[2]&p[4]&p[6])
            else: c1=~(p[0]&p[2]&p[6]);c2=~(p[0]&p[4]&p[6])
            remove=grid[1:-1,1:-1]&(neighbors>=2)&(neighbors<=6)&(transitions==1)&c1&c2
            if remove.any(): grid[1:-1,1:-1][remove]=False;changed=True
        if not changed: break
    points=set(map(tuple,np.argwhere(grid)))
    if len(points)<2: return {'status':'unresolved','reason':'insufficient skeleton','approved':False}
    adjacent=lambda point: sorted((point[0]+dy,point[1]+dx) for dy in (-1,0,1) for dx in (-1,0,1) if (dx or dy) and (point[0]+dy,point[1]+dx) in points)
    graph={p:adjacent(p) for p in points}
    ends=sorted(p for p,n in graph.items() if len(n)==1)
    def farthest(start):
        queue=deque([start]);parents={start:None};last=start
        while queue:
            last=queue.popleft()
            for nxt in graph[last]:
                if nxt not in parents: parents[nxt]=last;queue.append(nxt)
        return last,parents
    first=ends[0] if ends else min(points)
    if guide:
        gx,gy=pixel(guide[0]);first=min(points,key=lambda p:(p[1]-gx)**2+(p[0]-gy)**2)
    else: first,_=farthest(first)
    last,parents=farthest(first);route=[];at=last
    while at is not None: route.append(at);at=parents[at]
    route.reverse()
    chosen=route[::3]
    if chosen[-1]!=route[-1]:chosen.append(route[-1])
    median=[[round((x-4)/scale+min_x,3),round((y-4)/scale+min_y,3)] for y,x in chosen]
    if guide and len(guide)>1:
        distance=lambda p,q:math.hypot(p[0]-q[0],p[1]-q[1])
        if distance(median[-1],guide[0])+distance(median[0],guide[-1])<distance(median[0],guide[0])+distance(median[-1],guide[-1]):median.reverse()
    return {'status':'needs-independent-route-review','approved':False,'kind':'raster-skeleton-candidate','median':median,
            'iterations':iterations+1,'branches':sum(len(n)>2 for n in graph.values()),'hasOriginalDirectionGuide':bool(guide),
            'reason':'Interior geometry and a source guide do not independently establish Chinese stroke order. Review, animate, synchronize and record a versioned repair before qualification.'}
