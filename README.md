<p align="center">
  <img src="https://github.com/crow4619/looplet/blob/main/data/public/looplet.png" alt="Looplet Logo" height="88"><br/>
  <b style="font-size:40px; line-height:1;">Looplet</b><br/>
  <sub>Ambient Looper &amp; Animation Gallery</sub>
</p>

<p align="center">
  <a href="#-features"><img src="https://img.shields.io/badge/SQLite-lightweight-blue.svg" alt="SQLite"></a>
  <a href="#-quick-start-docker-compose"><img src="https://img.shields.io/badge/Docker-ready-2496ED.svg" alt="Docker"></a>
  <a href="#-license"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT"></a>
</p>

A tiny, self-hosted **loop viewer + audio looper** with a companion **Creator** UI.  
Serve your GIF/MP4/WebM “looplets,” tag them, pair them with ambient audio, and watch in a clean, mobile-friendly gallery. No external cloud required — runs in a single Docker container with a lightweight SQLite DB.

---

## ✨ Features

- **DB-backed media library** (SQLite)
  - One unified `media` table for **animations** (video) and **audio**
  - Fields: `kind` (`video`|`audio`), `filename`, `title`, `tags[]`, `credit`, `created_at`
- **Viewer**
  - Responsive grid of thumbnails (lazy-loaded)
  - Hover/focus preview for videos; static GIF thumbs with hover playback
  - Tag filters (AND/OR), “untagged” bucket
  - Fullscreen playback with swipe (mobile) + ←/→ (desktop)
  - **Audio player** with loop progress, pitch shift, seek bar, and optional sync to cycle animations on loop boundaries
  - Audio dropdown shows **titles** (not filenames)
- **Creator**
  - **Scan** `/audio` + `/video` folders into the DB
  - **Upload** media (video/audio) directly to the server
  - Inline edit **title, tags, credit, date**
  - **Per-row save** + **Save all changes**
  - “**Unsaved**” badges on edited rows until committed
  - **Delete** media (removes file + DB row)
  - Sort by **Filename, Title, Credit, Date** (A→Z / Z→A)
  - Mobile-friendly table UX
- **REST API**
  - `/api/health`, `/api/scan`, `/api/media`, `/api/media/:id`, `/api/upload`, `/api/delete/:id`
- **Simple, portable deployment**
  - Single container; volumes for `audio/`, `video/`, and `db/`

---

## 📦 Quick Start (Docker Compose)

The easiest way is to point `build` at this repo. Copy into `docker-compose.yml` and run `docker compose up -d`.

```yaml
version: "3.9"
services:
  looplet:
    container_name: looplet
    build: https://github.com/crow4619/looplet.git
    ports:
      - "8088:8088"
    environment:
      - NODE_ENV=production
      - DB_FILE=/app/db/looplet.sqlite
      - MEDIA_DIR=/app/media
    volumes:
      # Persist the database and your media
      - ./data/db:/app/db
      - ./data/audio:/app/media/audio
      - ./data/video:/app/media/video
    restart: unless-stopped
