const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "troque-esta-chave-antes-de-publicar-" + Math.random().toString(36);

app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
}) : null;

let store = { users: [], friends: [] };
const storePath = path.join(__dirname, "store.json");

async function init() {
  if (pool) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, username VARCHAR(20) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS friendships (
        id SERIAL PRIMARY KEY, from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(12) NOT NULL DEFAULT 'pending',
        UNIQUE(from_id,to_id)
      );
    `);
  } else if (fs.existsSync(storePath)) {
    try { store = JSON.parse(fs.readFileSync(storePath, "utf8")); } catch {}
  }
}
function saveLocal() {
  if (!pool) fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}
async function userByName(username) {
  if (pool) {
    const r = await pool.query("SELECT id, username, password_hash FROM users WHERE LOWER(username)=LOWER($1)", [username]);
    return r.rows[0] || null;
  }
  return store.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}
async function userById(id) {
  if (pool) {
    const r = await pool.query("SELECT id, username FROM users WHERE id=$1", [id]);
    return r.rows[0] || null;
  }
  const u = store.users.find(x => x.id === Number(id));
  return u ? { id: u.id, username: u.username } : null;
}
function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: "Entre na sua conta novamente." }); }
}
function publicUser(u) { return { id: u.id, username: u.username }; }

app.get("/api/health", (_, res) => res.json({ ok: true, platform: "NuvemVerse" }));

app.post("/api/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username))
      return res.status(400).json({ error: "Use um nome de 3 a 16 caracteres: letras, números ou _." });
    if (password.length < 6 || password.length > 72)
      return res.status(400).json({ error: "A senha precisa ter entre 6 e 72 caracteres." });
    if (await userByName(username)) return res.status(409).json({ error: "Esse nome já está em uso." });
    const hash = await bcrypt.hash(password, 12);
    let user;
    if (pool) {
      const r = await pool.query("INSERT INTO users(username,password_hash) VALUES($1,$2) RETURNING id,username", [username, hash]);
      user = r.rows[0];
    } else {
      user = { id: store.users.reduce((m,u)=>Math.max(m,u.id),0)+1, username, password_hash: hash };
      store.users.push(user); saveLocal();
    }
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: "14d" });
    res.json({ token, user: publicUser(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: "Não foi possível criar a conta." }); }
});

app.post("/api/login", async (req, res) => {
  try {
    const user = await userByName(String(req.body.username || "").trim());
    if (!user || !(await bcrypt.compare(String(req.body.password || ""), user.password_hash)))
      return res.status(401).json({ error: "Nome ou senha incorretos." });
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: "14d" });
    res.json({ token, user: publicUser(user) });
  } catch (e) { console.error(e); res.status(500).json({ error: "Erro ao entrar." }); }
});

app.get("/api/me", auth, async (req,res) => {
  const u = await userById(req.user.id);
  if (!u) return res.status(404).json({ error: "Conta não encontrada." });
  res.json({ user: publicUser(u) });
});

app.get("/api/friends", auth, async (req,res) => {
  if (pool) {
    const r = await pool.query(`
      SELECT f.id, f.status, u.id AS uid, u.username,
      CASE WHEN f.from_id=$1 THEN 'sent' ELSE 'received' END AS direction
      FROM friendships f JOIN users u ON u.id=CASE WHEN f.from_id=$1 THEN f.to_id ELSE f.from_id END
      WHERE f.from_id=$1 OR f.to_id=$1 ORDER BY f.id DESC`, [req.user.id]);
    return res.json({ items: r.rows });
  }
  const items = store.friends.filter(f=>f.from===req.user.id || f.to===req.user.id).map(f=>{
    const other = store.users.find(u=>u.id===(f.from===req.user.id?f.to:f.from));
    return other ? { id:f.id, status:f.status, uid:other.id, username:other.username, direction:f.from===req.user.id?"sent":"received" } : null;
  }).filter(Boolean);
  res.json({ items });
});

app.post("/api/friends/request", auth, async (req,res) => {
  const target = await userByName(String(req.body.username || "").trim());
  if (!target) return res.status(404).json({ error: "Jogador não encontrado." });
  if (target.id === req.user.id) return res.status(400).json({ error: "Você não pode se adicionar." });
  try {
    if (pool) {
      const exists = await pool.query("SELECT id,status FROM friendships WHERE (from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1)", [req.user.id,target.id]);
      if (exists.rowCount) return res.status(409).json({ error: "Já existe uma solicitação ou amizade." });
      await pool.query("INSERT INTO friendships(from_id,to_id) VALUES($1,$2)", [req.user.id,target.id]);
    } else {
      if (store.friends.some(f=>(f.from===req.user.id&&f.to===target.id)||(f.from===target.id&&f.to===req.user.id)))
        return res.status(409).json({ error: "Já existe uma solicitação ou amizade." });
      store.friends.push({ id:Date.now(), from:req.user.id, to:target.id, status:"pending" }); saveLocal();
    }
    res.json({ ok:true, message:"Solicitação enviada!" });
  } catch(e) { res.status(500).json({ error:"Não foi possível enviar." }); }
});

app.post("/api/friends/:id/accept", auth, async (req,res) => {
  if (pool) {
    const r = await pool.query("UPDATE friendships SET status='accepted' WHERE id=$1 AND to_id=$2 AND status='pending' RETURNING id", [req.params.id,req.user.id]);
    if (!r.rowCount) return res.status(404).json({ error:"Solicitação não encontrada." });
  } else {
    const f = store.friends.find(x=>x.id===Number(req.params.id)&&x.to===req.user.id&&x.status==="pending");
    if (!f) return res.status(404).json({ error:"Solicitação não encontrada." });
    f.status="accepted"; saveLocal();
  }
  res.json({ ok:true });
});

const online = new Map();
io.use((socket,next)=>{
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Faça login para jogar."));
    socket.user = jwt.verify(token, SECRET);
    next();
  } catch { next(new Error("Sessão inválida.")); }
});
io.on("connection", socket => {
  const id = String(socket.user.id);
  online.set(id, { id, username:socket.user.username, x:80, y:0, color:avatarColor(socket.user.id), socketId:socket.id });
  socket.join("obby");
  socket.emit("world:init", [...online.values()].map(({socketId,...p})=>p));
  socket.broadcast.to("obby").emit("player:join", { id, username:socket.user.username, x:80, y:0, color:avatarColor(socket.user.id) });
  socket.on("player:move", data => {
    const p = online.get(id); if (!p) return;
    const x = Number(data?.x), y = Number(data?.y);
    if (!Number.isFinite(x)||!Number.isFinite(y)) return;
    p.x = Math.max(0,Math.min(2400,x)); p.y = Math.max(-300,Math.min(600,y));
    socket.broadcast.to("obby").emit("player:move", { id, x:p.x, y:p.y });
  });
  socket.on("disconnect",()=>{
    online.delete(id);
    socket.broadcast.to("obby").emit("player:leave",{id});
  });
});
function avatarColor(id) { return ["#ffbd59","#63c7ff","#ff7c9c","#8bdc87","#b69aff"][Number(id)%5]; }

app.get("*", (_,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
init().then(()=>server.listen(PORT,()=>console.log("NuvemVerse rodando na porta "+PORT)))
.catch(e=>{console.error("Falha ao iniciar",e);process.exit(1);});
