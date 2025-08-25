// server.js
import express from "express";
import Database from "better-sqlite3";
import { glob } from "glob";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PORT      = process.env.PORT      || 8088;
const DB_FILE   = process.env.DB_FILE   || "/app/db/looplet.sqlite";
const MEDIA_DIR = process.env.MEDIA_DIR || "/app/media";
const VIDEO_DIR = path.join(MEDIA_DIR, "video");
const AUDIO_DIR = path.join(MEDIA_DIR, "audio");
const PUBLIC_DIR= path.join(__dirname, "public");

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });
fs.mkdirSync(AUDIO_DIR, { recursive: true });

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS media (
  id        INTEGER PRIMARY KEY,
  kind      TEXT CHECK(kind IN ('video','audio')) NOT NULL,
  filename  TEXT NOT NULL,
  title     TEXT,
  tags      TEXT,
  credit    TEXT,
  UNIQUE(kind, filename)
);
`);
// Migration: add created_at if missing
try { db.exec(`ALTER TABLE media ADD COLUMN created_at TEXT`); } catch { /* already exists */ }

const app = express();
app.use(express.json());

app.use(express.static(PUBLIC_DIR, { fallthrough: true }));
app.use("/video", express.static(VIDEO_DIR, { fallthrough: true }));
app.use("/audio", express.static(AUDIO_DIR, { fallthrough: true }));

const titleFromName = (name) =>
  String(name||"").replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").replace(/\s+/g," ").trim();
const isVideoExt = (f) => /\.(gif|mp4|webm|mov)$/i.test(f||"");
const isAudioExt = (f) => /\.(mp3|flac|ogg|wav)$/i.test(f||"");

function safeResolve(base, rel){
  const abs = path.resolve(base, rel);
  const baseAbs = path.resolve(base) + path.sep;
  if(!abs.startsWith(baseAbs)) throw new Error("Unsafe path");
  return abs;
}

app.get("/api/health", (req,res)=>res.json({ok:true, db:DB_FILE}));

app.post("/api/scan", async (req,res)=>{
  try{
    const videoFiles = await glob("**/*.{mp4,webm,mov,gif}", { cwd: VIDEO_DIR, nocase:true });
    const audioFiles = await glob("**/*.{mp3,flac,ogg,wav}", { cwd: AUDIO_DIR, nocase:true });

    const upsert = db.prepare(`
      INSERT INTO media (kind, filename, title, tags, credit, created_at)
      VALUES (@kind, @filename, @title, @tags, @credit, @created_at)
      ON CONFLICT(kind, filename) DO NOTHING;
    `);

    db.transaction(()=>{
      for(const f of videoFiles){
        const p = path.join(VIDEO_DIR, f);
        let iso = new Date().toISOString();
        try { iso = fs.statSync(p).mtime.toISOString(); } catch {}
        upsert.run({
          kind:"video", filename:f, title:titleFromName(path.basename(f)),
          tags:JSON.stringify([]), credit:null, created_at: iso
        });
      }
      for(const f of audioFiles){
        const p = path.join(AUDIO_DIR, f);
        let iso = new Date().toISOString();
        try { iso = fs.statSync(p).mtime.toISOString(); } catch {}
        upsert.run({
          kind:"audio", filename:f, title:titleFromName(path.basename(f)),
          tags:JSON.stringify([]), credit:null, created_at: iso
        });
      }
    })();

    res.json({ok:true, videos:videoFiles.length, audios:audioFiles.length});
  }catch(e){ console.error(e); res.status(500).json({ok:false, error:String(e)}); }
});

app.get("/api/media", (req,res)=>{
  const { kind, tag, q } = req.query;
  let sql = "SELECT * FROM media";
  const where = []; const params = {};
  if(kind==="video"||kind==="audio"){ where.push("kind=@kind"); params.kind=kind; }
  if(q){ where.push("(title LIKE @q OR filename LIKE @q)"); params.q=`%${q}%`; }
  if(tag){ where.push("tags LIKE @tagmatch"); params.tagmatch=`%"${tag}"%`; }
  if(where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY filename COLLATE NOCASE ASC";

  const rows = db.prepare(sql).all(params).map(r=>({
    ...r,
    tags: r.tags ? JSON.parse(r.tags) : [],
    created_at: r.created_at || null
  }));
  res.json({ok:true, items:rows});
});

app.patch("/api/media/:id", (req,res)=>{
  const id = Number(req.params.id);
  if(!id) return res.status(400).json({ok:false, error:"Bad id"});
  const row = db.prepare("SELECT * FROM media WHERE id=?").get(id);
  if(!row) return res.status(404).json({ok:false, error:"Not found"});

  const { title, tags, credit, created_at } = req.body || {};
  const newTitle  = typeof title  === "string" ? title : row.title;
  const newTags   = Array.isArray(tags)        ? JSON.stringify(tags) : row.tags;
  const newCredit = typeof credit === "string" ? credit : row.credit;
  const newDate   = (typeof created_at === "string" && !Number.isNaN(Date.parse(created_at)))
                      ? new Date(created_at).toISOString()
                      : row.created_at;

  db.prepare(`UPDATE media SET title=@title, tags=@tags, credit=@credit, created_at=@created_at WHERE id=@id`)
    .run({ id, title:newTitle, tags:newTags, credit:newCredit, created_at:newDate });

  const updated = db.prepare("SELECT * FROM media WHERE id=?").get(id);
  updated.tags = updated.tags ? JSON.parse(updated.tags) : [];
  res.json({ok:true, item:updated});
});

// uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const kind = (req.query.kind||"video").toString().toLowerCase();
    cb(null, kind==="audio" ? AUDIO_DIR : VIDEO_DIR);
  },
  filename: (req,file,cb)=>cb(null, file.originalname)
});
const upload = multer({
  storage,
  fileFilter: (req,file,cb)=>{
    const kind = (req.query.kind||"video").toString().toLowerCase();
    const ok = kind==="audio" ? isAudioExt(file.originalname) : isVideoExt(file.originalname);
    cb(null, ok);
  }
});

app.post("/api/upload", upload.array("files", 50), (req,res)=>{
  try{
    const kind = (req.query.kind||"video").toString().toLowerCase()==="audio" ? "audio":"video";
    const folder = kind==="audio" ? AUDIO_DIR : VIDEO_DIR;
    const upsert = db.prepare(`
      INSERT INTO media (kind, filename, title, tags, credit, created_at)
      VALUES (@kind, @filename, @title, @tags, @credit, @created_at)
      ON CONFLICT(kind, filename) DO NOTHING;
    `);
    const saved=[];
    db.transaction(()=>{
      for(const f of (req.files||[])){
        const rel = path.relative(folder, f.path).replace(/\\/g,"/");
        upsert.run({
          kind, filename:rel, title:titleFromName(path.basename(rel)),
          tags:JSON.stringify([]), credit:null, created_at:new Date().toISOString()
        });
        saved.push(rel);
      }
    })();
    res.json({ok:true, saved});
  }catch(e){ console.error(e); res.status(500).json({ok:false, error:String(e)}); }
});

// delete (optionally remove file)
app.delete("/api/media/:id", (req,res)=>{
  const id = Number(req.params.id);
  const delFile = String(req.query.deleteFile||"").toLowerCase()==="1";
  if(!id) return res.status(400).json({ok:false, error:"Bad id"});
  const row = db.prepare("SELECT * FROM media WHERE id=?").get(id);
  if(!row) return res.status(404).json({ok:false, error:"Not found"});

  db.prepare("DELETE FROM media WHERE id=?").run(id);

  let fileDeleted=false, fileError=null;
  if(delFile){
    try{
      const baseDir = row.kind==="audio" ? AUDIO_DIR : VIDEO_DIR;
      const abs = safeResolve(baseDir, row.filename);
      if(fs.existsSync(abs)){ fs.rmSync(abs, {force:true}); fileDeleted=true; }
    }catch(e){ fileError=String(e); }
  }
  res.json({ok:true, removedId:id, fileDeleted, fileError});
});

app.get("/", (req,res)=>res.sendFile(path.join(PUBLIC_DIR, "index.html")));

app.use((req,res,next)=>{
  if(req.path.startsWith("/api/")) return res.status(404).json({ok:false, error:"Not found"});
  next();
});

app.listen(PORT, ()=>{
  console.log(`Looplet API on :${PORT}`);
  console.log(`DB: ${DB_FILE}`);
  console.log(`Media: ${MEDIA_DIR}`);
  console.log(`Public: ${PUBLIC_DIR}`);
});
