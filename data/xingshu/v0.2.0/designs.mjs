// Individually authored pen routes. Coordinates are in a 100-unit em.
// Width is a full pen footprint, NOT an SVG stroke-width multiplier.
const stroke = (id,name,component,path,width,group,pace,rhythm,entry,exit) =>
  ({id,name,component,path,width,group,pace,rhythm,entry,exit});
const a = {
  schema:'shakespread.xingshu.authoring/1', version:'0.2.0-a-experimental',
  author:'Shakespread / Codex, independently authored vector artwork, 2026-10-30',
  license:'Arphic Public License',
  notice:'Round two: redrawn principal pen routes, distinct pressure envelopes and component proportions. HWD 2.0.1 supplies original logical order/structure only. No font outline copied; no qualified glyph changed. Experimental, user aesthetic approval pending.',
  coordinateSystem:'100-unit em; x right, y down; shared baseline 88',
  candidate:'A', intent:'Restrained semi-running hard pen; all thirteen principal strokes lift independently.',
  glyphs:{
    '你':{advance:100,baseline:88,
      components:[{name:'亻',logicalStrokes:[1,2],intent:'compact left shoulder, decisive hanging vertical; no return thread'},
        {name:'尔',logicalStrokes:[3,4,5,6,7],intent:'open rising shoulder, left-biased central hook, outward balanced short strokes'}],
      logicalStrokes:[
        stroke(1,'撇','亻','M 31 12 C 30.5 18 26.5 27 22 33.5 C 17.5 40 12.5 45.5 8.5 48',
          [[0,1.6],[.09,4.5],[.32,5.0],[.61,4.0],[.83,2.2],[1,.65]],'ni-1',.0064,[[0,0],[.18,.1],[.64,.68],[1,1]],'short oblique landing, light press','leftward release, clean airborne return'),
        stroke(2,'竖','亻','M 23.5 34 C 24.8 43 22.8 59 21.9 71 C 21.4 78 21.5 82 22.6 84',
          [[0,2.4],[.12,4.6],[.40,4.9],[.72,4.6],[.92,3.8],[1,2.0]],'ni-2',.0068,[[0,0],[.18,.11],[.75,.8],[1,1]],'separate short down press','softly rounded hanging end, not a needle'),
        stroke(3,'撇','尔','M 61 11 C 60 18.5 54 27.5 48.5 33 C 45.5 36 42.8 38.7 40 40',
          [[0,1.4],[.12,4.4],[.40,4.8],[.73,3.2],[.9,1.6],[1,.55]],'ni-3',.0061,[[0,0],[.22,.13],[.7,.78],[1,1]],'light angled landing','small falling point with an actual lift'),
        stroke(4,'横钩','尔','M 49 30 C 58 30.2 72 23.3 82 24 C 87.5 24.4 87.1 26.5 83.5 31 C 81.8 33.3 79.9 35.2 77.8 36.4',
          [[0,2.2],[.14,3.9],[.45,4.4],[.66,4.9],[.78,4.1],[.9,2.0],[1,.65]],'ni-4',.0065,[[0,0],[.38,.45],[.61,.61],[.76,.69],[1,1]],'directional rise; fuller shoulder','short inward hook, no extended looping'),
        stroke(5,'竖钩','尔','M 63 40 C 64.5 49 64.2 66 62.4 76 C 61.2 83 60.2 87 56.3 85.6 C 53.6 84.7 50.7 82.3 48.6 80.3',
          [[0,2.1],[.12,4.4],[.46,4.9],[.7,5.0],[.81,5.4],[.9,3.4],[1,.65]],'ni-5',.0069,[[0,0],[.19,.12],[.64,.64],[.82,.79],[1,1]],'slight press into a supple stem','weighted turn and short leftward hook'),
        stroke(6,'撇','尔','M 47.2 53 C 46.5 59.5 42.3 66 36.5 70',
          [[0,1.8],[.16,3.9],[.44,4.5],[.72,3.2],[1,.6]],'ni-6',.0056,[[0,0],[.25,.17],[.71,.8],[1,1]],'compact touch rather than the long-pie entry','quick leftward point'),
        stroke(7,'点','尔','M 77 51.5 C 81 54 86 60.5 87.8 64.1 C 88.8 66.2 89.3 67.5 90.6 67.8',
          [[0,1.2],[.15,3.0],[.46,4.4],[.7,4.8],[.88,3.7],[1,1.5]],'ni-7',.0060,[[0,0],[.24,.19],[.72,.78],[1,1]],'angled soft entry','full oblique dot, small rounded release')
      ],connections:[],omittedLogicalStrokes:[],orderChanges:[]},
    '好':{advance:100,baseline:88,
      components:[{name:'女',logicalStrokes:[1,2,3],intent:'clear three-stroke waist; rising tie crosses above a compact diagonal dot; no return loop'},
        {name:'子',logicalStrokes:[4,5,6],intent:'slightly forward upper fold, weighted curved hook, lower rising crossbar answers 女'}],
      logicalStrokes:[
        stroke(1,'撇点','女','M 29.5 12 C 28.3 23 24 36 20.4 44.5 C 18.5 48.8 17 51.1 20 53 C 27.2 57.5 35.3 63 41 68.5',
          [[0,2.0],[.10,4.5],[.35,4.7],[.51,4.0],[.60,5.2],[.79,4.5],[.93,2.9],[1,1.4]],'hao-1',.0068,[[0,0],[.36,.37],[.54,.51],[.66,.60],[1,1]],'small down press into the left-falling waist','short oblique dot ends cleanly, then lifts'),
        stroke(2,'撇','女','M 43 29 C 44 39 40.5 51.5 33.5 61.5 C 26.5 71.7 17 78.5 9.5 81',
          [[0,2.5],[.13,4.9],[.38,5.3],[.60,4.6],[.81,3.0],[1,.6]],'hao-2',.0064,[[0,0],[.19,.11],[.67,.75],[1,1]],'fresh landing above the waist, no visible backtrack','long leftward release balances the first oblique dot'),
        stroke(3,'提','女','M 8.5 47 C 17.5 47.2 32 41.8 47.4 36.4',
          [[0,2.0],[.1,4.2],[.31,4.0],[.60,3.1],[.83,1.9],[1,.6]],'hao-3',.0058,[[0,0],[.20,.12],[.68,.74],[1,1]],'brief lateral press','upward directional release toward 子, with an airborne gap'),
        stroke(4,'横撇','子','M 55 22.5 C 64 22.3 74.5 17.5 82 18 C 86 18.3 86.8 19.8 83.3 23.8 C 79.6 28.2 73.5 33 68 36.7',
          [[0,2.0],[.12,3.9],[.4,4.4],[.59,4.8],[.75,3.6],[.92,1.8],[1,.8]],'hao-4',.0064,[[0,0],[.34,.39],[.57,.57],[.73,.67],[1,1]],'soft rising shoulder differs from long crossbar','short slant released before the next independent stem'),
        stroke(5,'竖钩','子','M 68 39 C 71 42.5 73.5 52 73 65 C 72.8 75.5 70 84.5 65.8 86 C 61.6 87.3 57.3 84.3 54.2 81.5',
          [[0,1.8],[.13,4.2],[.4,4.9],[.65,5.2],[.79,5.4],[.9,3.6],[1,.7]],'hao-5',.0070,[[0,0],[.19,.12],[.62,.60],[.81,.77],[1,1]],'fresh soft landing facing right before the stem falls','rounded pressure turn then short leftward release'),
        stroke(6,'横','子','M 48.2 53.5 C 58.8 52.5 74.5 46.8 88 46 C 92 45.8 95.4 46.2 97 47',
          [[0,2.1],[.12,4.2],[.42,4.7],[.68,4.4],[.87,3.8],[1,1.8]],'hao-6',.0061,[[0,0],[.18,.1],[.73,.79],[1,1]],'light lower press answering the left rising tie','full, restrained exit; no long needle tail')
      ],connections:[],omittedLogicalStrokes:[],orderChanges:[]}
  }
};

const b=structuredClone(a);
Object.assign(b,{version:'0.2.0-b-experimental',candidate:'B',intent:'Natural limited continuity: only the tangent-continuous 子 fold remains in contact. All three old return threads removed; 尔 uses an airborne move after visual comparison.'});
const ni=b.glyphs['你'], hao=b.glyphs['好'];
Object.assign(ni.logicalStrokes[0],{path:'M 31 12 C 30.5 19 25.6 28 21 34.5 C 16.7 40.7 12 45.8 8.5 48',width:[[0,1.5],[.08,4.7],[.30,5.2],[.64,4.1],[.84,2.1],[1,.6]]});
Object.assign(ni.logicalStrokes[2],{path:'M 61 11 C 60 18.5 53 27 47 33 C 44.8 35.2 42 37.5 40 38.7',width:[[0,1.5],[.12,4.5],[.40,5.0],[.73,3.1],[.9,1.5],[1,.55]],group:'ni-3',exit:'short falling point, lift before the shoulder'});
Object.assign(ni.logicalStrokes[3],{path:'M 49 30.4 C 58 30.1 72 23.5 81.8 24 C 87.2 24.3 87.4 26 83.8 30.8 C 82.3 33 80.4 35.3 77.8 36.4',width:[[0,2.1],[.16,3.8],[.45,4.6],[.65,5.2],[.78,4.2],[.90,2.1],[1,.6]],group:'ni-4',entry:'fresh rising shoulder after an airborne return; no doubled wedge'});
ni.connections=[];
Object.assign(ni.logicalStrokes[4],{path:'M 63.3 40 C 65 50.5 64.6 66.5 62.5 77 C 61.3 84 59.7 87.5 55.8 85.4 C 53.5 84.3 50.6 82.1 48.6 80.3',width:[[0,2.0],[.12,4.6],[.46,5.1],[.69,5.2],[.81,5.6],[.9,3.4],[1,.65]]});
Object.assign(hao.logicalStrokes[0],{path:'M 29.5 12 C 28 24 23.4 37.8 19.8 45.3 C 17.9 49.3 17.2 51.2 20.2 53 C 27.7 57.2 36 62.9 41.2 68',width:[[0,1.9],[.10,4.7],[.35,4.9],[.51,4.1],[.60,5.4],[.79,4.5],[.93,2.8],[1,1.4]]});
Object.assign(hao.logicalStrokes[1],{path:'M 43.5 29 C 44.6 39.5 40.7 52.8 33 63 C 25.5 72.7 16.5 79 9.5 81',width:[[0,2.6],[.13,5.0],[.37,5.5],[.60,4.7],[.81,3.0],[1,.6]]});
Object.assign(hao.logicalStrokes[3],{path:'M 55 22.5 C 64 22.3 74.5 17.5 82 18 C 86 18.3 86.8 19.8 83.3 23.8 C 79.6 28.2 70.7 31.7 69.4 35.6',width:[[0,2.0],[.12,4.0],[.4,4.5],[.59,4.9],[.75,3.6],[.92,1.9],[1,1.9]],group:'hao-4-5',exit:'rounded folded entry into the same-point 子 stem'});
Object.assign(hao.logicalStrokes[4],{path:'M 69.4 35.6 C 68.7 37.7 72.4 43.3 73 51 C 74.4 65.2 72.2 82.5 66.4 85.8 C 62.6 88 57.2 84.2 54.2 81.5',width:[[0,1.9],[.12,3.8],[.38,5.0],[.65,5.4],[.79,5.6],[.9,3.7],[1,.7]],group:'hao-4-5',entry:'same-point tangent continuation; no extra connector segment'});

export const designs={a,b};
// Set only after comparing normal-speed recordings and static outlines.
export const recommended='b';
