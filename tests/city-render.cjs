'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function load(context, first, next) {
  const start = html.indexOf(first), end = html.indexOf(next, start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(html.slice(start, end), context);
}

const map = vm.createContext({
  N: 192, TW: 64, TH: 32, ROT: 0, V: {z: 1, cx: -12.125, cy: 230.75},
  tileAt: () => null, isStop: () => false, parkSizes: {}, fourSidedModels: new Set(),
  spriteOf: () => ({w: 110, h: 88, sc: 1.25, gMinX: 8, gMaxX: 90, gMinY: 37}),
  ensureNativeWorld() {}, nativePlots: [{i: 0, j: 0}, {i: 2, j: 1}], nativeRowStart: [0, 1, 2]
});
load(map, 'function rotXY(', 'const vdepth');
load(map, 'function spriteBox(', '// Frames are rendered');
load(map, 'function staticScenery(', 'function drawNativePlot(');
map.vdepth = (x, y) => map.rotXY(x, y).reduce((a, b) => a + b, 0);

// Picking and drawing use the same bounds, including rotated rectangular lots.
for (const z of [.55, 1, 1.375, 2.25]) {
  map.V.z = z;
  for (let rot = 0; rot < 4; rot++) {
    map.ROT = rot;
    for (const [fx, fy] of [[1, 1], [2, 1], [3, 5], [13, 12]]) {
      map.fpOf = () => [fx, fy];
      const i = 71, j = 32, box = map.spriteBox(i, j, 'house', 1, {});
      const corners = [map.P(i, j), map.P(i+fx, j), map.P(i, j+fy), map.P(i+fx, j+fy)];
      const left = Math.min(...corners.map(p => p.x));
      const top = Math.min(...corners.map(p => p.y));
      const bottom = Math.max(...corners.map(p => p.y));
      const offset = box.mir ? box.sp.w - box.sp.gMaxX : box.sp.gMinX;
      assert.ok(Math.abs(box.x - (left - offset * box.s)) < 1e-9);
      assert.ok(Math.abs(box.y - (top - box.sp.gMinY * box.s)) < 1e-9);
      assert.ok(Math.abs(box.groundY - bottom) < 1e-9);
    }
  }
}

// Camera moves, rotations, new worlds, and construction must refresh the scenery.
map.ROT = 0;
const building = {d: 1}, network = {renderObjects: [building]};
const wide = map.staticScenery(network, 0, 2, 0, 1);
assert.equal(wide[0], building);
assert.equal(wide[1].native, map.nativePlots[0]);
assert.equal(wide[2].native, map.nativePlots[1]);
assert.equal(map.staticScenery(network, 0, 2, 0, 1), wide);
assert.equal(map.staticScenery(network, 2, 2, 0, 1).length, 2);
map.ROT = 2;
network.renderObjects = [building];
assert.equal(map.staticScenery(network, 2, 2, 0, 1)[1].d, map.vdepth(2.5, 1.5));
map.nativePlots = [{i: 0, j: 0}, {i: 2, j: 1}];
assert.equal(map.staticScenery(network, 2, 2, 0, 1)[1].native, map.nativePlots[1]);
map.tileAt = (i, j) => i === 2 && j === 1;
assert.equal(map.staticScenery({renderObjects: [building]}, 0, 2, 0, 1).length, 2);

// A zoomed cache must cover the viewport and keep the ground under the actors.
let baked, paints = 0, placement;
Object.assign(map, {
  PX: 1.5, DARK: 0, ISL: {}, placing: false, zoomAnim: {}, pinchC: null,
  groundCanvas: {}, groundContext: {setTransform() {}, clearRect() {}},
  groundBounds: () => ({left: 0, right: 0, top: 0, bottom: 0}), drawGround() {},
  drawRoadNetwork() { paints++; baked = {...map.V}; }
});
load(map, 'let groundCache=null;', '// Erase the foreground');
map.V = {cx: -545.5, cy: -2810.25, z: 1.25, ctx: {drawImage(...args) { placement = args; }}};
const lw = 262, lh = 568;
function drawFrame() {
  map.drawGroundLayer(network, lw, lh);
  const [canvas, x, y, w, h] = placement, scale = map.V.z/baked.z;
  assert.ok(x <= 0 && y <= 0 && x+w >= lw*map.PX && y+h >= lh*map.PX);
  assert.ok(Math.abs(w - canvas.width*map.PX/2*scale) < 1e-8);
  assert.ok(Math.abs(h - canvas.height*map.PX/2*scale) < 1e-8);
  const margin = (canvas.width/2-lw)*map.PX/2;
  const groundX = x+(baked.cx+13*baked.z+margin)*scale;
  const groundY = y+(baked.cy+20*baked.z+margin)*scale;
  assert.ok(Math.abs(groundX-(map.V.cx+13*map.V.z)) < 1e-8);
  assert.ok(Math.abs(groundY-(map.V.cy+20*map.V.z)) < 1e-8);
}
function zoomFrame(ratio, focusX, focusY) {
  map.V.cx = focusX+(map.V.cx-focusX)*ratio;
  map.V.cy = focusY+(map.V.cy-focusY)*ratio;
  map.V.z *= ratio;
  drawFrame();
}
drawFrame();
for (let n=0; n<30; n++) zoomFrame(1.005, 340, 700);
assert.equal(paints, 1);
map.zoomAnim = null;
drawFrame();
assert.equal(paints, 2);
assert.equal(baked.z, map.V.z);
map.pinchC = {};
for (let n=0; n<80; n++) {
  zoomFrame(.992, 75, 100);
  assert.equal(baked.z > 1, map.V.z > 1);
}
assert.ok(paints < 20);
map.pinchC = null;
drawFrame();
assert.equal(baked.z, map.V.z);
console.log('PASS: sprite bounds, scenery invalidation, and ground coverage during camera gestures');
