import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const stage = document.getElementById('gameStage');
const loading = document.getElementById('loading');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const comboFill = document.getElementById('comboFill');
const toast = document.getElementById('toast');
const mood = document.getElementById('mood');
const soundToggle = document.getElementById('soundToggle');
let score = 0, combo = 1, lastAction = 0, soundOn = true, audioCtx;
let toastTimer, confetti = [], particles = [];
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x25294d, 9, 22);
const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
camera.position.set(0, 2.3, 9.6);
const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xcbdcff, 0x39305b, 2.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
keyLight.position.set(-3, 7, 6); keyLight.castShadow = true; scene.add(keyLight);
const rim = new THREE.PointLight(0xff579a, 65, 12); rim.position.set(3,3,-2); scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(5,64), new THREE.MeshStandardMaterial({color:0x343b70, roughness:.9}));
floor.rotation.x=-Math.PI/2; floor.position.y=-1.55; floor.receiveShadow=true; scene.add(floor);
const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05,.025,8,80),new THREE.MeshBasicMaterial({color:0x7e8bdf,transparent:true,opacity:.55}));
ring.rotation.x=Math.PI/2;ring.position.y=-1.53;scene.add(ring);

const character = new THREE.Group(); scene.add(character);
const skin = new THREE.MeshStandardMaterial({color:0x78b9c7,roughness:.55});
const shirt = new THREE.MeshStandardMaterial({color:0x187bd0,roughness:.7});
const dark = new THREE.MeshStandardMaterial({color:0x18213b,roughness:.8});
const jointMat = new THREE.MeshStandardMaterial({color:0x5b9aa9,roughness:.6});
function sphere(parent, name, pos, scale, mat) {
  const m=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),mat);
  m.name=name;m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function limb(name, a, b, radius, mat, parent=character) {
  const mid=new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5);
  const len=new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius*.78,radius,len,16),mat);
  mesh.name=name;mesh.position.copy(mid);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize());
  mesh.castShadow=true;parent.add(mesh);return mesh;
}
sphere(character,'torso',[0,-.05,0],[.78,.94,.43],shirt);
sphere(character,'neck',[0,.86,0],[.24,.27,.23],skin);
const head=sphere(character,'head',[0,1.62,0],[.78,.88,.62],skin);
// Face photo is placed on a curved-looking flat plane just in front of the head.
const faceGroup=new THREE.Group(); faceGroup.position.set(0,1.61,.535); character.add(faceGroup);
const loader=new THREE.TextureLoader();
loader.load('./assets/kanglunil-face.png', tex=>{
  tex.colorSpace=THREE.SRGBColorSpace;
  const face=new THREE.Mesh(new THREE.PlaneGeometry(1.17,1.42),new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.04,side:THREE.DoubleSide}));
  face.position.z=.025; face.scale.set(1,1,1); faceGroup.add(face);
},undefined,()=>{});
sphere(character,'earL',[-.75,1.58,0],[.19,.27,.16],skin);
sphere(character,'earR',[.75,1.58,0],[.19,.27,.16],skin);
const limbs={};
limbs.leftUpper=limb('leftUpper',[-.58,.5,0],[-1.12,-.1,.02],.17,shirt);
limbs.leftLower=limb('leftLower',[-1.12,-.1,.02],[-1.28,-.72,.12],.13,skin);
limbs.rightUpper=limb('rightUpper',[.58,.5,0],[1.12,-.1,.02],.17,shirt);
limbs.rightLower=limb('rightLower',[1.12,-.1,.02],[1.28,-.72,.12],.13,skin);
limbs.leftLeg=limb('leftLeg',[-.34,-.75,0],[-.4,-1.35,.03],.19,dark);
limbs.rightLeg=limb('rightLeg',[.34,-.75,0],[.4,-1.35,.03],.19,dark);
sphere(character,'leftShoe',[-.42,-1.42,.13],[.31,.14,.42],dark);
sphere(character,'rightShoe',[.42,-1.42,.13],[.31,.14,.42],dark);
sphere(character,'handL',[-1.29,-.76,.13],[.2,.2,.2],skin);
sphere(character,'handR',[1.29,-.76,.13],[.2,.2,.2],skin);
character.position.y=.08;

const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.5,40),new THREE.MeshBasicMaterial({color:0x070a20,transparent:true,opacity:.36}));
shadow.rotation.x=-Math.PI/2;shadow.position.set(0,-1.51,-.05);scene.add(shadow);

let targetRot=0, dragging=false, pointerX=0, baseRot=0, kickPower=0, wobble=0, bounce=0;
const clock=new THREE.Clock();
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage); resize();
renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;pointerX=e.clientX;baseRot=targetRot;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(dragging)targetRot=baseRot+(e.clientX-pointerX)*.008});
renderer.domElement.addEventListener('pointerup',()=>dragging=false);
renderer.domElement.addEventListener('pointercancel',()=>dragging=false);

function sound(type='tap'){
 if(!soundOn)return;
 try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);
 const now=audioCtx.currentTime;o.type=type==='kick'?'sawtooth':'sine';o.frequency.setValueAtTime(type==='kick'?170:type==='confetti'?620:330,now);o.frequency.exponentialRampToValueAtTime(type==='kick'?65:120,now+.18);g.gain.setValueAtTime(.11,now);g.gain.exponentialRampToValueAtTime(.001,now+.2);o.start(now);o.stop(now+.21);}catch(e){}
}
function showToast(text){toast.textContent=text;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),850);}
function addScore(points){const now=Date.now();combo=now-lastAction<2500?Math.min(8,combo+1):1;lastAction=now;score+=points*combo;scoreEl.textContent=String(score).padStart(5,'0');comboEl.textContent='x'+combo;comboFill.style.width=(combo/8*100)+'%';}
function makeBurst(count=18){for(let i=0;i<count;i++){const mat=new THREE.MeshBasicMaterial({color:[0xff5c9a,0xffd45b,0x50dcff,0x9c75ff,0x71f0b5][i%5]});const p=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,.07),mat);p.position.set((Math.random()-.5)*1.1,Math.random()*1.7,(Math.random()-.5)*.5);p.userData.vel=new THREE.Vector3((Math.random()-.5)*.12,Math.random()*.16+.04,(Math.random()-.5)*.08);scene.add(p);particles.push({mesh:p,life:1});}}
function doAction(type){
 const data={kick:[120,'MEGA BOING!','😵 MOOD: WOBBLY','kick'],boop:[55,'BOOP!','😳 MOOD: SURPRISED','tap'],jiggle:[85,'NOODLE MODE!','🫨 MOOD: JELLY','tap'],confetti:[100,'PARTY TIME!','🥳 MOOD: PARTY','confetti']}[type];
 addScore(data[0]);showToast(data[1]);mood.textContent=data[2];sound(data[3]);
 if(type==='kick'){bounce=1.05;wobble=1.2;kickPower=1.1;makeBurst(14)}
 if(type==='boop'){wobble=.7;kickPower=.28;makeBurst(5)}
 if(type==='jiggle'){wobble=1.8;kickPower=.5;makeBurst(9)}
 if(type==='confetti'){wobble=.35;makeBurst(65)}
}
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>doAction(b.dataset.action)));
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;const map={'1':'kick','2':'boop','3':'jiggle','4':'confetti'};if(map[e.key])doAction(map[e.key]);});
soundToggle.addEventListener('click',()=>{soundOn=!soundOn;soundToggle.textContent=soundOn?'🔊 SOUND ON':'🔇 SOUND OFF';soundToggle.setAttribute('aria-pressed',String(soundOn));});
document.getElementById('resetBtn').addEventListener('click',()=>{score=0;combo=1;lastAction=0;scoreEl.textContent='00000';comboEl.textContent='x1';comboFill.style.width='12.5%';wobble=bounce=kickPower=0;targetRot=0;mood.textContent='MOOD: CHILL 😎';showToast('FRESH START!');});

function animate(){
 requestAnimationFrame(animate);const t=clock.getElapsedTime(),dt=Math.min(clock.getDelta(),.04);
 character.rotation.y += (targetRot-character.rotation.y)*.07;
 const decay=Math.exp(-3.5*dt);wobble*=decay;bounce*=Math.exp(-4.5*dt);kickPower*=Math.exp(-5*dt);
 character.rotation.z=Math.sin(t*13)*wobble*.12;
 character.rotation.x=Math.sin(t*11)*wobble*.07;
 character.position.y=.08+Math.abs(Math.sin(t*9))*bounce*.55;
 character.scale.set(1+Math.sin(t*15)*wobble*.035,1-Math.sin(t*15)*wobble*.025,1);
 limbs.leftUpper.rotation.z=Math.sin(t*13)*wobble*.12;limbs.rightUpper.rotation.z=-Math.sin(t*13)*wobble*.12;
 ring.rotation.z=t*.12;
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.mesh.position.add(p.mesh.userData.vel);p.mesh.userData.vel.y-=.006;p.life-=dt*1.5;p.mesh.rotation.x+=.08;p.mesh.rotation.y+=.1;p.mesh.material.transparent=true;p.mesh.material.opacity=Math.max(0,p.life);if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();particles.splice(i,1)}}
 renderer.render(scene,camera);
}
animate();
setTimeout(()=>loading.style.display='none',900);
