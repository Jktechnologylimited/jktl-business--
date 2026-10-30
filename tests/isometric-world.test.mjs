import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as economy from '../src/lib/tycoon.ts';
const exports = {};
const source = readFileSync('src/components/tycoon/world/isometric.ts','utf8');
new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(name => {
  assert.equal(name,'@/lib/tycoon');return economy;
},exports);
const {gridToScreen,screenToGrid,depthIndex,landPlots,travel,TILE} = exports;
test('projection uses half tile dimensions and accurately inverts fractional coordinates', () => {
  const origin = gridToScreen({row:0,col:0});
  const east = gridToScreen({row:0,col:1});
  assert.equal(east.x-origin.x,TILE.width/2);
  assert.equal(east.y-origin.y,TILE.height/2);
  for (const point of [{row:0,col:0},{row:3,col:7},{row:2.45,col:8.75},{row:-1,col:2}]) {
    const projected=gridToScreen(point), back=screenToGrid(projected.x,projected.y);
    assert.ok(Math.abs(back.row-point.row)<1e-9);
    assert.ok(Math.abs(back.col-point.col)<1e-9);
  }
});
test('depth follows ground coordinates including moving actors, and never screen X', () => {
  assert.equal(depthIndex({row:4,col:1}),depthIndex({row:1,col:4}));
  assert.ok(depthIndex({row:3,col:3})>depthIndex({row:2,col:2}));
  const a={row:1,col:1}, b={row:9,col:1};
  assert.ok(depthIndex(travel(a,b,.7))>depthIndex(travel(a,b,.3)));
  assert.deepEqual(travel(a,b,1,false),b);
  assert.deepEqual(travel(a,b,1),a);
});
test('construction is visual only and cannot grant ownership or change economy state', () => {
  const initial=economy.newGame();
  assert.equal(landPlots(initial,new Set([0]))[0].status,'empty');
  const built=economy.gameAction(initial,{type:'build',slot:0,kind:'suya'});
  const snapshot=JSON.stringify(built);
  const constructing=landPlots(built,new Set([0]));
  assert.equal(constructing[0].status,'building');
  assert.equal(constructing[0].revenue,22000);
  assert.equal(landPlots(built)[0].status,'active');
  assert.equal(new Set(landPlots(built).map(p=>`${p.row}:${p.col}`)).size,12);
  assert.equal(JSON.stringify(built),snapshot);
  assert.equal(initial.plots[0],null);
});
