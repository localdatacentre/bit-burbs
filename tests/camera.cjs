const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function section(start, end) {
  const first = html.indexOf(start);
  const last = html.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Missing camera source between ${start} and ${end}`);
  return html.slice(first, last);
}

const bounds = {left: 21, top: 30, width: 400, height: 700};
const handlers = new Map();
let layoutReads = 0, now = 0;
function element(id) {
  return {
    setPointerCapture() {},
    addEventListener(type, handler) { handlers.set(id + type, handler); },
    getBoundingClientRect() {
      layoutReads++;
      return id === '#nav' ? {top: bounds.top + 600} : bounds;
    }
  };
}
const camera = {cx: 140, cy: -150, z: 2.8};
const game = vm.createContext({
  V: camera, cv: element('#game'), $: element, TW: 64, TH: 32, N: 192,
  performance: {now: () => now}, setTimeout, clearTimeout,
  clamp: (n, min, max) => Math.min(max, Math.max(min, n)),
  window: {navigator: {}, matchMedia: () => ({matches: false}),
    visualViewport: {...bounds, offsetLeft: bounds.left, offsetTop: bounds.top}},
  document: {documentElement: {style: {setProperty() {}}}}
});
const run = code => vm.runInContext(code, game);
run('let W=0,H=0,DPR=1,ROT=0,hudBottom=80,camAnim=null,placing=null; function layoutUI() {}');
run(section('function rotXY(', 'const vdepth') +
    section('let mapCenterY=', '/* ================= primitives') +
    section('const pointers = new Map()', 'function pickTile(') +
    section("$('#zin').addEventListener", '/* ================= loop'));
run('resize()');
const {screenToWorld, stepZoomAnim} = game;
function sameWorldPoint(a, b) {
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9,
    `World point moved from ${JSON.stringify(a)} to ${JSON.stringify(b)}`);
}
function pointer(type, id, x, y) {
  handlers.get('#game' + type)({type, pointerId: id, clientX: x + bounds.left, clientY: y + bounds.top});
}
function finishZoom() {
  now += 200;
  stepZoomAnim();
}
layoutReads = 0;
const buttonFocus = screenToWorld(200, 340); // Midpoint of the HUD (80) and navigation (600).
handlers.get('#zinclick')();
finishZoom();
assert.equal(camera.z, 3.2);
sameWorldPoint(buttonFocus, screenToWorld(200, 340));
handlers.get('#zoutclick')();
finishZoom();
assert.equal(camera.z, 2.8);

const pinchFocus = screenToWorld(140, 200);
pointer('pointerdown', 1, 120, 200);
pointer('pointerdown', 2, 160, 200);
pointer('pointermove', 2, 360, 200);
assert.equal(camera.z, 3.2);
sameWorldPoint(pinchFocus, screenToWorld(240, 200));
pointer('pointerup', 2, 360, 200);
pointer('pointerup', 1, 120, 200);

handlers.get('#zoutclick')();
handlers.get('#zoutclick')();
finishZoom();
assert.equal(camera.z, 2);
const wheelFocus = screenToWorld(75, 220);
for (let i = 0; i < 10; i++) {
  handlers.get('#gamewheel')({clientX: 75 + bounds.left, clientY: 220 + bounds.top,
    deltaY: -100, preventDefault() {}});
}
assert.equal(camera.z, 3.2);
sameWorldPoint(wheelFocus, screenToWorld(75, 220));

const startX = camera.cx;
pointer('pointerdown', 3, 80, 200);
for (let x = 90; x <= 220; x += 5) pointer('pointermove', 3, x, 200);
pointer('pointerup', 3, 220, 200);
assert.equal(camera.cx, startX + 140);
assert.equal(layoutReads, 0, 'Map input should use the canvas and HUD geometry cached by resize');
console.log('Camera buttons, pinch, wheel and pan passed.');
