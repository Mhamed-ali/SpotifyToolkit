# 🎧 Spotify Toolkit 2.0

A fast, privacy-first, full-stack Spotify library analysis, curation, and repair platform. Built with a unified **Obsidian v2.0 Workspace**, ** Spotify Web APIs** (`0` simulated/mocked endpoints), progressive multi-thousand-track caching, and 1-click playlist mutations.

🌐 **Live Production Instance:** [https://toolify.ddns.net](https://toolify.ddns.net)

---

## ✨ Core 1-Click Workflows (5-Card Dock)

### 1. 🌙 Arabic Track Extractor (`arabic`)
- **2-Pass Multi-Tier Detection Engine (`ArabicDetector.js`):**
  - **Pass 1 (Instant Local Metadata Scan):**
    - **Tier 1 — Arabic Unicode Script (`/[\u0600-\u06FF]/`):** Detects Arabic script in Track Title, Artist Name, or Album Name.
    - **Tier 2 — Franco-Arabic & Cultural Keywords:** Whole-word boundary (`\b`) matching for transliterated keywords (`Habibi`, `Ya`, `Albi`, `Mahraganat`, `Shaabi`, `Tarab`, `Khaleeji`, etc.).
    - **Tier 3 — Curated Arabic Artist Directory:** Broad and strict exact-match artist registries (e.g., `Amr Diab`, `Cairokee`, `Fairuz`, `Wegz`, `Marwan Pablo`, plus strict disambiguation for ambiguous names like `Ruby`, `Muslim`, `Nour`).
  - **Pass 2 (Spotify Artist Genre Classification):** Batches artist IDs (`50` per request via `GET /v1/artists`) and cross-references official Spotify MENA/Arabic genre tags (`egyptian pop`, `arab pop`, `mahraganat`, `khaleeji`, `levantine pop`, `arabic hip hop`, etc.).
- **Strict Arabic Extraction Mode:** Optional toggle in Advanced Options that ignores artist name script and Spotify artist genres to exclude purely English songs by Arabic artists.
- **Global & Scope Counters:** Top dock card always displays the global Arabic track count across the entire library, while the workspace header badge shows the count for the active playlist/scope.

### 2. 🧹 1-Click Duplicate Cleaner (`dupes`)
- **Strict & Fuzzy Clustering (`DuplicateDetector.js`):**
  - **Strict Mode:** Matches exact normalized `Title | Primary Artist | Duration (ms)` or identical Spotify Track IDs.
  - **Fuzzy Mode (`±0s` to `±5s` Tolerance):** Strips edition suffixes (`Remastered`, `Radio Edit`, `feat.`, etc.) and clusters recordings whose duration differs within the user-configured tolerance (default `±2s`).
- **Scope Control:**
  - **Per-List (`per` — Default):** Finds duplicates strictly within the boundaries of the same playlist.
  - **Cross-List (`cross`):** Finds duplicates across all selected playlists and `♥ Liked Songs`.
- **Playable-First Smart Keep Strategy:**
  - Automatically checks `isTrackUnplayableOrLocal` first inside every duplicate cluster so **playable copies are always marked `KEEP`** and locked/delisted copies are marked `REMOVE`, before applying `Oldest`, `Newest`, or `Popular` tie-breakers.
- **Safe Occurrence-Indexed Deletion:** Uses Spotify `positions` when removing same-URI duplicates within a single playlist so the `KEEP` copy is never accidentally deleted.

### 3. 🔀 Playlist Compare & Sync (`compare`)
- **Set Operations Across Any Two Playlists (`A` vs `B`):**
  - **Only in A (`A − B`):** Tracks present in Playlist A that are missing from Playlist B (matched by Track ID or normalized `Title | Primary Artist`).
  - **Shared Overlap (`A ∩ B`):** Tracks present in both playlists.
  - **Combined Union (`A ∪ B`):** Deduplicated union of both playlists.
- **1-Click Sync Actions:** Push missing `A − B` tracks directly into Playlist B or save any comparison view as a brand-new Spotify playlist.

### 4. 🏆 Top 50 & Listening History (`top`)
- **Live Spotify Affinity & History (`GET /v1/me/top/tracks`, `GET /v1/me/top/artists`, `GET /v1/me/player/recently-played`):**
  - **Last 4 Weeks (`short_term`)**, **Last 6 Months (`medium_term`)**, **All-Time (`long_term`)**, and **Recently Played (Last 50)**.
  - Displays a live **Top Artists** ribbon and lets users save their Top 50 as a dated Spotify playlist in 1 click.

### 5. 📊 Library Insights, Health & Smart Genre Splitter (`insights`)
- **KPI Health Cards:** Total Tracks, Total Duration, Average Popularity, Explicit Ratio, and **👻 Unplayable / Locked Tracks**.
- **🎸 Smart Genre Family Splitter:** Classifies tracks using real Spotify Artist Genres into 6 interactive buckets (`🌙 Arabic & MENA`, `🎤 Hip-Hop & Rap`, `⚡ Electronic & Dance`, `🎸 Rock & Indie`, `✨ Pop & Mainstream`, `☕ Chill, R&B & Soul`) with 1-click playlist creation (`➕ Save "[Genre]" (N)`).
- **🎤 Top Artists & 📅 Release Decades:** Interactive horizontal bar charts that filter the track table on click.
- **🔄 3-Stage Unavailable / Locked Track Replacement Engine:**
  - **Stage 1 (Instant Local Library Cross-Match — `0` API calls):** Automatically checks dead/locked tracks against all playable tracks already cached across the user's playlists and `Liked Songs`.
  - **Stage 2 (Spotify ISRC Master Lookup):** Queries `GET /v1/search?type=track&market=from_token&q=isrc:{isrc}` to find the active regional re-upload sharing the exact studio recording code.
  - **Stage 3 (Fuzzy Title + Artist + Duration `±3s` Search):** Queries Spotify Search for the normalized title and primary artist, scoring playable candidates within `±3,000ms`.
  - **1-Click Preview & Swap:** Row-level **`▶ Test New`** (mini-player preview) and **`⚡ Replace`** buttons, plus bulk **`🔍 Find Replacements`** and **`🔄 Replace All Found (N)`** actions supporting both regular playlists and `♥ Liked Songs`.

---

## 🛠️ Additional Power Tools
- **💾 Save Order to Spotify:** Permanently reorders tracks in any user-editable playlist (`PUT /v1/playlists/{id}/tracks` + chunked `POST`) whenever a non-default sort order is active.
- **📊 Custom Excel Exporter (`ExcelExporter.js`):** Exports rich `.xlsx` spreadsheets with clickable Spotify hyperlinks, ISRC codes, release dates, match reasons, and source playlists.
- **🎧 Embedded Spotify Mini-Player:** Floating bottom dock with official Spotify iframe embed (`open.spotify.com/embed/track/{id}`) for instant in-app track and replacement previews.

---

## 📂 Documentation Index

- **[Requirements Specification (`docs/REQUIREMENTS.md`)](./docs/REQUIREMENTS.md):** Functional (FR) and Non-Functional (NFR) requirements.
- **[System Architecture (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md):** High-level architecture, SOLID domain services, progressive caching, and Oracle Cloud VM deployment topology.
- **[VM Deployment Skill (`.agents/skills/vm-deploy/SKILL.md`)](./.agents/skills/vm-deploy/SKILL.md):** Automated deployment runbook for `https://toolify.ddns.net`.

---

## 🚀 Quick Start & Testing

```bash
# Install dependencies for root, server, and client
npm run install:all

# Run all 16 server & client unit test suites
npm test

# Build production frontend bundle
cd client && npm run build
```
