<p align="center">
  <img src="https://github.com/crow4619/looplet/blob/main/data/public/looplet.png" alt="Looplet Logo" height="88"><br/>
  <b style="font-size:40px; line-height:1;">Looplet</b><br/>
  <sub>Ambient Looper &amp; Animation Gallery</sub>
</p>

<p align="center">
  <a href="#-status--versioning"><img src="https://img.shields.io/badge/status-alpha-orange" alt="Status"></a>
  <a href="#-features"><img src="https://img.shields.io/badge/SQLite-lightweight-blue.svg" alt="SQLite"></a>
  <a href="#-quick-start-docker-compose"><img src="https://img.shields.io/badge/Docker-ready-2496ED.svg" alt="Docker"></a>
  <a href="#-vibe-coded-notes"><img src="https://img.shields.io/badge/vibe%20coded-yes-ff69b4" alt="Vibe coded"></a>
  <a href="#-license"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT"></a>
</p>

A tiny, self-hosted **loop viewer + audio looper** with a companion **Creator** UI.  
Serve your GIF/MP4/WebM “looplets,” tag them, pair them with ambient audio, and watch in a clean, mobile-friendly gallery.  
No external cloud required — runs in a single Docker container with a lightweight SQLite DB.

---

## ✨ Features

**DB-backed media library** (SQLite)
- One unified `media` table for **animations** (video) and **audio**
- Fields: `kind` (`video` | `audio`), `filename`, `title`, `tags` (JSON), `credit`, `created_at`

**Viewer**
- Responsive grid of thumbnails (lazy-loaded)
- Hover/focus preview for videos; static GIF thumbs with hover playback
- Tag filters (AND/OR), “untagged” bucket
- Fullscreen playback with swipe (mobile) + ←/→ (desktop)
- **Audio player** with loop progress, seek; optional sync to cycle animations on loop boundaries

**Creator**
- **Scan** `/audio` + `/video` folders into the DB
- **Upload** media (video/audio) directly to the server
- Inline edit **title, tags, credit, date**
- **Per-row save** + **Save all** with “**Unsaved**” badges
- **Delete** media (removes file + DB row)
- Sort by **Filename, Title, Credit, Date** (A→Z / Z→A)
- Mobile-friendly table UX
- NEW: **Sticky field labels** for each entry in Creator UI

**REST API**
- `/api/health`, `/api/scan`, `/api/media`, `/api/media/:id`, `/api/upload`, `/api/delete/:id`

**Simple, portable deployment**
- Single container; volumes for `audio/`, `video/`, and `db/`

---

## 📦 Quick Start (Docker Compose)

> The easiest path is to build directly from this repo. Pin to a tag or commit for stability.

**docker-compose.yml**
```yaml
version: "3.9"
services:
  looplet:
    container_name: looplet
    build:
      context: https://github.com/crow4619/looplet.git#main
    ports:
      - "8088:8088"
    environment:
      - NODE_ENV=production
      - PORT=8088
      - DB_FILE=/app/db/looplet.sqlite
      - MEDIA_DIR=/app/media
    volumes:
      # Persist the database and your media (host ↔ container)
      - ./data/db:/app/db
      - ./data/audio:/app/media/audio
      - ./data/video:/app/media/video
    restart: unless-stopped
