import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as economy from '../src/lib/tycoon.ts';
function load(file,deps){const out={};new Function('require','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(name=>{if(name in deps)return deps[name];throw Error(name)},out);return out;}
const iso=load('src/components/tycoon/world/isometric.ts',{'@/lib/tycoon':economy});
const model=load('src/components/tycoon/three/scene-model.ts',{'@/lib/tycoon':economy,'../world/isometric':iso});
test('3D scene derives real economy plots without mutating saves, including construction and upgrades',()=>{
 const state=economy.gameAction(economy.newGame(),{type:'build',slot:0,kind:'suya'}),snapshot=JSON.stringify(state);
 const parts=model.buildingParts(state,new Set(),false);
 assert.equal(new Set(parts.filter(p=>p.plotId!==undefined).map(p=>p.plotId)).size,12);
 assert.ok(parts.some(p=>p.plotId===0 && p.color===economy.ventures[0].color));
 assert.ok(model.buildingParts(state,new Set([0]),false).some(p=>p.position[1]===3.7));
 assert.ok(model.buildingParts(state,new Set(),true).some(p=>p.color==='#ffe6a0'));
 assert.equal(JSON.stringify(state),snapshot);
 for(const part of [...model.terrainParts(),...model.roadParts(),...parts]){
  assert.ok(part.position.every(Number.isFinite));assert.ok(part.size.every(v=>v>0));
 }
});
test('mobile quality caps pixel density, moving actors and real-time shadows',()=>{
 assert.equal(model.profiles.low.fps,30);assert.equal(model.profiles.low.dpr,1);assert.equal(model.profiles.low.shadows,false);
 assert.ok(model.profiles.low.cars<model.profiles.high.cars);
 assert.ok(model.profiles.low.people<model.profiles.high.people);
 assert.equal(model.profiles.high.fps,60);
});
test('3D is the only game renderer and loads through a client-only dynamic boundary',()=>{
 const source=readFileSync('src/components/tycoon/CityScene.tsx','utf8');
 assert.match(source,/dynamic\(\(\) => import\("\.\/three\/Neighbourhood3D"\)/);
 assert.match(source,/ssr: false/);assert.match(source,/useState\(false\)/);
 assert.match(source,/<Neighbourhood3D/);
 assert.doesNotMatch(source,/IsometricWorld|Use 2D|Try 3D/);
});
