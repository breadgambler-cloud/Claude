/* ==========================================================================
   OUTLINE — a pixel-art boss rush
   --------------------------------------------------------------------------
   You are a black circle with a red outline. Fight a gauntlet of geometric
   bosses, each a black shape with a thick neon outline and its own attacks.
   Collect coins + XP, spend them in the shop between fights.

   Everything renders to a 240x240 canvas that CSS scales up with crisp
   pixels, giving the chunky low-res look. No external assets or libraries.
   ========================================================================== */

'use strict';

/* ------------------------------------------------------------------ *
 * Canvas + constants
 * ------------------------------------------------------------------ */
const W = 240, H = 240;                 // internal (low-res) resolution
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const PAL = {
  bg1:'#0a0a12', bg2:'#101024', grid:'#161632',
  player:'#000000', playerLine:'#ff3b46',
  coin:'#ffd23f', xp:'#3fe0ff', ink:'#e8e8f0', dim:'#7a7a9a',
  danger:'#ff3b46', warn:'#ffae2b'
};

/* ------------------------------------------------------------------ *
 * Small math helpers
 * ------------------------------------------------------------------ */
const rand  = (a=1,b=0)=> b + Math.random()*(a-b);
const randi = (a,b)=> Math.floor(rand(a,b));
const clamp = (v,a,b)=> v<a?a:v>b?b:v;
const lerp  = (a,b,t)=> a+(b-a)*t;
const dist2 = (ax,ay,bx,by)=>{ const dx=ax-bx,dy=ay-by; return dx*dx+dy*dy; };
const dist  = (ax,ay,bx,by)=> Math.hypot(ax-bx, ay-by);
const angTo = (ax,ay,bx,by)=> Math.atan2(by-ay, bx-ax);
const TAU = Math.PI*2;

/* Shortest distance from point P to segment A-B (used for laser hits) */
function distToSeg(px,py, ax,ay, bx,by){
  const dx=bx-ax, dy=by-ay;
  const l2 = dx*dx+dy*dy || 1e-6;
  let t = ((px-ax)*dx + (py-ay)*dy)/l2;
  t = clamp(t,0,1);
  return Math.hypot(px-(ax+dx*t), py-(ay+dy*t));
}

/* ------------------------------------------------------------------ *
 * Tiny WebAudio blip engine (square-wave arcade sounds)
 * ------------------------------------------------------------------ */
const Sfx = (()=>{
  let ac=null, muted=false;
  const ensure = ()=>{ if(!ac){ try{ ac=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return ac; };
  function blip(freq=440, dur=0.06, type='square', vol=0.06, slide=0){
    if(muted) return; const a=ensure(); if(!a) return;
    const o=a.createOscillator(), g=a.createGain();
    o.type=type; o.frequency.setValueAtTime(freq, a.currentTime);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide), a.currentTime+dur);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime+dur);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime+dur);
  }
  return {
    shoot:()=>blip(660,0.05,'square',0.03,-260),
    hit:()=>blip(200,0.05,'square',0.04,-80),
    coin:()=>blip(880,0.07,'triangle',0.05,220),
    xp:()=>blip(520,0.06,'sine',0.04,180),
    hurt:()=>blip(120,0.18,'sawtooth',0.08,-60),
    boss:()=>blip(70,0.4,'sawtooth',0.1,-20),
    boom:()=>{ blip(90,0.3,'sawtooth',0.1,-40); blip(200,0.25,'square',0.05,-120); },
    level:()=>{ blip(600,0.08,'square',0.05,120); setTimeout(()=>blip(900,0.1,'square',0.05,140),70); },
    toggle:()=>{ muted=!muted; return muted; },
    isMuted:()=>muted
  };
})();

/* ------------------------------------------------------------------ *
 * Input
 * ------------------------------------------------------------------ */
const keys = {};
const mouse = { x:W/2, y:H/2, down:false };

addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  keys[k]=true;
  if(k==='m'){ const m=Sfx.toggle(); }
  if(k==='p' && (game.state==='play'||game.state==='paused')) togglePause();
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });

function canvasPos(clientX, clientY){
  const r = canvas.getBoundingClientRect();
  return {
    x: clamp((clientX-r.left)/r.width  * W, 0, W),
    y: clamp((clientY-r.top )/r.height * H, 0, H)
  };
}
canvas.addEventListener('mousemove', e=>{ const p=canvasPos(e.clientX,e.clientY); mouse.x=p.x; mouse.y=p.y; });
canvas.addEventListener('mousedown', e=>{ e.preventDefault(); mouse.down=true; });
addEventListener('mouseup', ()=>{ mouse.down=false; });
/* touch: drag to move & aim, tap to fire */
canvas.addEventListener('touchstart', e=>{ e.preventDefault(); const t=e.touches[0]; const p=canvasPos(t.clientX,t.clientY); mouse.x=p.x; mouse.y=p.y; mouse.down=true; }, {passive:false});
canvas.addEventListener('touchmove',  e=>{ e.preventDefault(); const t=e.touches[0]; const p=canvasPos(t.clientX,t.clientY); mouse.x=p.x; mouse.y=p.y; }, {passive:false});
canvas.addEventListener('touchend',   e=>{ e.preventDefault(); mouse.down=false; }, {passive:false});

/* ------------------------------------------------------------------ *
 * Global game state
 * ------------------------------------------------------------------ */
const game = {
  state:'menu',        // menu | play | shop | ending | paused
  bossIndex:0,
  time:0,
  shake:0,
  slowmo:0,            // brief hit-stop timer
  deathTimer:0,        // celebration delay after a boss dies
  flash:0              // full-screen flash amount
};

/* Entity pools */
let eBullets = [];   // enemy bullets
let pBullets = [];   // player bullets
let minions  = [];
let pickups  = [];
let particles= [];
let beams    = [];   // lasers (telegraph + active)
let boss     = null;

/* ------------------------------------------------------------------ *
 * Player
 * ------------------------------------------------------------------ */
const player = {
  x:W/2, y:H-40, r:5,
  speed:70, baseSpeed:70,
  hp:5, maxHp:5,
  damage:6,
  fireCd:0, fireBase:0.16,   // seconds between shots
  bulletSpeed:170,
  multishot:1, pierce:0,
  magnet:26,
  coins:0, xp:0, level:1, xpNext:14,
  invuln:0, aim:0
};

function resetPlayer(){
  player.x=W/2; player.y=H-40; player.r=5;
  player.speed=player.baseSpeed=70;
  player.hp=player.maxHp=5;
  player.damage=6;
  player.fireCd=0; player.fireBase=0.16;
  player.bulletSpeed=170;
  player.multishot=1; player.pierce=0;
  player.magnet=26;
  player.coins=0; player.xp=0; player.level=1; player.xpNext=14;
  player.invuln=0;
}

/* ------------------------------------------------------------------ *
 * Spawners
 * ------------------------------------------------------------------ */
function spawnEBullet(x,y,ang,spd,opts={}){
  eBullets.push({
    x,y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
    r:opts.r||2.5, color:opts.color||'#ff5a6e',
    homing:opts.homing||0, life:opts.life||8, spin:opts.spin||0, ang
  });
}
function spawnRadial(x,y,count,spd,offset=0,opts={}){
  for(let i=0;i<count;i++) spawnEBullet(x,y, offset + i*TAU/count, spd, opts);
}
function spawnPBullet(x,y,ang){
  pBullets.push({
    x,y, vx:Math.cos(ang)*player.bulletSpeed, vy:Math.sin(ang)*player.bulletSpeed,
    r:2.6, dmg:player.damage, pierce:player.pierce, life:2.2
  });
}
function spawnMinion(x,y,type='chaser'){
  const base = { x,y, r:5, hp:6+game.bossIndex*2, type, t:rand(TAU), fireCd:rand(1.4,0.6), vx:0, vy:0 };
  minions.push(base);
}
function spawnPickup(x,y,kind){ // kind: 'coin' | 'xp'
  pickups.push({ x,y, kind, vx:rand(30,-30), vy:rand(-10,-40), r:kind==='coin'?2.5:2.2, life:14, t:rand(TAU) });
}
function dropLoot(x,y, coins=1, xp=1){
  for(let i=0;i<coins;i++) spawnPickup(x+rand(4,-4), y+rand(4,-4), 'coin');
  for(let i=0;i<xp;i++)    spawnPickup(x+rand(4,-4), y+rand(4,-4), 'xp');
}
function burst(x,y,color,n=10,spd=90){
  for(let i=0;i<n;i++){
    const a=rand(TAU), s=rand(spd,spd*0.2);
    particles.push({ x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:rand(0.6,0.25), max:0.6, color, r:rand(2.5,1) });
  }
}
function spawnBeam(x,y,ang,opts={}){
  beams.push({
    x,y, ang, len:opts.len||300, width:opts.width||3,
    tele:opts.tele!==undefined?opts.tele:0.8, active:opts.active||0.5,
    t:0, follow:opts.follow||null, rot:opts.rot||0, color:opts.color||'#ff3b46'
  });
}

/* ------------------------------------------------------------------ *
 * BOSSES
 * Each boss: black shape, thick colored outline, unique attack set.
 * makeBoss returns an object with an update(dt) that runs a simple
 * attack scheduler + phase escalation at 50% HP.
 * ------------------------------------------------------------------ */
const BOSS_DEFS = [
  { name:'ORB',      shape:'circle',   color:'#ff3b46', hp:130, r:15, rotSpeed:0.6 },
  { name:'BLOCK',    shape:'square',   color:'#4dff88', hp:210, r:16, rotSpeed:0.4 },
  { name:'DELTA',    shape:'triangle', color:'#ffd23f', hp:280, r:16, rotSpeed:1.2 },
  { name:'PRISM',    shape:'pentagon', color:'#b06bff', hp:360, r:17, rotSpeed:0.9 },
  { name:'NOVA',     shape:'star',     color:'#ff8a2b', hp:520, r:18, rotSpeed:1.4 }
];

function makeBoss(index){
  const d = BOSS_DEFS[index];
  const b = {
    def:d, name:d.name, shape:d.shape, color:d.color,
    x:W/2, y:56, r:d.r, hp:d.hp, maxHp:d.hp,
    rot:0, rotSpeed:d.rotSpeed,
    t:0, homeX:W/2, moveT:rand(TAU),
    attack:null, attackClock:0, attackList:[], ai:0,
    acc:{}, phase:1, hitFlash:0,
    // per-boss scratch
    dashVX:0, dashVY:0, dashT:0
  };

  /* helper: run fn every `interval` seconds, keyed */
  b.every = (dt,key,interval,fn)=>{
    b.acc[key]=(b.acc[key]||0)+dt;
    if(b.acc[key]>=interval){ b.acc[key]-=interval; fn(); }
  };

  // attack pools per boss ----------------------------------------------------
  if(index===0){ // ORB — bullet hell + summons
    b.attackList = ['ring','spiral','summon','ring'];
  } else if(index===1){ // BLOCK — lasers, slams, bouncers
    b.attackList = ['cross','slam','bouncers','sweep'];
  } else if(index===2){ // DELTA — dashes + spreads + spinners
    b.attackList = ['dash','spread','spinners','dash'];
  } else if(index===3){ // PRISM — orbiting shield, vertex beams, homing
    b.attackList = ['orbit','vertexBeam','homing','orbit'];
  } else { // NOVA — final, combines everything in phases
    b.attackList = ['flower','beams','summon','homing','ring'];
  }

  b.pickNext = ()=>{
    b.ai = (b.ai+1) % b.attackList.length;
    b.attack = b.attackList[b.ai];
    b.acc = {};                      // reset sub-timers
    // durations per attack
    const durs = {
      ring:2.4, spiral:2.6, summon:1.6, cross:2.6, slam:2.4, bouncers:1.6, sweep:3.0,
      dash:2.2, spread:2.4, spinners:2.4, orbit:3.2, vertexBeam:2.8, homing:2.4,
      flower:2.8, beams:3.0
    };
    b.attackClock = (durs[b.attack]||2.4) / (b.phase===2?1.25:1);
  };

  b.runAttack = (dt)=>{
    const spdM = b.phase===2 ? 1.2 : 1;   // phase-2 bullets faster
    switch(b.attack){
      /* ---- ORB ---- */
      case 'ring':
        b.every(dt,'r',0.42,()=> spawnRadial(b.x,b.y, 12+index*2, 55*spdM, b.rot, {color:b.color}));
        break;
      case 'spiral':
        b.every(dt,'s',0.05,()=>{
          const a = b.t*4.5;
          spawnEBullet(b.x,b.y, a, 60*spdM, {color:b.color});
          spawnEBullet(b.x,b.y, a+Math.PI, 60*spdM, {color:b.color});
        });
        break;
      case 'summon':
        b.every(dt,'m',0.5,()=>{ if(minions.length<6){ spawnMinion(b.x+rand(30,-30), b.y+rand(20,10)); Sfx.hit(); }});
        break;
      /* ---- BLOCK ---- */
      case 'cross': // four rotating lasers from the block
        b.every(dt,'c',1.3,()=>{
          for(let i=0;i<4;i++) spawnBeam(b.x,b.y, b.rot+i*Math.PI/2, {len:340,width:3,tele:0.7,active:0.5,rot:0.6,color:b.color});
        });
        break;
      case 'slam': // shockwave rings after a telegraph
        b.every(dt,'sl',1.1,()=>{ spawnRadial(b.x,b.y,20,70*spdM,rand(TAU),{color:b.color,r:2.5}); Sfx.boom(); game.shake=4; });
        break;
      case 'bouncers':
        b.every(dt,'bc',0.4,()=>{ if(minions.length<7) spawnMinion(b.x+rand(20,-20), b.y+10, 'bouncer'); });
        break;
      case 'sweep': // aimed spreads that track the player
        b.every(dt,'sw',0.5,()=>{ const a=angTo(b.x,b.y,player.x,player.y); for(let i=-2;i<=2;i++) spawnEBullet(b.x,b.y,a+i*0.16,80*spdM,{color:b.color}); });
        break;
      /* ---- DELTA ---- */
      case 'dash': // charge at player leaving a bullet trail
        if(b.dashT<=0){
          const a=angTo(b.x,b.y,player.x,player.y);
          b.dashVX=Math.cos(a)*130; b.dashVY=Math.sin(a)*130; b.dashT=0.5; Sfx.boss();
        }
        break;
      case 'spread':
        b.every(dt,'sp',0.55,()=>{ const a=angTo(b.x,b.y,player.x,player.y); for(let i=-3;i<=3;i++) spawnEBullet(b.x,b.y,a+i*0.14,72*spdM,{color:b.color}); });
        break;
      case 'spinners': // spinning arms of bullets
        b.every(dt,'spn',0.07,()=>{ const a=b.t*3; for(let i=0;i<3;i++) spawnEBullet(b.x,b.y,a+i*TAU/3,58*spdM,{color:b.color}); });
        break;
      /* ---- PRISM ---- */
      case 'orbit': { // ring of bullets orbits, then flings outward
        b.every(dt,'ob',1.4,()=>{
          const n=14; const R=34;
          for(let i=0;i<n;i++){ const a=b.rot+i*TAU/n;
            const bx=b.x+Math.cos(a)*R, by=b.y+Math.sin(a)*R;
            spawnEBullet(bx,by, a, 70*spdM, {color:b.color, r:2.5});
          }
        });
        break; }
      case 'vertexBeam': // beams from the 5 vertices
        b.every(dt,'vb',1.5,()=>{ for(let i=0;i<5;i++) spawnBeam(b.x,b.y, b.rot+i*TAU/5, {len:320,width:2.5,tele:0.7,active:0.6,color:b.color}); });
        break;
      case 'homing':
        b.every(dt,'hm',0.5,()=>{ for(let i=0;i<3;i++) spawnEBullet(b.x,b.y, rand(TAU), 40*spdM, {color:b.color, homing:1.6, r:2.6}); });
        break;
      /* ---- NOVA (final) ---- */
      case 'flower':
        b.every(dt,'fl',0.3,()=>{ const petals=8; const a0=b.t*2; for(let i=0;i<petals;i++){ const a=a0+i*TAU/petals; for(let j=0;j<3;j++) spawnEBullet(b.x,b.y,a+j*0.12-0.12,50+j*18,{color:b.color}); }});
        break;
      case 'beams':
        b.every(dt,'bm',1.2,()=>{ for(let i=0;i<6;i++) spawnBeam(b.x,b.y,b.rot+i*TAU/6,{len:340,width:2.5,tele:0.6,active:0.6,rot:0.9,color:b.color}); });
        break;
    }

    /* dash physics (DELTA / used when dashing) */
    if(b.dashT>0){
      b.dashT-=dt;
      b.x+=b.dashVX*dt; b.y+=b.dashVY*dt;
      b.every(dt,'trail',0.05,()=> spawnEBullet(b.x,b.y, rand(TAU), 35*spdM, {color:b.color, r:2}));
      // bounce off walls
      if(b.x<20||b.x>W-20) b.dashVX*=-1;
      if(b.y<24||b.y>H-60) b.dashVY*=-1;
      b.x=clamp(b.x,20,W-20); b.y=clamp(b.y,24,H-60);
    }
  };

  b.update = (dt)=>{
    b.t += dt;
    b.rot += b.rotSpeed*dt;
    if(b.hitFlash>0) b.hitFlash-=dt;

    // phase change at 50% HP
    if(b.phase===1 && b.hp <= b.maxHp*0.5){ b.phase=2; b.rotSpeed*=1.4; game.flash=0.4; Sfx.boss(); }

    // idle drift when not dashing
    if(b.dashT<=0){
      b.moveT+=dt;
      const targetX = W/2 + Math.sin(b.moveT*0.6)*60;
      const targetY = 52 + Math.sin(b.moveT*0.9)*10;
      b.x = lerp(b.x, targetX, 0.02);
      b.y = lerp(b.y, targetY, 0.02);
    }

    b.attackClock -= dt;
    if(b.attackClock<=0) b.pickNext();
    b.runAttack(dt);
  };

  b.pickNext();
  return b;
}

/* ------------------------------------------------------------------ *
 * Damage handling
 * ------------------------------------------------------------------ */
function damageBoss(amount){
  if(!boss) return;
  boss.hp -= amount; boss.hitFlash=0.06;
  if(rand()<0.10) spawnPickup(boss.x+rand(8,-8), boss.y+rand(8,-8), rand()<0.5?'coin':'xp');
  if(boss.hp<=0) killBoss();
}
function killBoss(){
  Sfx.boom(); game.shake=8; game.flash=0.6;
  burst(boss.x,boss.y, boss.color, 40, 140);
  // reward burst
  const c = 16 + game.bossIndex*8, x = 10 + game.bossIndex*4;
  dropLoot(boss.x, boss.y, c, x);
  boss=null;
  eBullets=[]; beams=[]; minions=[];
  game.deathTimer=1.6;   // let the player sweep up loot, then shop
}
function hurtPlayer(){
  if(player.invuln>0) return;
  player.hp-=1; player.invuln=1.1;
  game.shake=6; game.flash=0.5; Sfx.hurt();
  burst(player.x,player.y, PAL.playerLine, 14, 80);
  if(player.hp<=0) endGame(false);
}
function gainXp(n){
  player.xp+=n;
  while(player.xp>=player.xpNext){
    player.xp-=player.xpNext; player.level++;
    player.xpNext=Math.floor(player.xpNext*1.35);
    player.maxHp+=1; player.hp=Math.min(player.maxHp, player.hp+2);
    player.damage*=1.04;
    game.flash=0.35; Sfx.level();
    burst(player.x,player.y, PAL.xp, 16, 70);
  }
}

/* ------------------------------------------------------------------ *
 * Update loop
 * ------------------------------------------------------------------ */
function updatePlayer(dt){
  // movement
  let mx=0,my=0;
  if(keys['a']||keys['arrowleft'])  mx-=1;
  if(keys['d']||keys['arrowright']) mx+=1;
  if(keys['w']||keys['arrowup'])    my-=1;
  if(keys['s']||keys['arrowdown'])  my+=1;
  const len=Math.hypot(mx,my)||1;
  player.x = clamp(player.x + mx/len*player.speed*dt, player.r, W-player.r);
  player.y = clamp(player.y + my/len*player.speed*dt, player.r, H-player.r);

  player.aim = angTo(player.x,player.y, mouse.x,mouse.y);
  if(player.invuln>0) player.invuln-=dt;

  // shooting
  player.fireCd-=dt;
  if(mouse.down && player.fireCd<=0){
    const n=player.multishot, spread=0.14;
    const start = player.aim - (n-1)*spread/2;
    for(let i=0;i<n;i++) spawnPBullet(player.x,player.y, start+i*spread);
    player.fireCd = player.fireBase;
    Sfx.shoot();
  }
}

function updateBullets(dt){
  // player bullets
  for(let i=pBullets.length-1;i>=0;i--){
    const b=pBullets[i];
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    let dead = b.life<=0 || b.x<-4||b.x>W+4||b.y<-4||b.y>H+4;
    if(!dead && boss && dist2(b.x,b.y,boss.x,boss.y) < (boss.r+b.r)**2){
      damageBoss(b.dmg); burst(b.x,b.y,'#ffffff',3,50);
      if(b.pierce>0) b.pierce--; else dead=true;
    }
    if(!dead){ // vs minions
      for(let m=minions.length-1;m>=0;m--){
        const mn=minions[m];
        if(dist2(b.x,b.y,mn.x,mn.y) < (mn.r+b.r)**2){
          mn.hp-=b.dmg; burst(b.x,b.y,'#ffffff',3,50);
          if(mn.hp<=0){ dropLoot(mn.x,mn.y, rand()<0.7?1:0, rand()<0.6?1:0); burst(mn.x,mn.y,'#ffffff',8,70); minions.splice(m,1); Sfx.hit(); }
          if(b.pierce>0) b.pierce--; else dead=true;
          break;
        }
      }
    }
    if(dead) pBullets.splice(i,1);
  }

  // enemy bullets
  for(let i=eBullets.length-1;i>=0;i--){
    const b=eBullets[i];
    if(b.homing){ // steer toward player
      const desired=angTo(b.x,b.y,player.x,player.y);
      const cur=Math.atan2(b.vy,b.vx);
      let d=((desired-cur+Math.PI*3)%TAU)-Math.PI;
      const na=cur+clamp(d,-b.homing*dt, b.homing*dt);
      const s=Math.hypot(b.vx,b.vy);
      b.vx=Math.cos(na)*s; b.vy=Math.sin(na)*s;
    }
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(dist2(b.x,b.y,player.x,player.y) < (player.r+b.r)**2){ hurtPlayer(); eBullets.splice(i,1); continue; }
    if(b.life<=0 || b.x<-6||b.x>W+6||b.y<-6||b.y>H+6) eBullets.splice(i,1);
  }
}

function updateBeams(dt){
  for(let i=beams.length-1;i>=0;i--){
    const bm=beams[i];
    bm.t+=dt;
    if(bm.rot) bm.ang+=bm.rot*dt;
    if(boss){ bm.x=boss.x; bm.y=boss.y; } // beams originate from boss
    // active phase → damage along the segment
    if(bm.t>bm.tele && bm.t<bm.tele+bm.active){
      const ax=bm.x, ay=bm.y;
      const bx=bm.x+Math.cos(bm.ang)*bm.len, by=bm.y+Math.sin(bm.ang)*bm.len;
      if(distToSeg(player.x,player.y, ax,ay,bx,by) < bm.width/2+player.r) hurtPlayer();
    }
    if(bm.t>bm.tele+bm.active) beams.splice(i,1);
  }
}

function updateMinions(dt){
  for(let i=minions.length-1;i>=0;i--){
    const m=minions[i]; m.t+=dt;
    if(m.type==='bouncer'){
      if(m.vx===0&&m.vy===0){ const a=rand(TAU); m.vx=Math.cos(a)*60; m.vy=Math.sin(a)*60; }
      m.x+=m.vx*dt; m.y+=m.vy*dt;
      if(m.x<m.r||m.x>W-m.r){ m.vx*=-1; m.x=clamp(m.x,m.r,W-m.r);}
      if(m.y<20+m.r||m.y>H-m.r){ m.vy*=-1; m.y=clamp(m.y,20+m.r,H-m.r);}
    } else { // chaser
      const a=angTo(m.x,m.y,player.x,player.y);
      m.x+=Math.cos(a)*34*dt; m.y+=Math.sin(a)*34*dt;
      m.fireCd-=dt;
      if(m.fireCd<=0){ spawnEBullet(m.x,m.y,a,60,{color:'#ff9db0',r:2}); m.fireCd=rand(2.2,1.4); }
    }
    // contact damage
    if(dist2(m.x,m.y,player.x,player.y) < (player.r+m.r)**2) hurtPlayer();
  }
}

function updatePickups(dt){
  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i]; p.t+=dt; p.life-=dt;
    // gravity-ish settle then magnet toward player
    p.vy+=90*dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    p.vx*=0.9; p.vy*=0.9;
    p.x=clamp(p.x,4,W-4); p.y=clamp(p.y,20,H-4);
    const d=dist(p.x,p.y,player.x,player.y);
    if(d<player.magnet){ const a=angTo(p.x,p.y,player.x,player.y); const pull=180*(1-d/player.magnet)+40; p.x+=Math.cos(a)*pull*dt; p.y+=Math.sin(a)*pull*dt; }
    if(d<player.r+p.r+1){
      if(p.kind==='coin'){ player.coins+=1; Sfx.coin(); }
      else { gainXp(3); Sfx.xp(); }
      pickups.splice(i,1); continue;
    }
    if(p.life<=0) pickups.splice(i,1);
  }
}

function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.life-=dt;
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.92; p.vy*=0.92;
    if(p.life<=0) particles.splice(i,1);
  }
}

function updatePlay(dt){
  updatePlayer(dt);
  if(boss) boss.update(dt);
  updateBullets(dt);
  updateBeams(dt);
  updateMinions(dt);
  updatePickups(dt);
  updateParticles(dt);

  if(game.shake>0) game.shake=Math.max(0,game.shake-dt*20);
  if(game.flash>0) game.flash=Math.max(0,game.flash-dt*2);

  // boss-death celebration → open shop (or win) once loot settles
  if(!boss && game.deathTimer>0){
    game.deathTimer-=dt;
    if(game.deathTimer<=0){
      // vacuum any remaining pickups
      pickups.forEach(p=>{ if(p.kind==='coin') player.coins++; else gainXp(3); });
      pickups=[];
      if(game.bossIndex >= BOSS_DEFS.length-1) endGame(true);
      else openShop();
    }
  }
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */
function drawBackground(){
  ctx.fillStyle=PAL.bg1; ctx.fillRect(0,0,W,H);
  // subtle grid
  ctx.strokeStyle=PAL.grid; ctx.lineWidth=1;
  ctx.beginPath();
  for(let x=0;x<=W;x+=16){ ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,H); }
  for(let y=0;y<=H;y+=16){ ctx.moveTo(0,y+0.5); ctx.lineTo(W,y+0.5); }
  ctx.stroke();
}

function drawShape(x,y,r,rot,shape,color,fill='#000',lw=3){
  ctx.save(); ctx.translate(x,y); ctx.rotate(rot);
  ctx.fillStyle=fill; ctx.strokeStyle=color; ctx.lineWidth=lw; ctx.lineJoin='round';
  ctx.beginPath();
  if(shape==='circle'){ ctx.arc(0,0,r,0,TAU); }
  else if(shape==='square'){ ctx.rect(-r,-r,r*2,r*2); }
  else { // regular polygon or star
    let pts, inner=null;
    if(shape==='triangle') pts=3;
    else if(shape==='pentagon') pts=5;
    else if(shape==='star'){ pts=5; inner=r*0.45; }
    else pts=6;
    if(inner){
      for(let i=0;i<pts*2;i++){ const rr=i%2?inner:r; const a=-Math.PI/2 + i*Math.PI/pts; const px=Math.cos(a)*rr, py=Math.sin(a)*rr; i?ctx.lineTo(px,py):ctx.moveTo(px,py); }
    } else {
      for(let i=0;i<pts;i++){ const a=-Math.PI/2 + i*TAU/pts; const px=Math.cos(a)*r, py=Math.sin(a)*r; i?ctx.lineTo(px,py):ctx.moveTo(px,py); }
    }
    ctx.closePath();
  }
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawBeam(bm){
  const ax=bm.x, ay=bm.y;
  const bx=bm.x+Math.cos(bm.ang)*bm.len, by=bm.y+Math.sin(bm.ang)*bm.len;
  ctx.save(); ctx.lineCap='round';
  if(bm.t<bm.tele){ // telegraph — thin blinking line
    ctx.globalAlpha = 0.4+0.4*Math.abs(Math.sin(bm.t*30));
    ctx.strokeStyle=bm.color; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
  } else { // firing — thick beam with white core
    ctx.globalAlpha=1;
    ctx.strokeStyle=bm.color; ctx.lineWidth=bm.width;
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=Math.max(1,bm.width-2);
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
  }
  ctx.restore();
}

function drawDot(x,y,r,color){ ctx.fillStyle=color; ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill(); }

function drawHUD(){
  // player HP as small squares (top-left)
  for(let i=0;i<player.maxHp;i++){
    ctx.fillStyle = i<player.hp ? PAL.playerLine : '#3a1015';
    ctx.fillRect(4+i*7, 4, 5,5);
  }
  // coins + xp counters (top-left, 2nd row)
  ctx.font='7px "Courier New", monospace'; ctx.textBaseline='top';
  ctx.fillStyle=PAL.coin; ctx.fillText('◈'+player.coins, 4, 12);
  ctx.fillStyle=PAL.dim;  ctx.fillText('LV'+player.level, 40, 12);
  // xp bar (thin, top-left under counters)
  ctx.fillStyle='#152033'; ctx.fillRect(4,22,60,3);
  ctx.fillStyle=PAL.xp;    ctx.fillRect(4,22,60*clamp(player.xp/player.xpNext,0,1),3);

  // boss health bar (top center)
  if(boss){
    const bw=140, bx=(W-bw)/2, by=6;
    ctx.fillStyle='#000'; ctx.fillRect(bx-1,by-1,bw+2,7);
    ctx.fillStyle='#301018'; ctx.fillRect(bx,by,bw,5);
    ctx.fillStyle=boss.color; ctx.fillRect(bx,by,bw*clamp(boss.hp/boss.maxHp,0,1),5);
    ctx.fillStyle=PAL.ink; ctx.textAlign='center';
    ctx.fillText(boss.name+'  '+(game.bossIndex+1)+'/'+BOSS_DEFS.length, W/2, by+7);
    ctx.textAlign='left';
  }
  if(Sfx.isMuted()){ ctx.fillStyle=PAL.dim; ctx.fillText('MUTED', W-34, 4); }
}

function render(){
  ctx.save();
  if(game.shake>0){ ctx.translate(rand(game.shake,-game.shake), rand(game.shake,-game.shake)); }
  drawBackground();

  // beams under everything else so hazards read clearly
  beams.forEach(drawBeam);

  // pickups
  pickups.forEach(p=>{
    const pulse=1+0.2*Math.sin(p.t*8);
    if(p.kind==='coin'){ drawShape(p.x,p.y,p.r*pulse,p.t*2,'square',PAL.coin,'#7a5f00',1); }
    else drawDot(p.x,p.y,p.r*pulse,PAL.xp);
  });

  // minions (small black shapes w/ outline, matching boss theme)
  minions.forEach(m=>{
    const c = m.type==='bouncer' ? '#4dff88' : (boss?boss.color:'#ff5a6e');
    drawShape(m.x,m.y,m.r, m.t*(m.type==='bouncer'?3:1.5), m.type==='bouncer'?'square':'triangle', c,'#000',2);
  });

  // boss
  if(boss){
    const flashCol = boss.hitFlash>0 ? '#ffffff' : boss.color;
    drawShape(boss.x,boss.y,boss.r,boss.rot,boss.shape, flashCol,'#000',3.5);
  }

  // player (black circle, red outline) — blink while invulnerable
  if(!(player.invuln>0 && Math.floor(game.time*20)%2===0)){
    drawShape(player.x,player.y,player.r,0,'circle',PAL.playerLine,'#000',2.5);
    // aim tick
    ctx.strokeStyle=PAL.playerLine; ctx.lineWidth=1; ctx.beginPath();
    ctx.moveTo(player.x,player.y);
    ctx.lineTo(player.x+Math.cos(player.aim)*9, player.y+Math.sin(player.aim)*9);
    ctx.stroke();
  }

  // bullets
  pBullets.forEach(b=> drawDot(b.x,b.y,b.r,'#e8f6ff'));
  eBullets.forEach(b=> { drawDot(b.x,b.y,b.r+0.5,'#000'); drawDot(b.x,b.y,b.r,b.color); });

  // particles
  particles.forEach(p=>{ ctx.globalAlpha=clamp(p.life/p.max,0,1); drawDot(p.x,p.y,p.r,p.color); });
  ctx.globalAlpha=1;

  ctx.restore();

  drawHUD();

  // full-screen flash
  if(game.flash>0){ ctx.fillStyle=`rgba(255,255,255,${game.flash*0.4})`; ctx.fillRect(0,0,W,H); }
}

/* ------------------------------------------------------------------ *
 * Shop
 * ------------------------------------------------------------------ */
const UPGRADES = [
  { id:'dmg',   name:'DAMAGE +25%',   desc:'Hit harder.',            base:8,  mul:1.55, count:0, max:12, apply:p=> p.damage*=1.25 },
  { id:'fire',  name:'FIRE RATE +15%',desc:'Shoot faster.',          base:8,  mul:1.55, count:0, max:9,  apply:p=> p.fireBase*=0.87 },
  { id:'spd',   name:'MOVE SPD +12%', desc:'Dodge better.',          base:6,  mul:1.5,  count:0, max:6,  apply:p=>{ p.baseSpeed*=1.12; p.speed=p.baseSpeed; } },
  { id:'hp',    name:'MAX HP +1',     desc:'Take one more hit. Heals 1.', base:10, mul:1.6, count:0, max:8, apply:p=>{ p.maxHp+=1; p.hp=Math.min(p.maxHp,p.hp+1);} },
  { id:'multi', name:'MULTISHOT +1',  desc:'One more bullet per shot.',   base:16, mul:2.3, count:0, max:4, apply:p=> p.multishot+=1 },
  { id:'pierce',name:'PIERCE +1',     desc:'Bullets punch through.',      base:14, mul:2.1, count:0, max:4, apply:p=> p.pierce+=1 },
  { id:'blt',   name:'BULLET SPD +15%',desc:'Faster shots, less leading.',base:5,  mul:1.4, count:0, max:6, apply:p=> p.bulletSpeed*=1.15 },
  { id:'mag',   name:'MAGNET +40%',   desc:'Pull coins from farther.',    base:5,  mul:1.5, count:0, max:6, apply:p=> p.magnet*=1.4 },
  { id:'heal',  name:'REPAIR',        desc:'Restore 3 HP now.',           base:5,  mul:1.3, count:0, max:99,apply:p=> p.hp=Math.min(p.maxHp,p.hp+3) }
];
const costOf = u=> Math.floor(u.base * Math.pow(u.mul,u.count));

const el = id=>document.getElementById(id);

function renderShop(){
  el('shopCoins').textContent=player.coins;
  const list=el('shopList'); list.innerHTML='';
  UPGRADES.forEach(u=>{
    const maxed = u.count>=u.max;
    const cost = costOf(u);
    const cant = player.coins<cost;
    const div=document.createElement('div');
    div.className='shopItem'+(maxed?' maxed':'')+(cant&&!maxed?' cant':'');
    div.innerHTML=`<span class="name">${u.name}${u.max<50?` <small style="color:#7a7a9a">${u.count}/${u.max}</small>`:''}</span>`+
                  `<span class="desc">${u.desc}</span>`+
                  `<span class="cost">${maxed?'MAXED':'◈ '+cost}</span>`;
    if(!maxed) div.onclick=()=>{
      const c=costOf(u);
      if(player.coins>=c){ player.coins-=c; u.count++; u.apply(player); Sfx.coin(); renderShop(); }
      else { Sfx.hurt(); }
    };
    list.appendChild(div);
  });
}

function openShop(){
  game.state='shop';
  renderShop();
  el('shop').classList.remove('hidden');
}
function closeShopStartNext(){
  el('shop').classList.add('hidden');
  game.bossIndex++;
  startBossFight();
}

/* ------------------------------------------------------------------ *
 * State transitions
 * ------------------------------------------------------------------ */
function startBossFight(){
  eBullets=[]; pBullets=[]; minions=[]; pickups=[]; particles=[]; beams=[];
  boss = makeBoss(game.bossIndex);
  player.x=W/2; player.y=H-40; player.invuln=1.2;
  game.state='play'; game.deathTimer=0;
  Sfx.boss();
}

function startNewGame(){
  el('menu').classList.add('hidden');
  el('ending').classList.add('hidden');
  el('shop').classList.add('hidden');
  UPGRADES.forEach(u=>u.count=0);
  resetPlayer();
  game.bossIndex=0;
  startBossFight();
}

function endGame(won){
  game.state='ending';
  el('endTitle').textContent = won ? 'YOU WIN!' : 'GAME OVER';
  el('endTitle').style.color = won ? PAL.coin : PAL.playerLine;
  el('endSub').innerHTML = won
    ? `ALL ${BOSS_DEFS.length} BOSSES DOWN.<br>LEVEL ${player.level} · ◈${player.coins} BANKED`
    : `FELL TO <b style="color:${boss?boss.color:'#fff'}">${boss?boss.name:'?'}</b> · BOSS ${game.bossIndex+1}/${BOSS_DEFS.length}<br>LEVEL ${player.level} REACHED`;
  el('ending').classList.remove('hidden');
  if(won){ Sfx.level(); } else { Sfx.boom(); }
}

function togglePause(){
  if(game.state==='play'){ game.state='paused'; el('pause').classList.remove('hidden'); }
  else if(game.state==='paused'){ game.state='play'; el('pause').classList.add('hidden'); }
}

/* Buttons */
el('startBtn').onclick = startNewGame;
el('againBtn').onclick = startNewGame;
el('nextBtn').onclick  = closeShopStartNext;

/* ------------------------------------------------------------------ *
 * Main loop
 * ------------------------------------------------------------------ */
let last=performance.now();
function frame(now){
  let dt=(now-last)/1000; last=now;
  dt=Math.min(dt,0.05);            // clamp big frame gaps
  game.time+=dt;

  if(game.state==='play') updatePlay(dt);

  // always render the arena behind menus (except pure menu which is fully covered)
  if(game.state!=='menu') render();
  else { drawBackground(); }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
