/** Independent admission rule for INK continuity, separate from stroke order.
 * These six judgments are Codex design review, never user aesthetic approval.
 * Geometry/motion tests independently check that admitted contacts are executed.
 */
export const connectionReview = {
  'ni-thread-1-2': {decision:'B: delete; airborne move', reason:'Long reverse ascent doubles the left-falling stroke and leaves a thin wedge in 亻.', allowInk:false},
  'hao-thread-1-2': {decision:'B: delete; airborne move', reason:'A 39-unit return runs outside 女, encloses a false loop and reverses the principal diagonal.', allowInk:false},
  'ni-thread-3-4': {decision:'B: delete after C redraw trial was rejected',
    reason:'Even a shortened return creates a doubled triangular wedge under 尔. The same-scale browser comparison favors a clean lift.',allowInk:false},
  'hao-4-5': {decision:'A: retain and redraw the direct fold; zero added thread segments',
    reason:'The terminal downward tangent of 横撇 meets the downward entry of 竖钩 at the same point, inside 子. This avoids the detached upper fold in A without adding a return or enclosing a new region.',
    allowInk:true,conditions:{directionContinuous:true,exitLeadsToEntry:true,staysInComponent:true,noExtraLoop:true,recognizable:true,betterThanLift:true},
    judgmentScope:'Codex comparison of actual A/B browser outlines and normal-speed movement; user aesthetic approval remains pending'}
};
export function validateConnections(artwork) {
  for (const glyph of Object.values(artwork.glyphs)) {
    const ids=glyph.logicalStrokes.map(s=>s.id);
    for (const c of glyph.connections) {
      const review=connectionReview[c.id];
      if (!review?.allowInk || Object.values(review.conditions||{}).length!==6 || !Object.values(review.conditions).every(Boolean))
        throw new Error(`Ink connection has not passed all six review conditions: ${c.id}`);
      if (c.to!==c.from+1 || !ids.includes(c.from) || !ids.includes(c.to)) throw new Error('Connection must retain original adjacent logical order');
      const before=glyph.logicalStrokes[c.from-1],after=glyph.logicalStrokes[c.to-1];
      if (before.component!==after.component || before.group!==c.group || after.group!==c.group) throw new Error('Cross-component or mismatched contact group');
    }
    const groups=new Map();
    for(const s of glyph.logicalStrokes){if(!groups.has(s.group))groups.set(s.group,[]);groups.get(s.group).push(s);}
    for(const [id,strokes]of groups)if(strokes.length>1){
      const review=connectionReview[id];
      if(!review?.allowInk || Object.values(review.conditions||{}).length!==6 || !Object.values(review.conditions).every(Boolean))throw new Error(`Unreviewed continuous action: ${id}`);
      for(let i=1;i<strokes.length;i++)if(strokes[i].id!==strokes[i-1].id+1 || strokes[i].component!==strokes[i-1].component)throw new Error('Invalid direct contact order/component');
    }
  }
}
