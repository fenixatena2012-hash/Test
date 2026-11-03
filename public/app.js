const $ = s => document.querySelector(s);
let mode="login", token=localStorage.getItem("nv_token"), me=null, socket=null, players={}, game=null;
const authBox=$("#auth"), app=$("#app");
function setMode(m){mode=m;document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.mode===m));$("#authSubmit").textContent=m==="login"?"Entrar no universo":"Criar minha conta";$("#password").autocomplete=m==="login"?"current-password":"new-password";$("#authError").textContent=""}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
async function api(url,opts={}){const r=await fetch(url,{...opts,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{}),...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Erro na solicitação.");return d}
$("#authForm").onsubmit=async e=>{e.preventDefault();$("#authError").textContent="";const username=$("#username").value.trim(),password=$("#password").value;try{const d=await api("/api/"+mode,{method:"POST",body:JSON.stringify({username,password})});token=d.token;localStorage.setItem("nv_token",token);await boot()}catch(err){$("#authError").textContent=err.message}};
async function boot(){try{const d=await api("/api/me");me=d.user;authBox.classList.add("hidden");app.classList.remove("hidden");$("#sideName").textContent=me.username;$("#topName").textContent=me.username;$("#avatarName").textContent=me.username;$("#miniAvatar").textContent=me.username[0].toUpperCase();$("#topAvatar").textContent=me.username[0].toUpperCase();connect();loadFriends()}catch{token=null;localStorage.removeItem("nv_token");authBox.classList.remove("hidden");app.classList.add("hidden")}}
function showPage(name){document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));$("#page-"+name).classList.remove("hidden");document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===name));if(name==="friends")loadFriends()}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>showPage(b.dataset.goto));
$("#logout").onclick=()=>{if(socket)socket.disconnect();localStorage.removeItem("nv_token");location.reload()};
function connect(){if(socket)socket.disconnect();socket=io({auth:{token}});socket.on("connect",()=>{$("#gameStatus").textContent="Multiplayer conectado";});socket.on("connect_error",e=>{$("#gameStatus").textContent=e.message});socket.on("world:init",list=>{players={};list.forEach(p=>players[p.id]=p);updateCounts()});socket.on("player:join",p=>{players[p.id]=p;updateCounts()});socket.on("player:move",p=>{if(players[p.id])Object.assign(players[p.id],p)});socket.on("player:leave",p=>{delete players[p.id];updateCounts()})}
function updateCounts(){const n=Math.max(1,Object.keys(players).length);$("#onlineCount").textContent=n;$("#playersHere").textContent=n}
document.querySelectorAll("[data-play]").forEach(b=>b.onclick=()=>{if(b.dataset.play!=="obby"){alert("Essa experiência estará disponível em uma próxima atualização.");return}startGame()});
$("#backHome").onclick=()=>{stopGame();showPage("discover")};
let keys={left:false,right:false,jump:false};
function bindHold(id,key){const b=$(id);["pointerdown","touchstart"].forEach(ev=>b.addEventListener(ev,e=>{e.preventDefault();keys[key]=true}));["pointerup","pointercancel","pointerleave","touchend"].forEach(ev=>b.addEventListener(ev,e=>{e.preventDefault();keys[key]=false}))}
bindHold("#leftBtn","left");bindHold("#rightBtn","right");bindHold("#jumpBtn","jump");
window.addEventListener("keydown",e=>{if(["ArrowLeft","a","A"].includes(e.key))keys.left=true;if(["ArrowRight","d","D"].includes(e.key))keys.right=true;if([" ","ArrowUp","w","W"].includes(e.key))keys.jump=true});
window.addEventListener("keyup",e=>{if(["ArrowLeft","a","A"].includes(e.key))keys.left=false;if(["ArrowRight","d","D"].includes(e.key))keys.right=false;if([" ","ArrowUp","w","W"].includes(e.key))keys.jump=false});
const canvas=$("#gameCanvas"),ctx=canvas.getContext("2d");let raf=0,lastSend=0;
const platforms=[{x:0,y:340,w:270,h:80,c:"#6acb8b"},{x:320,y:295,w:130,h:22,c:"#ffc85b"},{x:500,y:245,w:130,h:22,c:"#ff8d9e"},{x:680,y:190,w:130,h:22,c:"#9b91ff"},{x:870,y:245,w:130,h:22,c:"#ffc85b"},{x:1060,y:185,w:140,h:22,c:"#ff8d9e"},{x:1270,y:135,w:140,h:22,c:"#8bd8ff"},{x:1490,y:185,w:180,h:22,c:"#6acb8b"},{x:1770,y:125,w:190,h:22,c:"#ffd66e"},{x:2050,y:190,w:230,h:30,c:"#8be0a0"}];
function startGame(){showPage("play");if(!socket||!socket.connected)connect();game={x:70,y:280,vx:0,vy:0,on:false,cam:0,checkpoint:70,won:false};resize();cancelAnimationFrame(raf);loop(0)}
function stopGame(){cancelAnimationFrame(raf);game=null;keys={left:false,right:false,jump:false}}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0)}
window.addEventListener("resize",()=>{if(game)resize()});
function loop(t){if(!game)return;const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle="#91dcf5";ctx.fillRect(0,0,w,h);
  // nuvens
  for(let i=0;i<7;i++){let x=((i*240-game.cam*.25)%(w+180)+w+180)%(w+180)-70;ctx.fillStyle="#ffffffaa";ctx.beginPath();ctx.arc(x,65+(i%3)*35,22,0,Math.PI*2);ctx.arc(x+25,58+(i%3)*35,28,0,Math.PI*2);ctx.arc(x+52,68+(i%3)*35,19,0,Math.PI*2);ctx.fill()}
  const groundY=h-55;ctx.fillStyle="#4fae78";ctx.fillRect(0,groundY,w,55);
  const scale=Math.min(w/900,1);ctx.save();ctx.translate(-game.cam,0);
  platforms.forEach(p=>{let x=p.x*.55*scale,y=groundY-(340-p.y)*.75*scale;let pw=p.w*.55*scale,ph=Math.max(13,p.h*.55*scale);ctx.fillStyle=p.c;ctx.fillRect(x,y,pw,ph);ctx.fillStyle="#ffffff55";ctx.fillRect(x,y,pw,4);ctx.fillStyle="#315b5b";ctx.fillRect(x,y+ph,pw,7)});
  // portal final
  const portalX=platforms[9].x*.55*scale+95;ctx.fillStyle="#5d4bc9";ctx.fillRect(portalX,groundY-145,42,90);ctx.fillStyle="#9fffe0";ctx.fillRect(portalX+9,groundY-134,24,68);
  // outros jogadores
  Object.values(players).filter(p=>String(p.id)!==String(me.id)).forEach(p=>drawBlock((p.x||0)*.55*scale,groundY-58-(p.y||0)*.3,p.color||"#ff9",p.username));
  const px=game.x*.55*scale, py=groundY-48-game.y*.3;drawBlock(px,py,"#ffbf68",me.username);
  ctx.restore();
  // física em coordenadas lógicas
  if(keys.left)game.vx=-3.3;else if(keys.right)game.vx=3.3;else game.vx*=.78;
  if(keys.jump&&game.on){game.vy=-10.8;game.on=false}
  game.vy+=.48;game.x+=game.vx;game.y-=game.vy;
  let landed=false;
  platforms.forEach(p=>{let top=340-p.y;if(game.x+25>p.x&&game.x<p.x+p.w&&game.y<=top&&game.y>=top-18&&game.vy>=0){game.y=top;game.vy=0;landed=true;if(p.x>game.checkpoint)game.checkpoint=p.x}});
  game.on=landed;
  if(game.y<0){game.y=0;game.vy=0;game.on=true}
  if(game.y>430){game.x=game.checkpoint;game.y=340;game.vy=0}
  if(game.x>2050&&!game.won){game.won=true;$("#gameStatus").textContent="🏆 Você venceu!";$("#stageNum").textContent="FIM"}
  if(!game.won)$("#stageNum").textContent=String(Math.max(1,Math.floor(game.x/300)+1)).padStart(2,"0");
  game.cam=Math.max(0,Math.min(1200,game.x*.55*scale-w*.38));
  if(t-lastSend>60&&socket?.connected){socket.emit("player:move",{x:game.x,y:game.y});lastSend=t}
  raf=requestAnimationFrame(loop)
}
function drawBlock(x,y,color,name){ctx.fillStyle="#4a3b37";ctx.fillRect(x+5,y,25,24);ctx.fillStyle=color;ctx.fillRect(x+7,y+2,21,19);ctx.fillStyle="#26354a";ctx.fillRect(x+11,y+10,3,3);ctx.fillRect(x+21,y+10,3,3);ctx.fillStyle="#3977bb";ctx.fillRect(x,y+26,35,25);ctx.fillStyle="#283c59";ctx.fillRect(x+2,y+51,12,17);ctx.fillRect(x+20,y+51,12,17);ctx.fillStyle="#183047";ctx.font="10px Nunito";ctx.textAlign="center";ctx.fillText(name||"Jogador",x+17,y-6)}
async function loadFriends(){try{const d=await api("/api/friends");const el=$("#friendList");el.innerHTML="";if(!d.items.length){el.innerHTML='<p class="muted">Você ainda não tem amigos ou solicitações.</p>';return}d.items.forEach(f=>{const row=document.createElement("div");row.className="friend-row";row.innerHTML=`<div class="mini-avatar">${f.username[0].toUpperCase()}</div><div><b>${escapeHtml(f.username)}</b><small>${f.status==="accepted"?"Amigo":f.direction==="sent"?"Solicitação enviada":"Quer ser seu amigo"}</small></div>`;if(f.status==="pending"&&f.direction==="received"){const b=document.createElement("button");b.textContent="Aceitar";b.onclick=async()=>{try{await api(`/api/friends/${f.id}/accept`,{method:"POST"});loadFriends()}catch(e){alert(e.message)}};row.appendChild(b)}el.appendChild(row)})}catch(e){$("#friendList").textContent=e.message}}
$("#addFriend").onclick=async()=>{const username=$("#friendName").value.trim();if(!username)return;try{const d=await api("/api/friends/request",{method:"POST",body:JSON.stringify({username})});$("#friendMessage").textContent=d.message;$("#friendName").value="";loadFriends()}catch(e){$("#friendMessage").textContent=e.message}};
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
if(token)boot();else setMode("login");
