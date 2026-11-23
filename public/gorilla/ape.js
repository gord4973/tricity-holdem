// GORILLA - the 3D silverback, built entirely in code (no third-party model): shell-rendered fur, leathery skin,
// procedural rig + keyframed actions (idle, look, chest beat, roar, slam, bill react), volcanic jungle set.
import * as THREE from '/gorilla/vendor/three/three.module.min.js';

const ease = { io: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, out: t => 1 - Math.pow(1 - t, 3), in: t => t * t * t, back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); } };
const lerp = (a, b, t) => a + (b - a) * t, clamp = (x, a, b) => Math.max(a, Math.min(b, x)), smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------- fur (shell texturing) ----------------
const FUR_VS = `
  uniform float uLen, uTime, uWind, uJaw; uniform vec3 uGrav, uJawP; attribute float layer; attribute float fm; attribute float jw;
  varying vec3 vN, vW, vBase, vNb; varying float vL, vFm;
  vec3 rx(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x, v.y*c - v.z*s, v.y*s + v.z*c); }
  void main(){
    vL = layer; vBase = position; vNb = normal; vFm = fm;
    float ja = uJaw * jw; vec3 pos = rx(position - uJawP, ja) + uJawP; vec3 n = normalize(rx(normal, ja));
    float l = layer;
    vec3 p = pos + n * uLen * l * fm;
    vec3 g = (inverse(mat3(modelMatrix)) * uGrav);
    p += g * uLen * l * l * 0.9;
    p += n * sin(uTime*1.7 + position.y*6. + position.x*4.) * uWind * l * l;
    vec4 w = modelMatrix * vec4(p,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FUR_FS = `
  uniform vec3 uRoot, uTip, uSilver, uKeyDir, uKeyCol, uFireCol, uFirePos, uRimCol, uAmb, uFogCol; uniform float uDensity, uSilverY, uFogD, uFire, uThick;
  varying vec3 vN, vW, vBase, vNb; varying float vL, vFm;
  float h31(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.x+p.y)*p.z); }
  void main(){
    vec3 Nb = normalize(vNb); vec3 q = vBase * uDensity; q.y += vL * .35;              // strands lean downward a little with length
    vec3 c = floor(q), f = fract(q) - .5; f -= Nb * dot(f, Nb);
    float r = h31(c), r2 = h31(c+17.1);
    if (vFm < .5) discard;
    float len = mix(.55, 1., r);
    if (vL > 0.001) { if (vL > len) discard; float rad = (1.0 - vL/len) * uThick; if (length(f + vec3(r2-.5,r-.5,r2-r)*.2) > rad) discard; }
    vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
    float ao = mix(.18, 1., pow(vL, .8));
    vec3 base = mix(uRoot, uTip, pow(vL,1.4) * (.55+.45*r));
    float silver = smoothstep(uSilverY-.1, uSilverY+.15, vW.y) * smoothstep(.2, -.4, N.z) ; // silver saddle on the back/shoulders
    base = mix(base, uSilver * (.7+.3*r), silver * .85);
    float kd = clamp(dot(N, normalize(uKeyDir))*.5+.5, 0., 1.);  // wrapped diffuse (hair scatters)
    vec3 Lf = uFirePos - vW; float fd = length(Lf); float ff = clamp(dot(N, Lf/fd)*.6+.4,0.,1.) * uFire / (1. + fd*fd*.25);
    float rim = pow(1. - clamp(dot(N,V),0.,1.), 2.5);
    vec3 col = base * (uAmb + uKeyCol * kd * kd) * ao + base * uFireCol * ff * ao * 1.6 + uRimCol * rim * ao * (.35+.65*vL);
    // anisotropic-ish sheen along strands
    vec3 Hh = normalize(normalize(uKeyDir) + V); float sh = pow(clamp(1. - abs(dot(vec3(0.,1.,0.), Hh)), 0., 1.), 24.); col += uKeyCol * sh * .08 * vL;
    float fog = 1. - exp(-pow(length(cameraPosition - vW) * uFogD, 2.)); col = mix(col, uFogCol, fog);
    gl_FragColor = vec4(col, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class Ape {
  constructor(canvas, opts = {}) {
    this.canvas = canvas; this.q = opts.quality || (matchMedia('(pointer:coarse)').matches ? 'med' : 'high');
    this.onImpact = null; this.actions = []; this.t = 0; this.shake = 0; this.look = { x: 0, y: 0, tx: 0, ty: 0, next: 0, mode: 'idle' }; this.blink = 0; this.nextBlink = 2;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.q === 'high', powerPreference: 'high-performance', alpha: false });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, this.q === 'high' ? 2 : this.q === 'med' ? 1.5 : 1)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.FogExp2(0x1a0805, 0.06); this.scene.background = new THREE.Color(0x0b0302);
    this.cam = new THREE.PerspectiveCamera(36, 1, .1, 200); this.ledge = { y: .36, z: .95 }; this.frameFrac = opts.frameFrac || 0.66;
    this.lights(); this.set(); this.build(); this.particles();
    this.rest = { spX: .12, spY: 0, nkX: .12, nkY: 0, jaw: .02, brow: 0, shL: [-0.55, 0, .52], shR: [-0.55, 0, -.52], elL: -.55, elR: -.55, wrL: .25, wrR: .25, fistL: 1, fistR: 1 };
    this.pose = JSON.parse(JSON.stringify(this.rest)); this.cur = JSON.parse(JSON.stringify(this.rest));
    this.resize(); addEventListener('resize', () => this.resize()); this.clock = new THREE.Clock(); this.frames = 0; this.fps = 0; this.fpsT = 0;
    const loop = () => { requestAnimationFrame(loop); this.tick(); }; loop();
  }
  // ---------- scene ----------
  lights() {
    const s = this.scene;
    this.key = new THREE.DirectionalLight(0xffd2a0, 3.2); this.key.position.set(-1.6, 3.2, 5); s.add(this.key);
    this.rimL = new THREE.DirectionalLight(0xff8a4a, 1.4); this.rimL.position.set(3, 2.5, -3); s.add(this.rimL);
    this.fire = new THREE.PointLight(0xff5a14, 6, 6, 1.8); this.fire.position.set(0, .3, 1.3); s.add(this.fire);
    this.hemi = new THREE.HemisphereLight(0x553322, 0x220a04, .55); s.add(this.hemi);
    this.faceL = new THREE.SpotLight(0xffc896, 9, 9, .35, .6, 1.5); this.faceL.position.set(.6, 2.6, 4.5); this.faceL.target.position.set(0, 1.9, 0); s.add(this.faceL, this.faceL.target);
    this.flash = new THREE.PointLight(0xcfe4ff, 0, 30, 1); this.flash.position.set(-3, 6, -2); s.add(this.flash);
  }
  tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  set() {
    const s = this.scene;
    // sky + volcano
    const sky = this.tex(512, 1024, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#050102'); gr.addColorStop(.45, '#2a0805'); gr.addColorStop(.7, '#7a1d06'); gr.addColorStop(.85, '#c2410c'); gr.addColorStop(1, '#3a0d04'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,${120 + Math.random() * 100 | 0},60,${Math.random() * .5})`; g.fillRect(Math.random() * w, Math.random() * h * .8, 1.5, 1.5); }
      // smoke plumes
      for (let i = 0; i < 40; i++) { const x = w * .62 + (Math.random() - .5) * 220, y = h * .1 + Math.random() * h * .5, rr = 30 + Math.random() * 80; const sg = g.createRadialGradient(x, y, 0, x, y, rr); sg.addColorStop(0, 'rgba(40,14,10,.55)'); sg.addColorStop(1, 'rgba(40,14,10,0)'); g.fillStyle = sg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
      g.fillStyle = '#120403'; g.beginPath(); g.moveTo(w * .25, h * .86); g.lineTo(w * .55, h * .6); g.lineTo(w * .7, h * .6); g.lineTo(w * 1, h * .86); g.closePath(); g.fill();
      const lv = g.createLinearGradient(0, h * .6, 0, h * .8); lv.addColorStop(0, '#ffd27a'); lv.addColorStop(1, 'rgba(255,60,0,0)'); g.strokeStyle = lv; g.lineWidth = 4; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(w * (.57 + i * .022), h * .6); g.bezierCurveTo(w * (.55 + i * .03), h * .67, w * (.5 + i * .05), h * .72, w * (.45 + i * .07), h * .8); g.stroke(); }
      const gl = g.createRadialGradient(w * .62, h * .6, 0, w * .62, h * .6, 120); gl.addColorStop(0, 'rgba(255,200,90,.9)'); gl.addColorStop(1, 'rgba(255,80,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, w, h); });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(26, 34), new THREE.MeshBasicMaterial({ map: sky, fog: false })); bg.position.set(0, 4, -12); s.add(bg); this.bg = bg;
    // jungle layers (parallax)
    this.layers = [];
    const jungle = (seed, dark, tall) => this.tex(1024, 512, (g, w, h) => { let rr = seed; const R = () => (rr = (rr * 16807) % 2147483647) / 2147483647; g.fillStyle = dark;
      for (let i = 0; i < 26; i++) { const x = R() * w, y = h * (tall ? .25 + R() * .4 : .5 + R() * .3); g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + (R() - .5) * 40, (h + y) / 2, x + (R() - .5) * 30, y); g.lineTo(x + 8, h); g.fill();
        for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + R(), L = 40 + R() * 70; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * .6, y + Math.sin(a) * L * .3 - 20, x + Math.cos(a) * L, y + Math.abs(Math.sin(a)) * L * .6 + 10); g.lineWidth = 7 + R() * 6; g.strokeStyle = dark; g.stroke(); } }
      for (let i = 0; i < 60; i++) { g.beginPath(); g.ellipse(R() * w, h - R() * h * .35, 30 + R() * 60, 20 + R() * 40, 0, 0, Math.PI * 2); g.fill(); } });
    [[-7, 34, '#1a0705', 1, 991], [-4.5, 24, '#0e0403', 0, 31337], [-2.6, 18, '#070202', 0, 4242]].forEach(([z, wd, col, tall, seed], i) => { const t = jungle(seed, col, tall); const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, wd / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: true })); m.position.set(0, i === 0 ? 1.8 : .9, z); s.add(m); this.layers.push(m); });
    // god rays
    const ray = this.tex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,210,150,.55)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; const hg = g.createLinearGradient(0, 0, w, 0); g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'destination-in'; hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(.5, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = hg; g.fillRect(0, 0, w, h); });
    this.rays = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2 + Math.random(), 9), new THREE.MeshBasicMaterial({ map: ray, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .25, fog: false })); m.position.set(-3 + i * 1.1, 4.2, -1.5 - i * .6); m.rotation.z = -.45 + i * .04; s.add(m); this.rays.push(m); }
    // stone ledge = top of the reel cabinet the gorilla grips
    const stone = this.tex(512, 128, (g, w, h) => { g.fillStyle = '#2a1712'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = 20 + Math.random() * 50 | 0; g.fillStyle = `rgba(${v + 20},${v},${v - 10},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 10, 2 + Math.random() * 5); } g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(i * 60 + Math.random() * 20, 0); g.lineTo(i * 60 + Math.random() * 30, h); g.stroke(); } });
    stone.wrapS = THREE.RepeatWrapping; stone.repeat.set(3, 1);
    this.ledgeMesh = new THREE.Mesh(new THREE.BoxGeometry(5.2, .34, .7), new THREE.MeshStandardMaterial({ map: stone, roughness: .9, metalness: 0, emissive: 0x401000, emissiveIntensity: .25 }));
    this.ledgeMesh.visible = false; s.add(this.ledgeMesh);
  }
  // ---------- body ----------
  furMat(o) {
    const N = { high: 26, med: 14, low: 8 }[this.q];
    const m = new THREE.ShaderMaterial({ vertexShader: FUR_VS, fragmentShader: FUR_FS, uniforms: {
      uLen: { value: o.len || .07 }, uJaw: { value: 0 }, uJawP: { value: new THREE.Vector3(0, -.12, -.05) }, uTime: { value: 0 }, uWind: { value: .004 }, uGrav: { value: new THREE.Vector3(0, -1, .15) }, uDensity: { value: o.density || 95 }, uThick: { value: .42 },
      uRoot: { value: new THREE.Color(o.root || 0x0d0908) }, uTip: { value: new THREE.Color(o.tip || 0x5e4a3a) }, uSilver: { value: new THREE.Color(0x9a948c) }, uSilverY: { value: o.silverY != null ? o.silverY : 99 },
      uKeyDir: { value: new THREE.Vector3(-1.6, 3.2, 5).normalize() }, uKeyCol: { value: new THREE.Color(0xffe0b8).multiplyScalar(2.6) }, uFireCol: { value: new THREE.Color(0xff5a14) }, uFirePos: { value: new THREE.Vector3(0, .3, 1.3) }, uFire: { value: 1.6 },
      uRimCol: { value: new THREE.Color(0xff9a5a).multiplyScalar(.28) }, uAmb: { value: new THREE.Color(0x2a2226) }, uFogCol: { value: new THREE.Color(0x1a0805) }, uFogD: { value: .045 } } });
    m.userData.N = N; (this.furMats || (this.furMats = [])).push(m); return m;
  }
  furMesh(geo, mat) { const N = mat.userData.N, ig = new THREE.InstancedBufferGeometry(); const cnt = geo.attributes.position.count; if (!geo.attributes.fm) geo.setAttribute('fm', new THREE.BufferAttribute(new Float32Array(cnt).fill(1), 1)); if (!geo.attributes.jw) geo.setAttribute('jw', new THREE.BufferAttribute(new Float32Array(cnt), 1)); ig.index = geo.index; for (const k in geo.attributes) ig.setAttribute(k, geo.attributes[k]); const ly = new Float32Array(N); for (let i = 0; i < N; i++) ly[i] = i / (N - 1); ig.setAttribute('layer', new THREE.InstancedBufferAttribute(ly, 1)); ig.instanceCount = N; const m = new THREE.Mesh(ig, mat); m.frustumCulled = false; return m; }
  blob(sx, sy, sz, warp, seg = 40) { const g = new THREE.SphereGeometry(1, seg, Math.round(seg * .75)); const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.set(v.x * sx, v.y * sy, v.z * sz); if (warp) warp(v); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; }
  sculpt(seg, fn) { seg = Math.round(seg * (this.q === 'low' ? .6 : this.q === 'med' ? .8 : 1)); const g = new THREE.SphereGeometry(1, seg, Math.round(seg * .75)), p = g.attributes.position, n = new THREE.Vector3(), fm = new Float32Array(p.count), jw = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) { n.fromBufferAttribute(p, i).normalize(); const [x, y, z, f, j] = fn(null, n); p.setXYZ(i, x, y, z); fm[i] = f; jw[i] = j; }
    g.setAttribute('fm', new THREE.BufferAttribute(fm, 1)); g.setAttribute('jw', new THREE.BufferAttribute(jw, 1)); g.computeVertexNormals(); return g; }
  jawSkin(base) { const m = base.clone(); m.bumpMap = base.bumpMap; m.userData.uJaw = { value: 0 }; m.onBeforeCompile = sh => { sh.uniforms.uJaw = m.userData.uJaw; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float jw; uniform float uJaw; vec3 rxj(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x, v.y*c - v.z*s, v.y*s + v.z*c); }').replace('#include <beginnormal_vertex>', 'vec3 objectNormal = rxj(vec3(normal), uJaw*jw);').replace('#include <begin_vertex>', 'vec3 transformed = rxj(vec3(position) - vec3(0.,-.12,-.05), uJaw*jw) + vec3(0.,-.12,-.05);'); }; return m; }
  limb(r1, r2, len, seg = 22) { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14, a = t * Math.PI; pts.push(new THREE.Vector2(Math.pow(Math.sin(a), .3) * lerp(r1, r2, t) * (1 + .12 * Math.sin(t * Math.PI)), -t * len)); } const g = new THREE.LatheGeometry(pts, seg); g.computeVertexNormals(); return g; }
  build() {
    const s = this.scene, skin = new THREE.MeshStandardMaterial({ color: 0x161211, roughness: .48, metalness: 0, emissive: 0x050202 }), skinWet = new THREE.MeshStandardMaterial({ color: 0x120e0d, roughness: .38 });
    this.skinBump(skin); this.skinBump(skinWet);
    const root = this.root = new THREE.Group(); root.position.set(0, -.35, 0); s.add(root);
    // torso: one sculpted barrel with bare chest skin (pecs) in front and a silver saddle behind
    const spine = this.spine = new THREE.Group(); spine.position.set(0, .55, 0); root.add(spine);
    const G = (x, s) => Math.exp(-(x * x) / (s * s));
    const torsoGeo = this.sculpt(64, (v, n) => { // v = unit sphere point; returns [x,y,z, furMask]
      const y = n.y, ax = Math.abs(n.x), front = Math.max(0, n.z);
      let sx = .6 + .52 * G(y - .42, .5) - .12 * Math.max(0, y - .85) * 4, sy = .98, sz = .56 + .08 * G(y - .3, .4);
      let x = n.x * sx, yy = n.y * sy, z = n.z * sz;
      z += front * (.11 * G(y - .3, .2) * G(ax - .3, .22) + .05 * G(y + .35, .3) * G(n.x, .4)); // pecs + belly
      if (y > .5) yy += .12 * G(ax - .45, .3) * (y - .5) * 2; // trapezius mound
      z -= Math.max(0, -n.z) * .05 * (y > .2 ? 1 : 0);
      const d = (n.x / .46) ** 2 + ((y - .26) / .3) ** 2, fm = Math.max(smoothstep(.45, 1.2, d), 1 - smoothstep(.3, .5, front));
      return [x, yy, z, fm, 0];
    });
    const torsoSkin = new THREE.Mesh(torsoGeo, skin); torsoSkin.position.y = .8; spine.add(torsoSkin); this.pecs = torsoSkin;
    const torsoFur = this.furMesh(torsoGeo, this.furMat({ len: .13, density: 60, silverY: 1.15 })); torsoFur.position.y = .8; spine.add(torsoFur);
    // neck + head: one sculpted skull (sagittal crest, brow ridge, deep eye sockets, broad nose, muzzle) with a hinged jaw
    const neck = this.neck = new THREE.Group(); neck.position.set(0, 1.62, .22); spine.add(neck);
    const head = this.head = new THREE.Group(); head.position.set(0, .24, .06); head.scale.setScalar(1.28); neck.add(head);
    const headGeo = this.sculpt(72, (v, n) => {
      const y = n.y, x = n.x, ax = Math.abs(x), f = Math.max(0, n.z);
      let X = x * .34, Y = y * .4, Z = n.z * .36;
      if (y > .3) { const c = (y - .3); Y += .09 * c * G(x, .3); Z -= .12 * c; X *= 1 - .08 * c; } // crest
      Z += f * f * (.2 * G(y + .4, .26) * G(x, .55));            // muzzle
      Z += f * (.085 * G(y - .2, .07) * (1 - smoothstep(.62, .8, ax))); Y += f * .03 * G(y - .2, .08);   // brow ridge
      Z -= f * .075 * G(y - .06, .075) * G(ax - .24, .085);       // eye sockets
      Z += f * (.07 * G(y + .12, .12) * G(x, .2) + .03 * G(y - .02, .1) * G(x, .1)); X += x * f * .3 * G(y + .15, .08) * G(x, .22); // broad flat nose
      Z -= f * .03 * G(y + .44, .025) * G(x, .35);                 // mouth line
      Z -= Math.max(0, -n.z) * .04;
      const faceM = smoothstep(.4, .6, f) * (1 - smoothstep(.14, .3, y)) * (1 - smoothstep(.45, .62, ax)); const browHair = G(y - .22, .05) * f;
      const fm = clamp(1 - faceM + browHair * .8, 0, 1);
      const jw = f > .1 ? smoothstep(-.4, -.5, y) : smoothstep(-.6, -.75, y);
      return [X, Y, Z, fm, jw];
    });
    const skinJ = this.jawSkin(skin); const headSkin = new THREE.Mesh(headGeo, skinJ); head.add(headSkin);
    const headFurMat = this.furMat({ len: .055, density: 120, tip: 0x5a4234 }); this.headFur = this.furMesh(headGeo, headFurMat); head.add(this.headFur); this.jawMats = [skinJ, headFurMat];
    this.jaw = { rotation: { x: 0 } }; this.brow = { position: { y: 0 } }; this.face = head;
    // mouth interior + teeth (seen when he roars) - rotate with the jaw
    this.jawG = new THREE.Group(); this.jawG.position.set(0, -.12, -.05); head.add(this.jawG);
    const mouth = new THREE.Mesh(this.blob(.17, .1, .14), new THREE.MeshStandardMaterial({ color: 0x3a0806, roughness: .45, emissive: 0x120000 })); mouth.position.set(0, -.04, .25); head.add(mouth);
    const toothM = new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: .3 });
    const teeth = (grp, y, z0, up) => { for (let i = -3; i <= 3; i++) { const can = Math.abs(i) === 3, t = new THREE.Mesh(new THREE.ConeGeometry(can ? .016 : .011, can ? .07 : .026, 8), toothM); const a = i * .19; t.position.set(Math.sin(a) * .12, y, z0 + Math.cos(a) * .1); t.rotation.x = up ? 0 : Math.PI; grp.add(t); } };
    teeth(head, -.14, .27, false); const lower = new THREE.Group(); this.jawG.add(lower); teeth(lower, -.07, .32, true);
    // flared nostrils: raycast the sculpted nose so they sit on the surface
    { const rc = new THREE.Raycaster(), tmp = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial()); const nm = new THREE.MeshStandardMaterial({ color: 0x050303, roughness: .9 });
      for (const sx of [-1, 1]) { rc.set(new THREE.Vector3(sx * .042, -.062, 2), new THREE.Vector3(0, 0, -1)); const h = rc.intersectObject(tmp)[0]; if (!h) continue; const n = new THREE.Mesh(this.blob(.022, .014, .012, null, 16), nm); n.position.copy(h.point); n.position.z -= .004; n.rotation.z = sx * .5; head.add(n); } }
    // eyes, deep in the sockets
    this.eyes = []; this.lids = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group(); eye.position.set(sx * .083, .022, .335); eye.scale.setScalar(.72); head.add(eye);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(.03, 24, 18), new THREE.MeshPhysicalMaterial({ color: 0x140904, roughness: .05, clearcoat: 1, clearcoatRoughness: .02 })); eye.add(ball);
      const iris = new THREE.Mesh(new THREE.CircleGeometry(.021, 24), new THREE.MeshBasicMaterial({ color: 0x23110a })); iris.position.z = .0292; eye.add(iris);
      const pup = new THREE.Mesh(new THREE.CircleGeometry(.011, 20), new THREE.MeshBasicMaterial({ color: 0x000000 })); pup.position.z = .0296; eye.add(pup);
      this.eyes.push(eye);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(.034, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin); lid.position.copy(eye.position); lid.scale.setScalar(.75); lid.rotation.x = -1.9; head.add(lid); this.lids.push(lid);
    }
    // arms (long, massive forearms, knuckle hands)
    const arm = (sx) => {
      const sh = new THREE.Group(); sh.position.set(sx * .82, 1.33, .02); spine.add(sh);
      const upper = this.furMesh(this.limb(.27, .22, .82), this.furMat({ len: .11, density: 65, silverY: 1.55 })); upper.position.y = .1; sh.add(upper);
      const delt = this.furMesh(this.blob(.3, .28, .3), this.furMat({ len: .11, density: 65, silverY: 1.2 })); delt.position.y = .02; sh.add(delt);
      const el = new THREE.Group(); el.position.y = -.68; sh.add(el);
      const fore = this.furMesh(this.limb(.25, .17, .8), this.furMat({ len: .1, density: 70 })); el.add(fore);
      const wr = new THREE.Group(); wr.position.y = -.78; el.add(wr);
      const hand = new THREE.Group(); wr.add(hand);
      const palm = new THREE.Mesh(this.blob(.15, .12, .13), skin); palm.position.set(0, -.08, .02); hand.add(palm);
      const back = this.furMesh(this.blob(.16, .11, .12), this.furMat({ len: .03, density: 140 })); back.position.set(0, -.05, -.02); hand.add(back);
      const fingers = new THREE.Group(); fingers.position.set(0, -.17, .05); hand.add(fingers);
      for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(this.blob(.04, .06, .045, null, 14), skin); f.position.set((i - 1.5) * .07, 0, 0); fingers.add(f); const k = new THREE.Mesh(this.blob(.036, .05, .04, null, 12), skin); k.position.set((i - 1.5) * .07, -.06, .03); fingers.add(k); }
      const thumb = new THREE.Mesh(this.blob(.04, .07, .04, null, 12), skin); thumb.position.set(-sx * .14, -.08, .08); thumb.rotation.z = sx * .6; hand.add(thumb);
      return { sh, el, wr, hand, fingers };
    };
    this.L = arm(1); this.R = arm(-1);
  }
  skinBump(mat) { mat.bumpMap = this.tex(256, 256, (g, w, h) => { const im = g.createImageData(w, h); for (let i = 0; i < w * h; i++) { const v = 110 + Math.random() * 90; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0); }); mat.bumpMap.colorSpace = THREE.NoColorSpace; mat.bumpMap.wrapS = mat.bumpMap.wrapT = THREE.RepeatWrapping; mat.bumpMap.repeat.set(3, 3); mat.bumpScale = .6; }
  particles() {
    const N = this.q === 'low' ? 120 : 320, g = new THREE.BufferGeometry(), p = new Float32Array(N * 3), sp = new Float32Array(N); for (let i = 0; i < N; i++) { p[i * 3] = (Math.random() - .5) * 9; p[i * 3 + 1] = Math.random() * 7 - .5; p[i * 3 + 2] = -1 - Math.random() * 6; sp[i] = .2 + Math.random() * .6; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); this.emberSpeed = sp;
    const dot = this.tex(32, 32, (c, w) => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,230,160,1)'); gr.addColorStop(.3, 'rgba(255,120,30,.8)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); });
    this.embers = new THREE.Points(g, new THREE.PointsMaterial({ size: .07, map: dot, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffaa66 })); this.scene.add(this.embers); this.dot = dot;
    // fire along the ledge
    const F = this.q === 'low' ? 40 : 90, fg = new THREE.BufferGeometry(), fp = new Float32Array(F * 3); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); this.fireLife = new Float32Array(F).map(() => Math.random());
    this.flames = new THREE.Points(fg, new THREE.PointsMaterial({ size: .32, map: dot, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xff7a22, opacity: .85 })); this.flames.visible = false; this.scene.add(this.flames);
    // debris burst (slam)
    const D = 70, dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(D * 3), 3)); this.debris = { pts: new THREE.Points(dg, new THREE.PointsMaterial({ size: .09, map: dot, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffd080 })), v: new Float32Array(D * 3), life: 0 };
    this.debris.pts.visible = false; this.scene.add(this.debris.pts);
  }
  // ---------- framing: ledge lines up with the top of the reel window ----------
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight; this.renderer.setSize(w, h, false); const asp = w / h; this.cam.aspect = asp;
    const yl = 1 - 2 * this.frameFrac, top = 2.42, yt = .8; let d = 5.2, dt = (top - this.ledge.y) / (yt - yl);
    dt = Math.max(dt, 1.35 / asp); // narrow screens: widen so shoulders + arms stay in
    const halfFov = Math.atan(dt / d); this.cam.fov = halfFov * 2 * 180 / Math.PI; const camY = this.ledge.y - yl * dt; this.cam.position.set(0, camY, d + this.ledge.z * 0); this.cam.lookAt(0, camY, 0); this.cam.updateProjectionMatrix();
    this.dt = dt; this.camY = camY; this.d = d;
    // put ledge exactly at the frame top (it sits a little in front of the gorilla)
    const scale = (d - this.ledge.z) / d; this.ledgeMesh.position.set(0, camY + yl * dt * scale - .17, this.ledge.z); this.ledgeY = camY + yl * dt * scale;
    this.ledgeMesh.scale.x = Math.max(1, asp * dt * scale * 2 / 5.2 * 1.05);
    // body scale so the gorilla fills the width on narrow screens
    this.root.position.y = this.ledgeY - .95;
  }
  worldXForScreen(fx) { const scale = (this.d - this.ledge.z) / this.d; return (fx * 2 - 1) * this.cam.aspect * this.dt * scale; }
  // ---------- actions ----------
  act(name, frames, opts = {}) { // frames: [{t:sec, p:{...pose}, e:'io'}], sets pose targets over time
    return new Promise(res => { this.actions = this.actions.filter(a => !(opts.exclusive !== false && a.arms && opts.arms)); this.actions.push({ name, frames, t0: this.t, res, arms: !!opts.arms, cb: opts.cb || {} , fired: {} }); });
  }
  busy() { return this.actions.some(a => a.arms); }
  lookAt(mode) { this.look.mode = mode; this.look.next = 0; }
  chestBeat(beats = 6) {
    const f = [{ t: 0, p: { shL: [-1.35, 0, -.45], shR: [-1.35, 0, .45], elL: -1.85, elR: -1.85, wrL: .3, wrR: .3, spX: -.05, nkX: -.15 } }], cb = {};
    for (let i = 0; i < beats; i++) { const t = .35 + i * .19, L = i % 2 === 0; f.push({ t, p: L ? { shL: [-1.2, 0, -.62], shR: [-1.45, 0, .35] } : { shL: [-1.45, 0, -.35], shR: [-1.2, 0, .62] } }); cb[t.toFixed(2)] = () => { this.shake = Math.max(this.shake, .05); this.pecPulse = 1; this.emit('beat', L ? 'L' : 'R'); }; }
    f.push({ t: .35 + beats * .19 + .1, p: { shL: [-1.35, 0, -.45], shR: [-1.35, 0, .45] } }, { t: .35 + beats * .19 + .7, p: this.restArms() });
    return this.act('chest', f, { arms: true, cb });
  }
  roar(dur = 1.8) {
    this.emit('roar');
    return this.act('roar', [{ t: 0, p: {} }, { t: .35, p: { nkX: -.55, spX: -.12, jaw: .62, brow: .05, shL: [-.9, 0, .85], shR: [-.9, 0, -.85], elL: -1.4, elR: -1.4, fistL: 1, fistR: 1 } }, { t: .4 + dur, p: { nkX: -.5, jaw: .55 } }, { t: .8 + dur, p: { ...this.restArms(), nkX: .18, jaw: .02, spX: .12, brow: 0 } }], { arms: true, cb: { '0.35': () => { this.shake = .35; this.lightning(); } } });
  }
  slam(fx = .5) { // smash down on the frame at screen x fraction fx; resolves at impact
    const side = fx >= .5 ? 'L' : 'R', x = this.worldXForScreen(fx), sh = side === 'L' ? 'shL' : 'shR', el = side === 'L' ? 'elL' : 'elR', sg = side === 'L' ? 1 : -1;
    const reach = clamp((x - sg * .82) / 1.4, -.9, .9); // abduction needed to land over target x
    let hit; const p = new Promise(r => hit = r);
    this.act('slam', [{ t: 0, p: {} }, { t: .55, p: { [sh]: [-2.75, 0, sg * .25], [el]: -1.3, spX: -.1, nkX: .35, brow: -.05, jaw: .25 } }, { t: .85, p: { [sh]: [-2.85, 0, sg * .2], [el]: -1.4 } }, { t: 1.02, p: { [sh]: [-.95, 0, reach * sg * -1 * -1], [el]: -.15, spX: .32, nkX: .45, jaw: .4 }, e: 'in' }, { t: 1.35, p: {} }, { t: 2.0, p: { ...this.restArms(), spX: .12, nkX: .18, jaw: .02, brow: 0 } }],
      { arms: true, cb: { '1.02': () => { this.shake = .6; this.burst(x); this.emit('slam', fx); hit(); } } });
    return p;
  }
  reactBill() { this.lookAt('slot'); return this.act('bill', [{ t: 0, p: {} }, { t: .4, p: { brow: .06, spY: -.15, nkY: -.35, nkX: .35 } }, { t: 1.6, p: { brow: .04 } }, { t: 2.3, p: { brow: 0, spY: 0, nkY: 0, nkX: .18 } }], { cb: { '2.30': () => this.lookAt('idle') } }); }
  nod() { return this.act('nod', [{ t: 0, p: {} }, { t: .25, p: { nkX: .45 } }, { t: .5, p: { nkX: .1 } }, { t: .75, p: { nkX: .35 } }, { t: 1.1, p: { nkX: .18 } }]); }
  restArms() { return { shL: [...this.rest.shL], shR: [...this.rest.shR], elL: this.rest.elL, elR: this.rest.elR, wrL: .25, wrR: .25 }; }
  lightning() { this.flashT = 1; this.emit('thunder'); }
  burst(x) { const d = this.debris, p = d.pts.geometry.attributes.position; for (let i = 0; i < p.count; i++) { p.setXYZ(i, x + (Math.random() - .5) * .3, this.ledgeY, this.ledge.z + .1); d.v[i * 3] = (Math.random() - .5) * 4; d.v[i * 3 + 1] = Math.random() * 4 + 1; d.v[i * 3 + 2] = Math.random() * 2; } p.needsUpdate = true; d.life = 1; d.pts.visible = true; }
  emit(ev, a) { if (this.on && this.on[ev]) this.on[ev](a); }
  setQuality(q) { localStorage.setItem('gorillaQ', q); location.reload(); }
  // ---------- per frame ----------
  tick() {
    const dt = Math.min(.05, this.clock.getDelta()); this.t += dt; const t = this.t;
    this.frames++; this.fpsT += dt; if (this.fpsT > 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    // targets: rest + actions
    const P = JSON.parse(JSON.stringify(this.rest));
    for (const a of [...this.actions]) {
      const lt = t - a.t0, fr = a.frames; let i = 0; while (i < fr.length - 1 && fr[i + 1].t <= lt) i++;
      for (const k in a.cb) if (!a.fired[k] && lt >= +k) { a.fired[k] = 1; try { a.cb[k](); } catch (e) { console.error(e); } }
      // accumulate keyframe poses up to i (each frame only lists changes)
      const acc = {}; for (let j = 0; j <= i; j++) Object.assign(acc, JSON.parse(JSON.stringify(fr[j].p)));
      const nxt = fr[i + 1]; if (nxt) { const u = (ease[nxt.e || 'io'])(clamp((lt - fr[i].t) / (nxt.t - fr[i].t), 0, 1)); const tgt = { ...acc, ...nxt.p }; for (const k in tgt) { const a0 = acc[k] != null ? acc[k] : P[k], b0 = tgt[k]; P[k] = Array.isArray(b0) ? b0.map((v, n) => lerp(a0[n], v, u)) : lerp(a0, b0, u); } }
      else Object.assign(P, acc);
      if (lt > fr[fr.length - 1].t) { this.actions.splice(this.actions.indexOf(a), 1); a.res(); }
    }
    // smooth toward targets (slams snap faster)
    const k = 1 - Math.exp(-dt * (this.actions.some(a => a.name === 'slam') ? 26 : 12));
    for (const key in P) { const v = P[key]; this.cur[key] = Array.isArray(v) ? v.map((x, n) => lerp(this.cur[key][n], x, k)) : lerp(this.cur[key], v, k); }
    const C = this.cur, br = Math.sin(t * 1.5) * .5 + .5;
    // breathing + idle sway
    this.spine.rotation.set(C.spX + br * .015, C.spY + Math.sin(t * .37) * .03, Math.sin(t * .5) * .012); this.spine.scale.set(1 + br * .012, 1 + br * .008, 1 + br * .02);
    if (this.pecPulse) { this.spine.position.z = -this.pecPulse * .03; this.pecPulse = Math.max(0, this.pecPulse - dt * 8); }
    // head look: saccades between points of interest
    const L = this.look; if (t > L.next) { const m = L.mode; if (m === 'reels') { L.tx = (Math.random() - .5) * .5; L.ty = .55; L.next = t + .4 + Math.random() * .6; } else if (m === 'slot') { L.tx = -.5; L.ty = .55; L.next = t + 9; } else if (m === 'player') { L.tx = 0; L.ty = -.05; L.next = t + 2; } else { const r = Math.random(); L.tx = r < .45 ? (Math.random() - .5) * .9 : 0; L.ty = r < .45 ? (Math.random() - .5) * .3 : .05 + Math.random() * .2; L.next = t + 1.2 + Math.random() * 3; } }
    L.x = lerp(L.x, L.tx, 1 - Math.exp(-dt * 5)); L.y = lerp(L.y, L.ty, 1 - Math.exp(-dt * 5));
    this.neck.rotation.set(C.nkX + L.y * .7 - .1, C.nkY + L.x * .8, -L.x * .1); this.head.rotation.set(L.y * .25, L.x * .25, 0);
    const ja = C.jaw + br * .01; this.jawMats[0].userData.uJaw.value = ja; this.jawMats[1].uniforms.uJaw.value = ja; this.jawG.rotation.x = ja; this.eyes.forEach(e => e.rotation.set(L.y * .5 - .1, L.x * .6, 0));
    // blink
    if (t > this.nextBlink) { this.blink = 1; this.nextBlink = t + 2 + Math.random() * 4; } this.blink = Math.max(0, this.blink - dt * 7); const lid = this.blink > .5 ? (1 - this.blink) * 2 : this.blink * 2; this.lids.forEach(l => l.rotation.x = -1.9 + lid * 1.75);
    // arms
    for (const [A, s, e, w, f] of [[this.L, C.shL, C.elL, C.wrL, C.fistL], [this.R, C.shR, C.elR, C.wrR, C.fistR]]) { A.sh.rotation.set(s[0], s[1], s[2]); A.el.rotation.x = e; A.wr.rotation.x = w; A.fingers.rotation.x = f * 1.1; }
    // set dressing
    for (const m of this.furMats) m.uniforms.uTime.value = t;
    const fl = 6 + Math.sin(t * 13) * 1 + Math.sin(t * 7.3) * 1.2 + Math.random(); this.fire.intensity = fl * (this.fireBoost || 1); for (const m of this.furMats) m.uniforms.uFire.value = fl / 5 * (this.fireBoost || 1);
    if (this.flashT > 0) { this.flash.intensity = (Math.random() < .6 ? 60 : 5) * this.flashT; this.flashT = Math.max(0, this.flashT - dt * 1.6); this.hemi.intensity = .55 + this.flashT * 2; for (const m of this.furMats) m.uniforms.uAmb.value.setRGB(.16 + this.flashT * .5, .1 + this.flashT * .5, .08 + this.flashT * .6); } else { this.flash.intensity = 0; }
    this.rays.forEach((r, i) => { r.material.opacity = .14 + .1 * Math.sin(t * .4 + i); });
    const ep = this.embers.geometry.attributes.position; for (let i = 0; i < ep.count; i++) { let y = ep.getY(i) + this.emberSpeed[i] * dt; if (y > 6.5) y = -.5; ep.setY(i, y); ep.setX(i, ep.getX(i) + Math.sin(t + i) * dt * .1); } ep.needsUpdate = true;
    const fp = this.flames.geometry.attributes.position, W = this.ledgeMesh.scale.x * 2.6; for (let i = 0; i < fp.count; i++) { this.fireLife[i] += dt * (1.2 + (i % 5) * .2); if (this.fireLife[i] > 1) { this.fireLife[i] = 0; } const l = this.fireLife[i]; fp.setXYZ(i, ((i * 0.618) % 1 - .5) * W * 2 + Math.sin(t * 3 + i) * .05, this.ledgeY + .05 + l * .45, this.ledge.z + .32); } fp.needsUpdate = true; this.flames.material.size = .3 + .05 * Math.sin(t * 9);
    const d = this.debris; if (d.life > 0) { const p = d.pts.geometry.attributes.position; for (let i = 0; i < p.count; i++) { d.v[i * 3 + 1] -= 9 * dt; p.setXYZ(i, p.getX(i) + d.v[i * 3] * dt, p.getY(i) + d.v[i * 3 + 1] * dt, p.getZ(i) + d.v[i * 3 + 2] * dt); } p.needsUpdate = true; d.life -= dt * .8; d.pts.material.opacity = d.life; if (d.life <= 0) d.pts.visible = false; }
    // camera: slow drift + shake
    this.shake = Math.max(0, this.shake - dt * 1.4); const sk = this.shake * this.shake;
    this.cam.position.x = Math.sin(t * .21) * .06 + (Math.random() - .5) * sk * .5; this.cam.position.y = this.camY + Math.sin(t * .17) * .03 + (Math.random() - .5) * sk * .4;
    this.layers.forEach((m, i) => { m.position.x = -this.cam.position.x * (i + 1) * .6; });
    if (this.onShake) this.onShake(sk);
    this.renderer.render(this.scene, this.cam);
  }
}
