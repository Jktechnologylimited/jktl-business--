/** Local fictional game points. Never used for money, commissions or account balances. */
export type RunPhase = "ready" | "running" | "paused" | "over";
export type RunAction = "left" | "right" | "jump" | "slide";
export type RunState = { phase:RunPhase; lane:number; distance:number; seconds:number; coins:number; score:number; jumpAge:number|null; slideLeft:number; collected:number[]; seed:number };
export type Hazard = { id:number; lane:number; distance:number; kind:"barrier"|"gate"|"vehicle" };
export const JUMP_DURATION=.95;
export const createRun=(seed=1):RunState=>({phase:"ready",lane:0,distance:0,seconds:0,coins:0,score:0,jumpAge:null,slideLeft:0,collected:[],seed:seed>>>0});
export const jumpHeight=(state:RunState)=>state.jumpAge===null ? 0 : Math.sin(Math.PI*state.jumpAge/JUMP_DURATION)*1.7;
export function hazardAt(index:number,seed:number):Hazard {
  const value=((Math.imul(index+1,1664525)+(seed>>>0)+1013904223)>>>0);
  return {id:index,lane:value%3-1,distance:26+index*14,kind:(["barrier","gate","vehicle"] as const)[index%3]};
}
export const coinAt=(index:number)=>({id:index,distance:6+index*4,lane:([0,0,-1,1] as const)[Math.floor(index/3)%4]});
export function actRun(state:RunState,action:RunAction):RunState {
  if(state.phase!=="running")return state;
  if(action==="left" || action==="right")return {...state,lane:Math.max(-1,Math.min(1,state.lane+(action==="left"?-1:1)))};
  if(state.jumpAge!==null || state.slideLeft>0)return state;
  return action==="jump" ? {...state,jumpAge:0} : {...state,slideLeft:.85};
}
/** Small fixed simulation steps avoid tunnelling through hazards on slower GPUs. */
export function advanceRun(state:RunState,delta:number):RunState {
  if(state.phase!=="running" || !Number.isFinite(delta) || delta<=0)return state;
  const next={...state,collected:[...state.collected]};
  let remaining=Math.min(delta,.25);
  while(remaining>1e-8 && next.phase==="running") {
    const dt=Math.min(remaining,1/120);remaining-=dt;
    const previous=next.distance;
    next.seconds+=dt;
    next.distance+=dt*Math.min(15,7.5+next.seconds*.065);
    if(next.jumpAge!==null){next.jumpAge+=dt;if(next.jumpAge>=JUMP_DURATION)next.jumpAge=null;}
    next.slideLeft=Math.max(0,next.slideLeft-dt);
    const first=Math.max(0,Math.floor((previous-26)/14));
    for(let index=first;index<=first+1;index++) {
      const hazard=hazardAt(index,next.seed);
      if(hazard.distance>previous && hazard.distance<=next.distance && hazard.lane===next.lane) {
        const avoided=hazard.kind==="barrier" ? jumpHeight(next)>.9 : hazard.kind==="gate" && next.slideLeft>0;
        if(!avoided){next.phase="over";next.distance=hazard.distance;break;}
      }
    }
    const coinIndex=Math.max(0,Math.floor((previous-6)/4));
    for(let index=coinIndex;index<=coinIndex+1;index++) {
      const coin=coinAt(index);
      if(coin.distance>previous && coin.distance<=next.distance && coin.lane===next.lane && !next.collected.includes(index)) {
        next.coins++;next.collected.push(index);
      }
    }
    next.score=Math.floor(next.distance*5)+next.coins*50;
    if(next.collected.length>100)next.collected=next.collected.slice(-100);
  }
  return next;
}
export type RunRecord = { best:number; total:number; runs:number; lastId:string };
export const emptyRunRecord=():RunRecord=>({best:0,total:0,runs:0,lastId:""});
export function parseRunRecord(value:unknown):RunRecord {
  const record=value && typeof value==="object" ? value as Partial<RunRecord> : {};
  const number=(value:unknown)=>typeof value==="number" && Number.isSafeInteger(value) && value>=0 ? Math.min(value,1e12) : 0;
  return {best:number(record.best),total:number(record.total),runs:number(record.runs),lastId:typeof record.lastId==="string" ? record.lastId.slice(0,100) : ""};
}
export function recordRun(record:RunRecord,run:RunState,id:string):RunRecord {
  if(run.phase!=="over" || !id || record.lastId===id)return record;
  return {best:Math.max(record.best,run.score),total:Math.min(1e12,record.total+run.score),runs:record.runs+1,lastId:id};
}
