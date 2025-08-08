(function(){
  'use strict';

  // ===== Canvas =====
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // ===== Audio / SFX =====
  let AC = null, graph = null;
  const resumeAudio = () => {
    try{
      if(!AC){
        const Ctor = window.AudioContext || window.webkitAudioContext; AC = new Ctor();
        graph = {};
        graph.delay = AC.createDelay(0.5);
        graph.feedback = AC.createGain(); graph.feedback.gain.value = 0.25;
        graph.wet = AC.createGain(); graph.wet.gain.value = 0.18;
        graph.master = AC.createGain(); graph.master.gain.value = 0.7;
        graph.comp = AC.createDynamicsCompressor();
        graph.comp.threshold.value = -18; graph.comp.knee.value = 30; graph.comp.ratio.value = 3.5;
        graph.comp.attack.value = 0.003; graph.comp.release.value = 0.12;
        graph.delay.delayTime.value = 0.18;
        graph.delay.connect(graph.feedback); graph.feedback.connect(graph.delay);
        graph.delay.connect(graph.wet); graph.wet.connect(AC.destination);
        graph.master.connect(graph.comp); graph.comp.connect(AC.destination);
      }
      if(AC.state === 'suspended') AC.resume();
    }catch(e){/* noop */}
  };

  function tone(freq, opts={}){
    if(!AC) resumeAudio(); if(!AC) return;
    const now = AC.currentTime, t = now + (opts.offset||0);
    const dur = Math.max(0.02, opts.dur ?? 0.12);
    const attack = Math.min(0.05, opts.attack ?? 0.005);
    const decay = Math.min(0.5, opts.decay ?? 0.08);
    const sustain = Math.max(0, Math.min(1, opts.sustain ?? 0.0));
    const rel = Math.min(0.5, opts.release ?? 0.06);
    const gainVal = Math.min(0.5, opts.gain ?? 0.08);
    const osc = AC.createOscillator(); osc.type = opts.type || 'sine';
    const g = AC.createGain();
    osc.frequency.setValueAtTime(freq, t); if(opts.detune) osc.detune.setValueAtTime(opts.detune, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainVal), t+attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainVal*(sustain||0.001)), t+attack+decay);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur+rel);
    osc.connect(g); g.connect(graph.master); g.connect(graph.delay);
    osc.start(t); osc.stop(t+dur+rel+0.02);
  }
  function chord(freqs, opts={}){ freqs.forEach((f,i)=>tone(f,{...opts, offset:(opts.offset||0)+(opts.stagger||0)*i})); }
  function noiseBurst(dur=0.08, {hp=400, lp=2800, gain=0.25}={}){
    if(!AC) resumeAudio(); if(!AC) return; const t = AC.currentTime;
    const frames = Math.max(1, Math.floor(dur * AC.sampleRate));
    const buf = AC.createBuffer(1, frames, AC.sampleRate), data = buf.getChannelData(0);
    for(let i=0;i<frames;i++){ const env = 1 - i/frames; data[i] = (Math.random()*2-1)*Math.pow(env,1.5); }
    const src = AC.createBufferSource(); src.buffer = buf;
    const hpF = AC.createBiquadFilter(); hpF.type='highpass'; hpF.frequency.value = hp;
    const lpF = AC.createBiquadFilter(); lpF.type='lowpass'; lpF.frequency.value = lp;
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(gain,t+0.004); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    src.connect(hpF); hpF.connect(lpF); lpF.connect(g); g.connect(graph.master); g.connect(graph.delay);
    src.start(t); src.stop(t+dur+0.01);
  }
  function bam(row=0){ if(!AC) resumeAudio(); if(!AC) return; const t = AC.currentTime;
    const o = AC.createOscillator(); const g = AC.createGain(); o.type='sine';
    const base = Math.max(110, 200 - row*10); o.frequency.setValueAtTime(base,t); o.frequency.exponentialRampToValueAtTime(base*0.55,t+0.10);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.22,t+0.004); g.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
    o.connect(g); g.connect(graph.master); g.connect(graph.delay); o.start(t); o.stop(t+0.14);
    noiseBurst(0.07,{hp:700, lp:3500, gain:0.22});
  }
  const SFX = {
    wall(){ tone(1300,{type:'triangle', dur:0.05, gain:0.05}); },
    paddle(rel=0, speed=4){ const base = 400 + rel*220; const s = Math.min(1.5, Math.max(0.8, speed/5)); chord([base, base*2], {type:'sine', dur:0.09*s, gain:0.06}); },
    brick(row=0){ bam(row); },
    bombHit(){ chord([220,330], {type:'sawtooth', dur:0.08, gain:0.05}); noiseBurst(0.06,{hp:600, lp:2200, gain:0.18}); },
    explosion(){ if(!AC) resumeAudio(); if(!AC) return; const t=AC.currentTime; const o=AC.createOscillator(); const g=AC.createGain(); o.type='sine'; o.frequency.setValueAtTime(160,t); o.frequency.exponentialRampToValueAtTime(60,t+0.35); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.5,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.5); o.connect(g); g.connect(graph.master); g.connect(graph.delay); o.start(t); o.stop(t+0.55); noiseBurst(0.5,{hp:200, lp:2500, gain:0.35}); },
    loseLife(){ chord([440,370,311], {type:'sine', dur:0.18, gain:0.06, stagger:0.06}); },
    gameOver(){ chord([392,349,311,262], {type:'triangle', dur:0.22, gain:0.06, stagger:0.08}); },
    win(){ chord([523.25,659.25,783.99,987.77,1318.51], {type:'sine', dur:0.14, gain:0.06, stagger:0.06}); },
    pause(p){ tone(p?320:520, {type:'sine', dur:0.06, gain:0.04}); },
    clone(){ chord([660,990], {type:'square', dur:0.08, gain:0.05, stagger:0.03}); },
    saver(){ chord([740,880,1175], {type:'triangle', dur:0.10, gain:0.06, stagger:0.02}); noiseBurst(0.05,{hp:800, lp:3200, gain:0.15}); }
  };

  // ===== Texture helpers =====
  let grainPattern = null;
  function ensureGrainPattern(){
    if(grainPattern) return grainPattern;
    const c = document.createElement('canvas'); const s=96; c.width=s; c.height=s; const g = c.getContext('2d');
    const id = g.createImageData(s,s), d = id.data;
    for(let i=0;i<d.length;i+=4){ const n = 128 + (Math.random()*70 - 35); d[i]=d[i+1]=d[i+2]=n|0; d[i+3]=22; }
    g.putImageData(id,0,0); grainPattern = ctx.createPattern(c,'repeat'); return grainPattern;
  }
  const brickTexCache = new Map();
  function getBrickTexture(color){
    const key = color; if(brickTexCache.has(key)) return brickTexCache.get(key);
    const c = document.createElement('canvas'); c.width = 80; c.height = 24; const g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0,0,c.width,c.height);
    let grd = g.createLinearGradient(0,0,0,c.height);
    grd.addColorStop(0,'rgba(255,255,255,0.28)'); grd.addColorStop(0.3,'rgba(255,255,255,0.08)'); grd.addColorStop(0.7,'rgba(0,0,0,0.00)'); grd.addColorStop(1,'rgba(0,0,0,0.22)');
    g.fillStyle = grd; g.fillRect(0,0,c.width,c.height);
    g.globalAlpha = 0.07; g.fillStyle = '#000'; const step = 4;
    for(let s=-c.height; s<c.width+c.height; s+=step){ g.beginPath(); g.moveTo(s,0); g.lineTo(s+1,0); g.lineTo(s+1-c.height,c.height); g.lineTo(s-c.height,c.height); g.closePath(); g.fill(); }
    g.globalAlpha = 1; g.strokeStyle='rgba(0,0,0,0.25)'; g.lineWidth=2; g.strokeRect(1,1,c.width-2,c.height-2);
    brickTexCache.set(key,c); return c;
  }

  // Golf ball patterns (dimples) – kept for tests; gameplay ball uses bold patterns
  let golfPatternDark = null, golfPatternLight = null;
  function ensureGolfPatterns(){
    if(golfPatternDark && golfPatternLight) return;
    const t1 = document.createElement('canvas'); t1.width=8; t1.height=8; const g1 = t1.getContext('2d');
    const x=4, y=4, r=2.2; const sh = g1.createRadialGradient(x, y, 0, x, y, r);
    sh.addColorStop(0,'rgba(0,0,0,0.55)'); sh.addColorStop(1,'rgba(0,0,0,0)');
    g1.beginPath(); g1.fillStyle = sh; g1.arc(x,y,r,0,Math.PI*2); g1.fill();
    const t2 = document.createElement('canvas'); t2.width=8; t2.height=8; const g2 = t2.getContext('2d');
    const r2=2.4; const hl = g2.createRadialGradient(x, y, 0, x, y, r2);
    hl.addColorStop(0,'rgba(255,255,255,0)'); hl.addColorStop(0.55,'rgba(255,255,255,1)'); hl.addColorStop(1,'rgba(255,255,255,0)');
    g2.beginPath(); g2.fillStyle = hl; g2.arc(x,y,r2,0,Math.PI*2); g2.fill();
    golfPatternDark = ctx.createPattern(t1,'repeat'); golfPatternLight = ctx.createPattern(t2,'repeat');
  }

  // ===== Game state =====
  const ballR = 8; let ballX = W/2, ballY = H-30; let dx = 3, dy = -3; let ballSpin = 0, ballSpinSpeed = 0;
  const paddle = { w:96, h:12, x:(W-96)/2, y:H-22, speed:7 };
  const brick = { rows:5, cols:8, padding:10, offsetTop:60, offsetLeft:30, w:0, h:20 };
  brick.w = Math.floor((W - brick.offsetLeft*2 - brick.padding*(brick.cols-1))/brick.cols);

  // Create bricks grid (types will be randomized on game start)
  const bricks = Array.from({length:brick.cols}, ()=>
    Array.from({length:brick.rows}, ()=>({x:0,y:0,status:1,type:'normal',hp:1,flash:0}))
  );

  // Randomize brick layout and assign HP/status
  function randomizeBricks(){
    const total = brick.cols * brick.rows;
    const bombCount = 4; // unchanged
    const cloneCount = 4; // increased from 2 → 4
    const normalCount = total - bombCount - cloneCount;
    const types = [];
    for(let i=0;i<bombCount;i++) types.push('bomb');
    for(let i=0;i<cloneCount;i++) types.push('clone');
    for(let i=0;i<normalCount;i++) types.push('normal');
    // Fisher-Yates shuffle
    for(let i=types.length-1;i>0;i--){ const j = (Math.random()*(i+1))|0; const tmp=types[i]; types[i]=types[j]; types[j]=tmp; }
    let k=0;
    for(let c=0;c<brick.cols;c++){
      for(let r=0;r<brick.rows;r++){
        const t = types[k++]; const b = bricks[c][r];
        b.status = 1; b.type = t; b.hp = (t==='bomb'?2:1); b.flash = 0;
      }
    }
  }

  const rowColors = ['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#74c0fc'];
  let rightPressed=false,leftPressed=false; let score=0; let paused=true; let needsStart=true; let serveMessage='Press Space to start'; let shake=0; let lastOverlay={message:'', showScore:false};
  let tNow=0; let curBoosted=false; const SAVER_MAX = 3; const LOSS_PENALTY = 10; let saverCharges = SAVER_MAX;
  const BASE_SPIN = 0.22;
  const TEXTURES = ['rgb','golf','basketball','volleyball','tennis','split','checker','swirl','rings','stripes'];
  let textureIndex = TEXTURES.indexOf('rgb'); if(textureIndex < 0) textureIndex = 0;
  function currentTexture(){ return TEXTURES[textureIndex]; }
  function cycleTexture(dir=1){ textureIndex = (textureIndex + (dir>=0?1:TEXTURES.length-1)) % TEXTURES.length; }

  // ===== Balls (multi-ball) =====
  const balls = [];
  let frameHitBricks = new Set(); // Track bricks hit this frame to prevent multi-ball double-hits
  function makeBall(x, y, vx, vy, spin=0, spinSpeed=0){ return {x, y, dx:vx, dy:vy, spin, spinSpeed, returnSpeed: Math.hypot(vx,vy), boosted:false, boostDecay:false, boostUntil:0, combo:1}; }
  function initBallsSingle(){
    balls.length = 0;
    const speed = Math.hypot(3,3);
    // Random upward angle around straight up (−90° ± 72°)
    const spread = Math.PI * 0.8;
    const ang = -Math.PI/2 + (Math.random()-0.5) * spread; // negative dy
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed; // < 0 (upwards)
    const b = makeBall(W/2, H-30, vx, vy, 0, 0); balls.push(b);
    // sync globals for tests/drawBall()
    ballX=b.x; ballY=b.y; dx=b.dx; dy=b.dy; ballSpin=b.spin; ballSpinSpeed=b.spinSpeed;
  }
  function useBall(b){ ballX=b.x; ballY=b.y; dx=b.dx; dy=b.dy; ballSpin=b.spin; ballSpinSpeed=b.spinSpeed; }
  function saveBall(b){ b.x=ballX; b.y=ballY; b.dx=dx; b.dy=dy; b.spin=ballSpin; b.spinSpeed=ballSpinSpeed; }
  function duplicateBallFrom(src){
    // Clone spawns offset from source but flies in a RANDOM direction.
    // If source was boosted, use its base returnSpeed magnitude for the clone.
    const baseSpeed = (src.boosted && src.returnSpeed) ? src.returnSpeed : (Math.hypot(src.dx, src.dy) || 3);
    // Random direction, but avoid being too horizontal/vertical to keep gameplay lively
    let ang = Math.random() * Math.PI * 2;
    const minVyFrac = 0.30;
    if(Math.abs(Math.sin(ang)) < minVyFrac){
      const adjust = (minVyFrac - Math.abs(Math.sin(ang))) + (Math.random()*0.2);
      ang += adjust * (Math.random() < 0.5 ? 1 : -1);
    }
    let vx = Math.cos(ang) * baseSpeed;
    let vy = Math.sin(ang) * baseSpeed;
    // Spawn slightly offset to avoid immediate collision overlap
    const s = Math.hypot(src.dx, src.dy) || 1;
    const nx = -src.dy / s, ny = src.dx / s; // perpendicular for spawn offset
    const nb = makeBall(src.x + nx*1.2, src.y + ny*1.2, vx, vy, src.spin, src.spinSpeed);
    // Combo: inherit from source to incentivize cloning
    nb.combo = src.combo || 1;
    balls.push(nb); SFX.clone();
  }

  // initialize balls & bricks
  initBallsSingle();
  randomizeBricks();

  // ===== Floating score popups =====
  const floaters = [];
  function spawnFloater(x, y, amount, kind='normal'){
    const color = (kind==='bomb') ? '#74c0fc' : ((amount<0 || kind==='penalty') ? '#ff6b6b' : '#ffd43b');
    const txt = amount>=0 ? ('+'+amount) : String(amount);
    floaters.push({ x, y, vx:(Math.random()-0.5)*0.08, vy:-0.06 - Math.random()*0.03, life:900, lifeMax:900, txt, color });
  }
  
  // ===== Explosion particles =====
  const explosions = [];
  function spawnExplosion(x, y, intensity = 1){
    const particleCount = Math.floor(12 * intensity);
    for(let i = 0; i < particleCount; i++){
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.3;
      const speed = 2 + Math.random() * 3;
      const life = 600 + Math.random() * 400;
      explosions.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life, lifeMax: life,
        size: 2 + Math.random() * 4,
        color: ['#ff6b6b', '#ffa94d', '#ffd43b', '#ffffff'][Math.floor(Math.random() * 4)]
      });
    }
  }
  function updateFloaters(dt){
    for(let i=floaters.length-1;i>=0;i--){ const f=floaters[i]; f.x += f.vx*dt; f.y += f.vy*dt; f.life -= dt; if(f.life<=0) floaters.splice(i,1); }
  }
  function updateExplosions(dt){
    for(let i=explosions.length-1;i>=0;i--){ 
      const e=explosions[i]; 
      e.x += e.vx*dt; 
      e.y += e.vy*dt; 
      e.vx *= 0.98; // slow down
      e.vy *= 0.98;
      e.life -= dt; 
      if(e.life<=0) explosions.splice(i,1); 
    }
  }
  function drawFloaters(){
    if(floaters.length===0) return;
    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='middle';
    for(const f of floaters){
      const a = Math.max(0, f.life / f.lifeMax);
      ctx.globalAlpha = Math.pow(a, 0.9);
      ctx.font = 'bold 14px system-ui,-apple-system,Segoe UI,Roboto,Arial';
      ctx.fillStyle = f.color; ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=3;
      ctx.strokeText(f.txt, f.x, f.y);
      ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.restore();
  }
  function drawExplosions(){
    if(explosions.length===0) return;
    ctx.save();
    for(const e of explosions){
      const a = Math.max(0, e.life / e.lifeMax);
      ctx.globalAlpha = Math.pow(a, 0.7);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ===== Helpers =====
  function resetLevel(full=false){
    initBallsSingle(); paddle.x=(W-paddle.w)/2; if(full){ score=0; randomizeBricks(); saverCharges = SAVER_MAX; }
  }
  function waitForEnter(cb){
    const h = (e)=>{ if(e.key==='Enter'){ document.removeEventListener('keydown',h); cb(); } };
    document.addEventListener('keydown', h);
  }
  function lastBallOut(){
    initBallsSingle();
    // Center the paddle on respawn
    paddle.x = (W - paddle.w) / 2;
    paused = true; needsStart = true; serveMessage = 'Press Space to continue';
    // keep score and saverCharges intact for score‑chase mode
    return true;
  }
  function activateBoostFor(ball, mult=1.5, duration=4000){
    // Use CURRENT ball globals (dx,dy) so boost respects any bounce that just happened
    const base = Math.hypot(dx, dy);
    ball.returnSpeed = base;           // decay target
    dx *= mult; dy *= mult;            // boost the active ball's globals
    ball.dx = dx; ball.dy = dy;        // sync into the ball object immediately
    ball.boosted = true;               // per-ball flags/timer
    ball.boostDecay = false;
    ball.boostUntil = performance.now() + duration;
  }
  function activateBallSaver(){
    if(saverCharges<=0) return false;
    let affected = 0;
    for(const b of balls){ if(b.dy > 0){ b.dy = -Math.abs(b.dy); affected++; } }
    if(affected>0){ SFX.saver(); shake = Math.min(shake+8,16); saverCharges--; return true; }
    return false;
  }
  function applyServeSpin(){ if(balls[0] && Math.abs(balls[0].spinSpeed) < 0.001) balls[0].spinSpeed = BASE_SPIN * (balls[0].dx>=0?1:-1); }
  function serveStart(){ needsStart=false; paused=false; applyServeSpin(); SFX.pause(false); requestAnimationFrame(draw); }
  let lastRestartAt = 0;
  function restartGame(){
    const now = performance.now();
    if(now - lastRestartAt < 40) return; // debounce possible double Enter (global + overlay listener)
    lastRestartAt = now;
    resetLevel(true);
    serveMessage='Press Space to start';
    needsStart = true;
    paused = true;
    floaters.length = 0;
    shake = 0;
    lastOverlay={message:'',showScore:false};
    requestAnimationFrame(draw);
  }

  // Paddle hit handler (also used by tests)
  function onPaddleHit(b, rel, speed){
    const maxAngle = Math.PI/3;
    const ang = rel*maxAngle;
    dx = speed*Math.sin(ang);
    dy = -Math.abs(speed*Math.cos(ang));
    SFX.paddle(rel, speed);
    // Combo resets on paddle touch
    b.combo = 1;
    // Spin
    ballSpinSpeed += rel * 0.35;
    if(ballSpinSpeed>1.3) ballSpinSpeed=1.3;
    if(ballSpinSpeed<-1.3) ballSpinSpeed=-1.3;
    // New: paddle hit penalty
    score -= 1;
    spawnFloater(ballX, paddle.y - 14, -1, 'penalty');
  }

  function onBallLost(x, y){ score -= 10; spawnFloater(x, H - 18, -10, 'penalty'); if(SFX && SFX.loseLife) SFX.loseLife(); }

  // ===== Input =====
  document.addEventListener('keydown', e=>{
    resumeAudio();
    if(e.code==='ArrowRight' || e.key==='Right' || e.code==='KeyD' || e.key==='d' || e.key==='D'){ e.preventDefault(); rightPressed=true; }
    if(e.code==='ArrowLeft'  || e.key==='Left'  || e.code==='KeyA' || e.key==='a' || e.key==='A'){ e.preventDefault(); leftPressed=true; }
    if(e.code==='Space'){
      e.preventDefault();
      if(needsStart){ serveStart(); }
      else if(paused && lastOverlay && lastOverlay.message && lastOverlay.message.includes('YOU WIN')){ 
        // Proper restart sequence
        resetLevel(true);
        serveMessage='Press Space to start';
        needsStart = true;
        paused = true;
        floaters.length = 0;
        shake = 0;
        lastOverlay={message:'',showScore:false};
        lastTime = performance.now(); // Reset timing to prevent speed issues
        requestAnimationFrame(draw);
        // Start immediately
        serveStart();
      }
      else {
        paused=!paused; if(paused) lastOverlay={message:'',showScore:false};
        SFX.pause(paused); if(!paused) requestAnimationFrame(draw);
      }
    }
    if(e.code==='ArrowUp' || e.key==='Up' || e.code==='KeyW' || e.key==='w' || e.key==='W'){ e.preventDefault(); if(!paused && saverCharges>0){ activateBallSaver(); } }
    if(e.code==='KeyT' || e.key==='t' || e.key==='T'){ cycleTexture(1); tone(800,{dur:0.06,gain:0.04}); renderFrame(); }
    if(e.code==='Enter'){ e.preventDefault(); restartGame(); }
    // Secret debug hotkey: P ends the game and shows score
    if(e.code==='KeyP' || e.key==='p' || e.key==='P'){ e.preventDefault(); endGameNow(); }
  });
  document.addEventListener('keyup', e=>{
    if(e.code==='ArrowRight' || e.key==='Right' || e.code==='KeyD' || e.key==='d' || e.key==='D') rightPressed=false;
    if(e.code==='ArrowLeft'  || e.key==='Left'  || e.code==='KeyA' || e.key==='a' || e.key==='A') leftPressed=false;
  });
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) paused=true; });

  // ===== Drawing (single ball uses globals; we'll iterate for multi) =====
  function drawBall(){
    ctx.save();
    if(curBoosted){ ctx.shadowColor = '#3ba0ff'; ctx.shadowBlur = 16; }
    // Clip to ball
    ctx.save();
    ctx.beginPath(); ctx.arc(ballX, ballY, ballR, 0, Math.PI*2); ctx.clip();

    // Pattern (rotates with spin)
    ctx.save();
    ctx.translate(ballX, ballY);
    ctx.rotate(ballSpin);
    const tex = currentTexture();

    if(tex==='rgb'){
      // Polished RGB ball: 3 wedges + subtle hatch + vignette + inner rim
      const COLORS = ['#ff0000','#00ff55','#2a7dff'];
      const wedge = (i)=>{ const a0 = i*(2*Math.PI/3), a1=(i+1)*(2*Math.PI/3); ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0, ballR+1, a0, a1); ctx.closePath(); };
      for(let i=0;i<3;i++){ wedge(i); ctx.fillStyle = COLORS[i]; ctx.fill(); }
      for(let i=0;i<3;i++){
        ctx.save(); wedge(i); ctx.clip(); ctx.globalAlpha = 0.08; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.rotate(Math.PI/6 + i*0.35);
        const W2 = ballR*2.8, step=3; for(let y=-ballR*1.6; y<ballR*1.6; y+=step){ ctx.fillRect(-W2/2, y, W2, 1); }
        ctx.globalAlpha = 1; ctx.restore();
      }
      const vig = ctx.createRadialGradient(-ballR*0.2, -ballR*0.2, ballR*0.2, 0, 0, ballR);
      vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,'rgba(0,0,0,0.30)');
      ctx.fillStyle = vig; ctx.fillRect(-ballR-1, -ballR-1, ballR*2+2, ballR*2+2);
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const rim = ctx.createRadialGradient(-ballR*0.6, -ballR*0.7, ballR*0.1, -ballR*0.6, -ballR*0.7, ballR);
      rim.addColorStop(0,'rgba(255,255,255,0.22)'); rim.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle = rim; ctx.fillRect(-ballR-1, -ballR-1, ballR*2+2, ballR*2+2); ctx.restore();
      const gpBall = ensureGrainPattern(); if(gpBall){ ctx.save(); ctx.globalAlpha = 0.08; ctx.fillStyle = gpBall; ctx.fillRect(-ballR-1,-ballR-1,ballR*2+2,ballR*2+2); ctx.restore(); }
    }
    else if(tex==='golf'){
      let base = ctx.createRadialGradient(-ballR*0.35, -ballR*0.35, 1, 0, 0, ballR);
      base.addColorStop(0,'#ffffff'); base.addColorStop(1,'#dde3ee');
      ctx.fillStyle = base; ctx.beginPath(); ctx.arc(0,0, ballR+1, 0, Math.PI*2); ctx.fill();
      ensureGolfPatterns(); const sz = ballR*4;
      if(golfPatternDark){ ctx.save(); ctx.globalCompositeOperation='multiply'; ctx.globalAlpha=0.95; ctx.fillStyle=golfPatternDark; ctx.translate(-sz/2,-sz/2); ctx.fillRect(0,0,sz,sz); ctx.restore(); }
      if(golfPatternLight){ ctx.save(); ctx.globalCompositeOperation='screen'; ctx.globalAlpha=0.45; ctx.fillStyle=golfPatternLight; ctx.translate(-sz/2,-sz/2); ctx.fillRect(0,0,sz,sz); ctx.restore(); }
    }
    else if(tex==='basketball'){
      let base = ctx.createRadialGradient(-ballR*0.3, -ballR*0.3, 1, 0, 0, ballR); base.addColorStop(0,'#ff9a4c'); base.addColorStop(0.65,'#ff6a2e'); base.addColorStop(1,'#ff2b2b');
      ctx.fillStyle=base; ctx.beginPath(); ctx.arc(0,0, ballR+1, 0, Math.PI*2); ctx.fill();
      const seamW = 1.6; ctx.strokeStyle='rgba(120,24,12,0.95)'; ctx.lineWidth=seamW; ctx.lineCap='round';
      const rMain = ballR*0.78; ctx.beginPath(); ctx.arc(0,0, rMain, -Math.PI/2, Math.PI/2); ctx.stroke(); ctx.beginPath(); ctx.arc(0,0, rMain,  Math.PI/2, -Math.PI/2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0,0, rMain, 0, Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(0,0, rMain, Math.PI, 0); ctx.stroke();
      const rSide = ballR*0.78; const off = ballR*0.35; ctx.beginPath(); ctx.arc(-off, 0, rSide, -Math.PI/2, Math.PI/2); ctx.stroke(); ctx.beginPath(); ctx.arc( off, 0, rSide,  Math.PI/2, -Math.PI/2); ctx.stroke();
    }
    else if(tex==='volleyball'){
      let base = ctx.createRadialGradient(-ballR*0.3, -ballR*0.3, 1, 0, 0, ballR); base.addColorStop(0,'#ffffff'); base.addColorStop(1,'#e6edf7');
      ctx.fillStyle=base; ctx.beginPath(); ctx.arc(0,0, ballR+1, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle='#c7d0de'; ctx.lineWidth=2.6; ctx.lineCap='round';
      for(let i=0;i<3;i++){ ctx.save(); ctx.rotate(i*2*Math.PI/3); ctx.beginPath(); ctx.arc(0,0, ballR-1.2, -Math.PI*0.15, Math.PI*0.85); ctx.stroke(); ctx.restore(); }
      ctx.strokeStyle='rgba(0,0,0,0.10)'; ctx.lineWidth=1.2; for(let i=0;i<3;i++){ ctx.save(); ctx.rotate(i*2*Math.PI/3); ctx.beginPath(); ctx.arc(0,0, ballR-3.0, -Math.PI*0.15, Math.PI*0.85); ctx.stroke(); ctx.restore(); }
    }
    else if(tex==='tennis'){
      let base = ctx.createRadialGradient(-ballR*0.3, -ballR*0.3, 1, 0, 0, ballR); base.addColorStop(0,'#eaff6a'); base.addColorStop(1,'#b7ff3a');
      ctx.fillStyle=base; ctx.beginPath(); ctx.arc(0,0, ballR+1, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=3.0; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(-ballR*0.35, 0, ballR*1.1, -Math.PI*0.75, Math.PI*0.25); ctx.stroke();
      ctx.beginPath(); ctx.arc( ballR*0.35, 0, ballR*1.1,  Math.PI*0.75, -Math.PI*0.25); ctx.stroke();
    }
    else if(tex==='split'){
      ctx.fillStyle = '#111'; ctx.fillRect(-ballR-1, -ballR-1, ballR+1, 2*ballR+2); ctx.fillStyle = '#fff'; ctx.fillRect(0, -ballR-1, ballR+1, 2*ballR+2);
    }
    else if(tex==='checker'){
      const s=4; for(let y=-ballR-1,j=0; y<ballR+1; y+=s, j++) for(let x=-ballR-1,i=0; x<ballR+1; x+=s, i++){ ctx.fillStyle = ((i+j)&1) ? '#111' : '#fff'; ctx.fillRect(x,y,s,s); }
    }
    else if(tex==='swirl'){
      const arms=6; const t=(Math.PI*2)/arms; for(let i=0;i<arms;i++){ ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0, ballR+1, i*t, i*t + t*0.7); ctx.closePath(); ctx.fillStyle = (i%2===0)?'#fff':'#111'; ctx.fill(); }
    }
    else if(tex==='rings'){
      const th=2; ctx.lineWidth=th*2; for(let r=th/2,k=0; r<ballR+1; r+=th,k++){ ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.strokeStyle = (k%2===0)?'#fff':'#111'; ctx.stroke(); }
    }
    else if(tex==='stripes'){
      ctx.save(); ctx.rotate(Math.PI/4); const w=4; for(let y=-ballR*2,k=0; y<ballR*2; y+=w, k++){ ctx.fillStyle = (k%2===0)?'#fff':'#111'; ctx.fillRect(-ballR-2, y, ballR*2+4, w); } ctx.restore();
    }

    ctx.restore(); // end local pattern space

    // specular highlight
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(ballX - ballR*0.35, ballY - ballR*0.45, ballR*0.38, 0, Math.PI*2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.restore(); // end clip
    if(currentTexture()!=='basketball'){ ctx.beginPath(); ctx.arc(ballX, ballY, ballR, 0, Math.PI*2); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.restore();
  }

  function drawPaddle(){
    const grad = ctx.createLinearGradient(0, paddle.y, 0, paddle.y+paddle.h);
    grad.addColorStop(0,'#e8efff'); grad.addColorStop(1,'#b8c6ff');
    ctx.fillStyle = grad; ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillRect(paddle.x+1, paddle.y+1, paddle.w-2, 2);
    ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1; ctx.strokeRect(paddle.x+0.5, paddle.y+0.5, paddle.w-1, paddle.h-1);
  }

  function drawBricks(){
    for(let c=0;c<brick.cols;c++){
      for(let r=0;r<brick.rows;r++){
        const b = bricks[c][r]; if(b.status!==1) continue;
        b.x = brick.offsetLeft + c*(brick.w + brick.padding);
        b.y = brick.offsetTop  + r*(brick.h + brick.padding);
        if(b.type==='bomb'){
          ctx.save(); const x=b.x, y=b.y, w=brick.w, h=brick.h;
          let base = ctx.createLinearGradient(x,y,x+w,y+h); base.addColorStop(0,'#232834'); base.addColorStop(1,'#111722'); ctx.fillStyle=base; ctx.fillRect(x,y,w,h);
          const bulge = ctx.createRadialGradient(x+w*0.5, y+h*0.5, Math.min(w,h)*0.1, x+w*0.5, y+h*0.6, Math.max(w,h)); bulge.addColorStop(0,'rgba(255,255,255,0.10)'); bulge.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=bulge; ctx.fillRect(x,y,w,h);
          let bevel = ctx.createLinearGradient(x,y,x,y+h); bevel.addColorStop(0,'rgba(255,255,255,0.08)'); bevel.addColorStop(1,'rgba(0,0,0,0.18)'); ctx.fillStyle=bevel; ctx.fillRect(x,y,w,h);
          const rvt=2.2; ctx.fillStyle='rgba(240,246,255,0.8)'; ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=0.8; function rivet(rx,ry){ ctx.beginPath(); ctx.arc(rx,ry,rvt,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
          rivet(x+4,y+4); rivet(x+w-4,y+4); rivet(x+4,y+h-4); rivet(x+w-4,y+h-4);
          const capR = Math.min(w,h)*0.28; const cx = x+w*0.5, cy = y*h*0.53; const capG = ctx.createRadialGradient(cx-capR*0.3, cy-capR*0.3, 1, cx, cy, capR); capG.addColorStop(0,'#3a4254'); capG.addColorStop(1,'#161b26'); ctx.fillStyle=capG; ctx.beginPath(); ctx.arc(cx,cy,capR,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,capR*0.78,0,Math.PI*2); ctx.stroke();
          ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(x+3,y+3); ctx.lineTo(x+w-3,y+h-3); ctx.moveTo(x+w-3,y+3); ctx.lineTo(x+3,y+h-3); ctx.stroke();
          const armed = b.hp===1; const pulse = 0.4 + 0.6*(0.5+0.5*Math.sin(tNow*0.007 + (c*7+r*13))); const lx = x + w*0.82, ly = y + h*0.24; ctx.fillStyle = armed ? 'rgba(255,72,72,'+pulse+')' : 'rgba(255,208,92,'+pulse+')'; ctx.beginPath(); ctx.arc(lx,ly,3.2,0,Math.PI*2); ctx.fill(); if(armed){ ctx.strokeStyle='rgba(255,72,72,'+(0.15*pulse)+')'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(lx,ly,6,0,Math.PI*2); ctx.stroke(); }
          ctx.strokeStyle = armed ? '#ff4d4d' : '#ffd43b'; ctx.lineWidth=2; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1); ctx.restore();
        } else if(b.type==='clone'){
          ctx.save(); const x=b.x, y=b.y, w=brick.w, h=brick.h;
          let base = ctx.createLinearGradient(x,y,x+w,y+h); base.addColorStop(0,'#0f4c75'); base.addColorStop(1,'#1b9bd7'); ctx.fillStyle=base; ctx.fillRect(x,y,w,h);
          let bevel = ctx.createLinearGradient(x,y,x,y+h); bevel.addColorStop(0,'rgba(255,255,255,0.15)'); bevel.addColorStop(1,'rgba(0,0,0,0.18)'); ctx.fillStyle=bevel; ctx.fillRect(x,y,w,h);
          // icon: two small circles
          ctx.strokeStyle='rgba(240,248,255,0.95)'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.arc(x+w*0.38, y+h*0.56, 4, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(x+w*0.58, y+h*0.44, 4, 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1; ctx.strokeRect(x+0.5,y+0.5,w-1,h-1); ctx.restore();
        } else {
          const tex = getBrickTexture(rowColors[r % rowColors.length]); ctx.drawImage(tex, b.x, b.y, brick.w, brick.h);
        }
        if(b.flash>0){ const a=Math.min(1,b.flash/10)*0.35; ctx.fillStyle='rgba(255,255,255,'+a+')'; ctx.fillRect(b.x,b.y,brick.w,brick.h); b.flash*=0.82; if(b.flash<0.1) b.flash=0; }
      }
    }
  }

  function drawHUD(){
    ctx.font='16px system-ui,-apple-system,Segoe UI,Roboto,Arial'; ctx.textBaseline='top'; ctx.fillStyle='#cfd8e3';
    ctx.textAlign='left'; ctx.fillText('Score: '+score, 10, 10);
    ctx.fillText('High Score: '+getHighScore(), 10, 30);
    
    ctx.textAlign='center';
    if(balls.some(b=>b.boosted)){ ctx.fillStyle='#74c0fc'; ctx.fillText('BOOST!', W/2, 10); }
    ctx.fillStyle = saverCharges>0 ? '#ffd43b' : '#8b93a1';
    ctx.fillText('SAVER ×'+saverCharges, W/2, 28);
  }

  function showOverlay(message, opts={}){
    const {showScore=false, showHighScore=false, isNewHighScore=false, highScore=0} = opts;
    lastOverlay = {message, showScore, showHighScore, isNewHighScore, highScore};
    console.log('showOverlay called with:', {message, showScore, showHighScore, isNewHighScore, highScore});
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='bold 28px system-ui,-apple-system,Segoe UI,Roboto,Arial';
    ctx.fillText(message, W/2 + 15, H/2 - 20);
    if(showScore){
      ctx.font='16px system-ui,-apple-system,Segoe UI,Roboto,Arial';
      ctx.fillText('Score: '+score, W/2, H/2 + 5);
      if(showHighScore && isNewHighScore){
        console.log('Drawing NEW HIGH SCORE message');
        ctx.fillStyle = '#ffd43b';
        ctx.fillText('New high score!', W/2, H/2 + 25);
        ctx.fillStyle = '#fff';
      }
      ctx.fillText('Press Space or Enter to play again', W/2, H/2 + 45);
    }
    ctx.restore();
  }

  // ===== High Score Management =====
  function getHighScore(){
    const cookies = document.cookie.split(';');
    for(const cookie of cookies){
      const [name, value] = cookie.trim().split('=');
      if(name === 'breakout_high_score'){
        return parseInt(value) || 0;
      }
    }
    return 0;
  }

  function setHighScore(score){
    document.cookie = `breakout_high_score=${score};max-age=31536000;path=/`; // 1 year expiry
  }

  function clearHighScore(){
    document.cookie = 'breakout_high_score=;max-age=0;path=/';
  }
  
  // Make functions accessible globally for debugging
  window.clearHighScore = clearHighScore;
  window.setHighScore = setHighScore;
  window.getHighScore = getHighScore;

  function updateHighScore(){
    const currentHigh = getHighScore();
    console.log('Current score:', score, 'Current high score:', currentHigh);
    if(score > currentHigh){
      setHighScore(score);
      console.log('New high score set!');
      return true; // new high score
    }
    console.log('No new high score');
    return false; // no new high score
  }

  function showWinScreen(){
    paused = true;
    renderFrame();
    if(SFX && SFX.win) SFX.win();
    
    const isNewHighScore = updateHighScore();
    const highScore = getHighScore();
    
    console.log('Win screen - isNewHighScore:', isNewHighScore, 'highScore:', highScore);
    
    showOverlay('YOU WIN! 🎉', {showScore:true, showHighScore:true, isNewHighScore, highScore});
    // Don't wait for input - let the main Space handler restart the game
  }

  function endGameNow(){
    // Secret debug: instantly show the win screen with current score
    showWinScreen();
  }

  function remainingBricks(){
    let count=0; for(let c=0;c<brick.cols;c++) for(let r=0;r<brick.rows;r++) if(bricks[c][r].status===1) count++; return count;
  }

  // ===== Collisions (per ball) =====
  function collisionDetectionForBall(ballObj, dt){
    for(let c=0;c<brick.cols;c++){
      for(let r=0;r<brick.rows;r++){
        const br = bricks[c][r]; if(br.status!==1) continue;
        if( ballX > br.x-ballR && ballX < br.x+brick.w+ballR && ballY > br.y-ballR && ballY < br.y+brick.h+ballR ){
          // Create unique key for this brick to track frame hits
          const brickKey = `${c},${r}`;
          if(frameHitBricks.has(brickKey)) continue; // Skip if already hit this frame
          
          // Calculate previous position using actual movement (dt-based)
          const moveX = dx * (dt / 16.67), moveY = dy * (dt / 16.67);
          const prevX = ballX - moveX, prevY = ballY - moveY;
          const hitLeft = prevX <= br.x - ballR, hitRight = prevX >= br.x + brick.w + ballR, hitTop = prevY <= br.y - ballR, hitBottom = prevY >= br.y + brick.h + ballR;
          if((hitLeft && !hitTop && !hitBottom) || (hitRight && !hitTop && !hitBottom)) dx = -dx; else dy = -dy;
          
          // Mark this brick as hit this frame
          frameHitBricks.add(brickKey);
          
          br.hp = (br.hp||1) - 1; br.flash = 8;
          if(br.type==='bomb' && br.hp>0){ SFX.bombHit(); shake = Math.min(shake+8,14); continue; }
          if(br.hp<=0){
            br.status=0;
            // Combo scoring: add (combo * number of balls), then increment this ball's combo
            const gained = (ballObj.combo||1) * balls.length;
            score += gained;
            spawnFloater(br.x + brick.w/2, br.y + brick.h/2, gained, br.type);
            ballObj.combo = (ballObj.combo||1) + 1;

            if(br.type==='bomb'){
              const mult = 1.5; // keep in sync with UI text
              SFX.explosion();
              spawnExplosion(br.x + brick.w/2, br.y + brick.h/2, 1.2);
              activateBoostFor(ballObj, mult, 4000);
              shake = Math.min(shake+14,20);
            }
            else if(br.type==='clone'){ SFX.clone(); duplicateBallFrom(ballObj); shake = Math.min(shake+10,16); }
            else { SFX.brick(r); shake = Math.min(shake+6,12); }
            if(remainingBricks()===0){ showWinScreen(); }
          }
        }
      }
    }
  }

  // ===== Input step (once per frame) =====
  function stepPaddle(dt){
    const moveSpeed = paddle.speed * (dt / 16.67); // 16.67ms = 60fps
    if(rightPressed){ paddle.x += moveSpeed; if(paddle.x > W - paddle.w) paddle.x = W - paddle.w; }
    if(leftPressed){ paddle.x -= moveSpeed; if(paddle.x < 0) paddle.x = 0; }
  }

  // ===== Frame rendering =====
  function renderFrame(){
    ctx.clearRect(0,0,W,H);
    ctx.save();
    if(shake>0){ const ang=Math.random()*Math.PI*2; const s=shake; ctx.translate(Math.cos(ang)*s, Math.sin(ang)*s); shake*=0.88; if(shake<0.4) shake=0; }
    const gp = ensureGrainPattern(); if(gp){ ctx.save(); ctx.globalAlpha=0.06; ctx.fillStyle=gp; ctx.fillRect(0,0,W,H); ctx.restore(); }
    drawBricks();
    for(const b of balls){ useBall(b); curBoosted = !!b.boosted; drawBall(); }
    curBoosted = false;
    drawPaddle();
    // Floating score popups (shake with the world)
    drawFloaters();
    // Explosion particles (shake with the world)
    drawExplosions();
    ctx.restore();
    drawHUD();
  }

  // ===== Loop =====
  let lastTime = performance.now();
  function draw(){
    if(paused){
      renderFrame();
              if(lastOverlay && lastOverlay.message){
          showOverlay(lastOverlay.message, {
            showScore: lastOverlay.showScore,
            showHighScore: lastOverlay.showHighScore,
            isNewHighScore: lastOverlay.isNewHighScore,
            highScore: lastOverlay.highScore
          });
        } else {
          showOverlay(needsStart ? serveMessage : 'PAUSED – Press Space to resume');
        }
      return;
    }
    tNow = performance.now();
    const dt = Math.min(50, tNow - lastTime); // clamp to avoid big jumps
    lastTime = tNow;

    // Clear frame hit tracking for new frame
    frameHitBricks.clear();

    // move paddle ONCE per frame (not per ball)
    stepPaddle(dt);

    // update floaters
    updateFloaters(dt);
    
    // update explosions
    updateExplosions(dt);

    // update balls
    for(let i=balls.length-1; i>=0; i--){
      const b = balls[i];
      useBall(b);
      // Boost timing & decay per ball
      if(b.boosted){
        const now = performance.now();
        if(!b.boostDecay && now > b.boostUntil) b.boostDecay = true;
        if(b.boostDecay){
          const sp = Math.hypot(dx,dy);
          if(sp > b.returnSpeed*1.01){ dx*=0.98; dy*=0.98; }
          else {
            const s=Math.hypot(dx,dy); if(s!==0){ const kk=b.returnSpeed/s; dx*=kk; dy*=kk; }
            b.boosted=false; b.boostDecay=false; b.boostUntil=0;
          }
        }
      }
      // Collisions with bricks
      collisionDetectionForBall(b, dt);
      // Walls
      if(ballX+dx > W-ballR || ballX+dx < ballR){ dx=-dx; SFX.wall(); }
      if(ballY+dy < ballR){ dy=-dy; SFX.wall(); }
      // Paddle & bottom
      if(ballY+dy > paddle.y - ballR){
        if(ballX > paddle.x - ballR && ballX < paddle.x + paddle.w + ballR && dy > 0){
          const rel = (ballX - (paddle.x + paddle.w/2)) / (paddle.w/2);
          const speed = Math.hypot(dx,dy);
          onPaddleHit(b, rel, speed);
        } else if(ballY+dy > H - ballR){
          if(balls.length>1){
            onBallLost(ballX, ballY);
            // remove only this ball
            balls.splice(i,1);
            continue; // skip saving back
          } else {
            onBallLost(ballX, ballY);
            lastBallOut();
            continue; // skip saving back for this frame
          }
        }
      }

      // Apply ball motion
      ballX += dx * (dt / 16.67); ballY += dy * (dt / 16.67);
      ballSpin += ballSpinSpeed; if(ballSpin > Math.PI*2) ballSpin -= Math.PI*2; if(ballSpin < -Math.PI*2) ballSpin += Math.PI*2;
      ballSpinSpeed *= 0.995;
      saveBall(b);
    }

    // draw after updating state so boost/glow shows immediately
    renderFrame();

    requestAnimationFrame(draw);
  }

  // ===== Self‑tests (console) =====
  function runSelfTests(){
    try {
      // Snapshot bricks so tests can't leave one destroyed
      const bricksSnapshot = bricks.map(col=>col.map(b=>({status:b.status,type:b.type,hp:b.hp})));
      const expectedAlive = bricksSnapshot.reduce((n,col)=> n + col.reduce((m,s)=> m + (s.status===1?1:0),0), 0);
      // Silence sound + shake during tests
      const sfxBackup = {}; Object.keys(SFX).forEach(k=>{ sfxBackup[k] = SFX[k]; SFX[k] = function(){}; });
      const acWas = AC; // audio context should not auto-start
      const shakeBefore = shake; shake = 0; // ensure no visible shake during tests

      console.groupCollapsed('%cBreakout self‑tests','color:#7bd;');
      console.assert(!!ctx && typeof ctx.fillRect === 'function', 'Canvas context should exist');
      console.assert(currentTexture()==='rgb','Default texture should be rgb');
      console.assert(ballR>0 && brick.w>0 && brick.h>0, 'Dimensions should be positive');
      console.assert(bricks.length===brick.cols && bricks[0].length===brick.rows, 'Bricks grid size');
      console.assert(typeof draw === 'function' && typeof renderFrame === 'function', 'Main loop functions exist');
      console.assert(typeof SFX.wall === 'function' && typeof SFX.win === 'function', 'SFX functions exist');
      ensureGolfPatterns(); console.assert(!!golfPatternDark && !!golfPatternLight, 'Golf dimple patterns should be created');
      const beforeOp = ctx.globalCompositeOperation; drawBall(); console.assert(ctx.globalCompositeOperation === 'source-over', 'Composite op restored after drawBall');
      console.assert(paused === true && needsStart === true, 'Game should start paused and waiting for Space');
      const prevSpin=balls[0].spinSpeed; balls[0].spinSpeed=0; applyServeSpin(); console.assert(Math.abs(balls[0].spinSpeed)>0.001, 'applyServeSpin should prime spin on serve'); balls[0].spinSpeed=prevSpin;
      // Counts (randomized layout): 4 bombs, 4 clones, rest normal; bombs must be 2 HP
      let counts={bomb:0,clone:0,normal:0}, bombs2hp=true; for(let c=0;c<brick.cols;c++) for(let r=0;r<brick.rows;r++){ const t=bricks[c][r].type; counts[t]++; if(t==='bomb' && bricks[c][r].hp!==2) bombs2hp=false; }
      console.assert(counts.bomb===4 && counts.clone===4 && counts.normal===brick.cols*brick.rows-8, 'Randomized counts for bomb/clone/normal should be 4/4/rest');
      console.assert(bombs2hp, 'All bombs should start with 2 HP');
      // LED should be inside the bomb block (y + h*0.24), not at y*h*0.24
      { drawBricks(); let checked=false, ok=true; const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
        for(let c=0;c<brick.cols;c++){ for(let r=0;r<brick.rows;r++){ const br=bricks[c][r]; if(br.status===1 && br.type==='bomb'){
          const x = brick.offsetLeft + c*(brick.w + brick.padding);
          const y = brick.offsetTop  + r*(brick.h + brick.padding);
          const lx = x + brick.w*0.82, lyA = y + brick.h*0.24, lyB = y*brick.h*0.24;
          const sx = clamp(Math.round(lx),0,W-1), syA = clamp(Math.round(lyA),0,H-1), syB = clamp(Math.round(lyB),0,H-1);
          const pA = ctx.getImageData(sx, syA, 1, 1).data, pB = ctx.getImageData(sx, syB, 1, 1).data;
          const lum = (p)=>0.2126*p[0]+0.7152*p[1]+0.0722*p[2]; if(lum(pA) < lum(pB) + 5) ok=false; checked=true; break; }
        if(checked) break; } }
        console.assert(checked && ok, 'Bomb LED drawn at correct y (inside its brick)'); }
      // Ball split visibility sanity
      const oldTex = textureIndex; const splitIdx = TEXTURES.indexOf('split'); textureIndex = splitIdx>=0?splitIdx:0; renderFrame();
      const lx = Math.max(0, Math.min(W-1, Math.round(balls[0].x - ballR*0.5)));
      const rx = Math.max(0, Math.min(W-1, Math.round(balls[0].x + ballR*0.5)));
      const y  = Math.max(0, Math.min(H-1, Math.round(balls[0].y)));
      const pL = ctx.getImageData(lx, y, 1, 1).data; const pR = ctx.getImageData(rx, y, 1, 1).data; const lum = (p)=>0.2126*p[0]+0.7152*p[1]+0.0722*p[2]; console.assert(lum(pR) > lum(pL) + 20, 'Ball texture split should be visible (right brighter than left)');
      // Sports textures presence
      console.assert(TEXTURES.includes('golf') && TEXTURES.includes('basketball') && TEXTURES.includes('volleyball') && TEXTURES.includes('tennis'), 'Sports textures should exist');
      // Tennis center green dominance
      const tennisIdx = TEXTURES.indexOf('tennis'); if(tennisIdx>=0){ textureIndex = tennisIdx; renderFrame(); const pc = ctx.getImageData(Math.round(balls[0].x), Math.round(balls[0].y), 1, 1).data; console.assert(pc[1] > pc[0] + 15 && pc[1] > pc[2] + 15, 'Tennis center pixel should be green dominant'); }
      textureIndex = oldTex;
      // RGB sector verification
      const oldTexRGB = textureIndex; const rgbIdx = TEXTURES.indexOf('rgb'); if(rgbIdx>=0){ textureIndex = rgbIdx; renderFrame(); const samp = (ang)=>{ const x=Math.round(balls[0].x+Math.cos(ang)*ballR*0.6); const y=Math.round(balls[0].y+Math.sin(ang)*ballR*0.6); return ctx.getImageData(x,y,1,1).data; }; const rP = samp(0.0), gP = samp(2*Math.PI/3), bP = samp(4*Math.PI/3); const maxCh = (p)=>{ const a=[p[0],p[1],p[2]]; let m=0; if(a[1]>a[m]) m=1; if(a[2]>a[m]) m=2; return m; }; console.assert(maxCh(rP)===0 && maxCh(gP)===1 && maxCh(bP)===2, 'RGB sectors should be red/green/blue'); textureIndex = oldTexRGB; }
      // CLONE: duplicating adds ball with base-speed magnitude (random direction; no boost inherit)
      const n0 = balls.length; const ref = {...balls[0]};
      const baseSp = (ref.boosted && ref.returnSpeed) ? ref.returnSpeed : Math.hypot(ref.dx, ref.dy);
      duplicateBallFrom(balls[0]);
      console.assert(balls.length===n0+1, 'Duplicate should add a new ball');
      const last = balls[balls.length-1]; const lastSp = Math.hypot(last.dx,last.dy);
      console.assert(Math.abs(lastSp - baseSp) < Math.max(1e-3, 0.02*baseSp), 'Clone speed ≈ base speed (no boost)');
      console.assert(last.combo === ref.combo, 'Clone should inherit combo from source');
      // Inherited combo scoring: let clone immediately break a brick
      {
        const cloneBall = last;
        const prevCombo = cloneBall.combo || 1;
        const tInh = findNormal();
        if(tInh){
          const sStart = score;
          useBall(cloneBall); dx=0; dy=2;
          ballX = tInh.br.x + brick.w/2; ballY = tInh.br.y + brick.h/2;
          collisionDetectionForBall(cloneBall, 16.67); // Use default dt for tests
          const expectedGain = prevCombo * balls.length;
          console.assert(score === sStart + expectedGain, 'Clone should score inherited combo × balls');
          console.assert(cloneBall.combo === prevCombo + 1, 'Clone combo should increment after scoring');
        }
      }
      // Texture cycle
      const t0 = currentTexture(); cycleTexture(1); const t1 = currentTexture(); console.assert(t0!==t1 && TEXTURES.includes(t1), 'Texture cycle changes to a valid mode'); cycleTexture(-1); console.assert(currentTexture()===t0, 'Texture cycle backward restores previous');
      // Multiball removal when >1 ball
      const before = balls.length; if(before<2){ duplicateBallFrom(balls[0]); }
      const beforeLen = balls.length; balls.pop(); console.assert(balls.length === beforeLen-1, 'Removing one ball should reduce count by 1');
      // Paddle move should be independent of ball count
      const rp0 = rightPressed, lp0 = leftPressed; rightPressed = true; leftPressed = false;
      const px0 = paddle.x; stepPaddle(); const dx1 = paddle.x - px0;
      duplicateBallFrom(balls[0]); const px1 = paddle.x; stepPaddle(); const dx2 = paddle.x - px1;
      console.assert(Math.abs(dx1 - dx2) < 1e-9 && Math.abs(dx1 - 7) < 1e-9, 'Paddle speed should be constant and equal to 7 per step');
      rightPressed = rp0; leftPressed = lp0;
      // Paddle hit should deduct 1 point and spawn '-1' floater
      {
        while(balls.length>1) balls.pop();
        const b = balls[0];
        useBall(b);
        paddle.x = Math.max(0, Math.min(W-paddle.w, (W - paddle.w)/2));
        ballX = paddle.x + paddle.w/2; ballY = paddle.y - ballR - 1;
        dx = 0; dy = 2;
        const s0 = score; const f0 = floaters.length;
        onPaddleHit(b, 0, Math.hypot(dx,dy));
        console.assert(score === s0 - 1, 'Paddle hit should deduct 1 point');
        console.assert(floaters.length === f0 + 1 && floaters[floaters.length-1].txt === '-1', 'Penalty floater "-1" should spawn');
        console.assert(b.combo === 1, 'Paddle hit resets combo to 1');
      }

      // Ball-lost penalty: -10 points and floater
      {
        const s0 = score; const f0 = floaters.length;
        onBallLost(W/2, H-10);
        console.assert(score === s0 - 10, 'Ball lost deducts LOSS_PENALTY');
        console.assert(floaters.length === f0 + 1 && floaters[floaters.length-1].txt === '-10', 'Ball lost spawns "-10" floater');
      }
      // Multi-ball: losing one ball should apply penalty once and reduce ball count
      {
        while(balls.length>1) balls.pop();
        duplicateBallFrom(balls[0]);
        const beforeCount = balls.length;
        const s1 = score; const f1 = floaters.length;
        onBallLost(balls[0].x, H-10);
        balls.splice(0,1);
        console.assert(score === s1 - 10 && balls.length === beforeCount-1, 'Losing one ball applies -10 and removes one ball');
      }

      // Random serve direction: upward at start and after lastBallOut
      {
        let ok = true;
        for(let i=0;i<5;i++){
          initBallsSingle();
          const sp = Math.hypot(balls[0].dx, balls[0].dy);
          ok = ok && (balls[0].dy < -0.2) && (Math.abs(sp - Math.hypot(3,3)) < 0.05);
        }
        console.assert(ok, 'initBallsSingle serves upward with ~speed 4.24');
      }
      {
        paddle.x = 5; const keep = saverCharges; lastBallOut();
        console.assert(Math.abs(paddle.x - (W-paddle.w)/2) < 1e-6, 'Paddle recenters on lastBallOut');
        console.assert(balls.length===1 && paused===true && needsStart===true, 'lastBallOut pauses and waits to serve');
        console.assert(balls[0].dy < 0, 'Respawn ball dy should be upward');
        console.assert(saverCharges === keep, 'Saver charges unchanged on respawn');
      }

      // Boost should persist for triggering ball only
      while(balls.length>1) balls.pop();
      const b0 = balls[0]; useBall(b0); const sOld = Math.hypot(dx,dy); const mult=1.5; activateBoostFor(b0, mult, 1); saveBall(b0); const sNew = Math.hypot(b0.dx,b0.dy); console.assert(sNew > sOld*1.3, 'Boost should persist for boosted ball after saveBall');
      duplicateBallFrom(b0); const b1 = balls[1]; const s1 = Math.hypot(b1.dx,b1.dy); console.assert(Math.abs(s1 - b1.returnSpeed) < 1e-6, 'Clone should not inherit boost magnitude');
      // Non-trigger ball must not change when other ball boosts
      while(balls.length>1) balls.pop(); duplicateBallFrom(balls[0]); const a=balls[0], b=balls[1]; const sb0=Math.hypot(b.dx,b.dy); activateBoostFor(a,1.5,1); saveBall(a); console.assert(Math.abs(Math.hypot(b.dx,b.dy) - sb0) < 1e-6, 'Other ball speed unchanged by boost');
      // Bomb final hit should bounce and boost only triggering ball
      (function(){
        while(balls.length>1) balls.pop();
        // ensure positions are computed
        drawBricks();
        let target=null; for(let c=0;c<brick.cols;c++){ for(let r=0;r<brick.rows;r++){ const br=bricks[c][r]; if(br.status===1 && br.type==='bomb'){ target={c,r,br}; break; } } if(target) break; }
        if(target){
          useBall(balls[0]); dx=0; dy=2; // moving down onto the brick
          ballX = target.br.x + brick.w/2; ballY = target.br.y - ballR - 1; // above the brick
          const speedBefore = Math.hypot(dx,dy);
          target.br.hp = 1; // make this the final hit (explosion path)
          collisionDetectionForBall(balls[0], 16.67); // Use default dt for tests
          console.assert(dy < 0, 'Bomb final hit should bounce (dy inverted)');
          const speedAfter = Math.hypot(dx,dy);
          console.assert(speedAfter > speedBefore*1.2, 'Bomb explosion should increase speed of triggering ball');
        }
      })();

      // NEW: per‑ball combo scoring = combo * #balls
      // Ensure brick positions are computed
      drawBricks();
      function findNormal(){ for(let c=0;c<brick.cols;c++) for(let r=0;r<brick.rows;r++){ const br=bricks[c][r]; if(br.status===1 && br.type==='normal') return {c,r,br}; } return null; }
      // Single-ball scoring (combo starts at 1 ⇒ +1)
      while(balls.length>1) balls.pop();
      let t = findNormal(); if(t){ const s0=score; const f0=floaters.length; const b=balls[0]; b.combo=1; useBall(b); dx=0; dy=2; ballX=t.br.x+brick.w/2; ballY=t.br.y+brick.h/2; collisionDetectionForBall(b, 16.67); console.assert(score===s0+1, 'Score should increase by 1 (combo1×1 ball)'); console.assert(b.combo===2, 'Combo should increment to 2 after brick'); console.assert(floaters.length===f0+1 && floaters[floaters.length-1].txt==='+1','Floater +1 should spawn on score'); t.br.status=1; t.br.hp=1; }
      // Two-ball scoring with same ball (combo now 2 ⇒ +4)
      duplicateBallFrom(balls[0]); t = findNormal(); if(t){ const s1=score; const f1=floaters.length; const b=balls[0]; useBall(b); dx=0; dy=2; ballX=t.br.x+brick.w/2; ballY=t.br.y+brick.h/2; collisionDetectionForBall(b, 16.67); console.assert(score===s1+4, 'Score should increase by 4 (combo2×2 balls)'); console.assert(b.combo===3, 'Combo should increment to 3 after second brick'); console.assert(floaters.length===f1+1 && floaters[floaters.length-1].txt==='+4','Floater +4 should spawn on score'); t.br.status=1; t.br.hp=1; }

      // BallSaver tests: 3 charges per game, persist across life, reset on full reset
      while(balls.length<2) duplicateBallFrom(balls[0]);
      balls[0].dy = 2; balls[1].dy = -2;
      saverCharges = SAVER_MAX;
      const c0 = saverCharges;
      const fired1 = activateBallSaver();
      console.assert(fired1 === true && balls[0].dy < 0, 'BallSaver flips downward balls');
      console.assert(saverCharges === c0-1, 'BallSaver decrements charges by 1');
      // use again when a ball is falling
      balls[0].dy = 2; const fired2 = activateBallSaver();
      console.assert(fired2 === true && saverCharges === c0-2, 'BallSaver second use decrements again');
      // no falling balls shouldn't consume a charge
      balls[0].dy = -1; balls[1].dy = -1; const firedNo = activateBallSaver();
      console.assert(firedNo === false && saverCharges === c0-2, 'No charge consumed when nothing to flip');
      // respawn should NOT reset charges
      const keepCharges = saverCharges; lastBallOut();
      console.assert(saverCharges === keepCharges, 'Saver charges persist after respawn');
      console.assert(paused === true && needsStart === true, 'Respawn should pause and wait to serve');
      // full reset should restore charges
      resetLevel(true);
      console.assert(saverCharges === SAVER_MAX, 'Full reset restores saver charges to max');
      // Restart via function (simulating global Enter)
      score = 123; balls.length = 0; initBallsSingle(); saverCharges = 1; paused = false; needsStart = false; floaters.length = 0; shake = 5;
      restartGame();
      console.assert(paused === true && needsStart === true, 'Restart should pause and wait to serve');
      console.assert(score === 0, 'Restart resets score');
      console.assert(balls.length === 1, 'Restart leaves a single ball');
      console.assert(saverCharges === SAVER_MAX, 'Restart restores saver charges');
      // Debug end screen should pause and display score without changing it
      const originalHighScore = getHighScore();
      score = 4321; lastOverlay = {message:'',showScore:false}; paused = false; endGameNow();
      console.assert(paused === true, 'endGameNow should pause the game');
      console.assert(lastOverlay && lastOverlay.showScore === true, 'End screen should show score line');
      console.assert(/YOU WIN/.test(lastOverlay.message), 'End screen message should indicate win');
      console.assert(score === 4321, 'endGameNow must not change the score');
      // Restore original high score after test
      setHighScore(originalHighScore);
      let aliveAfter = 0; for(let c=0;c<brick.cols;c++) for(let r=0;r<brick.rows;r++) if(bricks[c][r].status===1) aliveAfter++;
      console.assert(aliveAfter === brick.cols*brick.rows, 'Restart re-randomizes full grid of bricks');

      // Restore bricks to snapshot (prevent missing block on first run)
      for(let c=0;c<brick.cols;c++){
        for(let r=0;r<brick.rows;r++){
          const s = bricksSnapshot[c][r]; const b = bricks[c][r];
          b.status = s.status; b.type = s.type; b.hp = s.hp; b.flash = 0;
        }
      }
      let alive=0; for(let c=0;c<brick.cols;c++) for(let r=0;r<brick.rows;r++) if(bricks[c][r].status===1) alive++;
      console.assert(alive===expectedAlive, 'Bricks restored after tests');

      // === CLEANUP: tests must not alter gameplay state ===
      while(balls.length > 1) balls.pop();
      if(balls.length === 0) initBallsSingle();
      paused = true; needsStart = true; score = 0; lastOverlay = {message:'',showScore:false}; serveMessage='Press Space to start';
      console.assert(balls.length === 1 && paused && needsStart && score === 0, 'Post-test cleanup: single ball, waiting to start, score 0');

      // Restore SFX and shake; ensure audio context didn't auto-create
      Object.keys(sfxBackup).forEach(k=> SFX[k] = sfxBackup[k]);
      shake = 0;
      floaters.length = 0; // 🔧 ensure tests don't leave any on-screen score popups
      console.assert(AC === acWas, 'Audio should not auto-start during tests');
      console.assert(shake === 0, 'No residual shake after tests');
      console.assert(floaters.length === 0, 'No residual score popups after tests');

      // Test high score functionality
      const testHighScore = getHighScore();
      setHighScore(1000);
      console.assert(getHighScore() === 1000, 'High score should be set to 1000');
      setHighScore(testHighScore); // restore original
      console.assert(getHighScore() === testHighScore, 'High score should be restored');

      console.log('All tests passed.');
      console.groupEnd();
    } catch (e) { console.error('Self‑tests failed:', e); }
  }

  // Kick off
  runSelfTests();
  requestAnimationFrame(draw);
})();
