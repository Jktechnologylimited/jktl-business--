import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,actRun,advanceRun,coinAt,hazardAt,recordRun,parseRunRecord,emptyRunRecord,jumpHeight} from '../src/lib/runner.ts';
const running=(seed=1)=>({...createRun(seed),phase:'running'});
test('running earns distance points and unique coins without mutating the previous state',()=>{
 const original={...running(),distance:5.8};const next=advanceRun(original,.1);
 assert.equal(original.distance,5.8);assert.equal(original.coins,0);
 assert.equal(next.coins,1);assert.ok(next.score>=80);
 assert.equal(advanceRun(next,.1).coins,1);
 assert.equal(coinAt(0).lane,0);
});
test('lane bounds, jumping, sliding and pause enforce valid controls',()=>{
 let state=actRun(actRun(running(),'left'),'left');assert.equal(state.lane,-1);
 state=actRun(state,'jump');assert.equal(state.jumpAge,0);
 assert.equal(actRun(state,'slide'),state);
 assert.ok(jumpHeight({...state,jumpAge:.45})>1.5);
 const paused={...state,phase:'paused'};assert.equal(advanceRun(paused,1),paused);assert.equal(actRun(paused,'right'),paused);
});
test('barriers require jumps, gates require slides and vehicles require a free lane',()=>{
 for(let id=0;id<3;id++){
  const h=hazardAt(id,12);const approach={...running(12),distance:h.distance-.1,lane:h.lane};
  assert.equal(advanceRun(approach,.1).phase,'over');
  assert.equal(advanceRun({...approach,lane:h.lane===1?0:h.lane+1},.1).phase,'running');
  if(h.kind==='barrier')assert.equal(advanceRun({...approach,jumpAge:.4},.1).phase,'running');
  if(h.kind==='gate')assert.equal(advanceRun({...approach,slideLeft:.5},.1).phase,'running');
  if(h.kind==='vehicle')assert.equal(advanceRun({...approach,jumpAge:.4},.1).phase,'over');
 }
});
test('fixed steps prevent tunnelling, ignore invalid deltas and clamp background gaps',()=>{
 const h=hazardAt(0,3),state={...running(3),lane:h.lane,distance:h.distance-.5};
 assert.equal(advanceRun(state,.25).phase,'over');
 assert.equal(advanceRun(state,NaN),state);assert.equal(advanceRun(state,-1),state);
 assert.ok(advanceRun(running(),100).distance<3);
 const large=advanceRun(running(),.2);let small=running();for(let i=0;i<4;i++)small=advanceRun(small,.05);
 assert.ok(Math.abs(large.distance-small.distance)<1e-6);
});
test('only finished runs update local records, once per run; corrupt storage is sanitized',()=>{
 const record=emptyRunRecord(),state={...running(),score:1234,phase:'over'};
 assert.equal(recordRun(record,running(),'one'),record);
 const result=recordRun(record,state,'one');assert.equal(result.best,1234);assert.equal(result.runs,1);assert.equal(recordRun(result,state,'one'),result);
 assert.equal(recordRun(result,{...state,score:100},'two').total,1334);
 assert.deepEqual(parseRunRecord({best:-1,total:'bad',runs:NaN,lastId:32}),record);
});
