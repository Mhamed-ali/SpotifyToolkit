# 📋 Requirements Specification — Spotify Toolkit 2.0

**Last Updated:** November 14, 2026  
**Production Environment:** [https://toolify.ddns.net](https://toolify.ddns.net)  
**Active Branch:** `anghami-integration`

---

## 1. Product Vision & Scope

**Spotify Toolkit 2.0** is a stateless, privacy-first web application that empowers Spotify users to deeply analyze, deduplicate, split, compare, and repair their music library (including `♥ Liked Songs` and all personal/collaborative playlists) using **100% real, non-deprecated Spotify Web APIs**.

---

## 2. Functional Requirements (FR)

### FR-1: Authentication & Session Management
- **FR-1.1 (OAuth 2.0 Authorization Code Flow):** The backend (`server/controllers/auth.controller.js`) shall authenticate users against `accounts.spotify.com/authorize` with CSRF state cookie verification (`spotify_auth_state`).
- **FR-1.2 (Required OAuth Scopes):** The application shall request:
  - `user-read-private`, `user-read-email`
  - `playlist-read-private`, `playlist-read-collaborative`
  - `playlist-modify-public`, `playlist-modify-private`
  - `user-library-read`, `user-library-modify`
  - `user-top-read`, `user-read-recently-played`
- **FR-1.3 (Automatic 401 Token Refresh):** The client (`client/src/services/spotify.service.js`) shall transparently intercept `401 Unauthorized` responses, request a fresh access token via `/refresh_token`, update `localStorage`, and retry the failed request without losing user state.
- **FR-1.4 (External Playlist Link Loader):** Users shall be able to paste any public Spotify playlist URL or URI (`https://open.spotify.com/playlist/...` or `spotify:playlist:...`) to load and analyze it on demand.

---

### FR-2: Scope Selection & Progressive Library Loading
- **FR-2.1 (Unified Scope Sidebar):** The left sidebar (`296px` width) shall display:
  - `🔥 All Songs (Combined)` — deduplicated/aggregated library view across `♥ Liked Songs` and all user playlists.
  - `♥ Liked Songs` — virtual playlist (`__LIKED_SONGS__`) backed by `/v1/me/tracks`.
  - All user-owned and followed playlists with real-time search filtering.
- **FR-2.2 (Multi-Select Scope Mode):** Users shall be able to toggle **Multi-Select** in the sidebar to combine any arbitrary subset of playlists into a single analysis scope.
- **FR-2.3 (Two-Pass Progressive Loading & Live Visualizer):**
  - **Pass 1 (`0% → 75%`):** Scans track metadata across playlists (`100` tracks/batch) and `Liked Songs` (`50` tracks/batch), utilizing `tracksCacheRef` for instant (`0ms`) cache hits on previously loaded playlists and streaming uncached playlists in parallel batches (`BATCH_SIZE = 4`).
  - **Pass 2 (`75% → 100%`):** Collects uncached Spotify artist IDs and fetches artist genres in batches of `50` (`GET /v1/artists`), updating the progress bar after every chunk and hiding the visualizer immediately upon completion.
- **FR-2.4 (Source Playlist Attribution & Hover Popover):** In `🔥 All Songs (Combined)` or Multi-Select scopes, each track row shall display its primary source playlist and a `+N` badge (e.g., `Liked Songs +3`). Hovering over the badge shall display a rich popover listing every playlist containing that track.

---

### FR-3: Workflow 1 — 🌙 Arabic Track Extractor (`arabic`)
- **FR-3.1 (Multi-Tier Heuristic + Genre Detection):** `ArabicDetector.js` shall classify tracks using:
  1. **Tier 1 (Unicode Script):** `/[\u0600-\u06FF]/` in Track Title, Artist Name (when not in strict mode), or Album Name.
  2. **Tier 2 (Transliterated Keywords):** Whole-word boundary (`\b`) matching against Franco-Arabic cultural/musical terms (`Habibi`, `Mahraganat`, `Shaabi`, `Tarab`, `Khaleeji`, etc.).
  3. **Tier 3 (Known Arabic Artists):** Broad and strict exact-match artist registries (`Amr Diab`, `Cairokee`, `Fairuz`, `Wegz`, `Ruby`, `Muslim`, etc.).
  4. **Pass 2 (Spotify Artist Genres):** Official Spotify MENA/Arabic genre substrings (`arab`, `egyptian`, `khaleeji`, `levantine`, `mahraganat`, `shaabi`, `tarab`, `oriental`, `halay`, `dabke`, `moroccan`, `algerian`, `tunisian`, `iraqi`, `syrian`, `lebanese`, `palestinian`, `jordanian`, `sudanese`, `yemeni`, `libyan`, ` gulf `).
- **FR-3.2 (Strict Arabic Extraction Toggle):** When enabled in Advanced Options, detection shall ignore artist name script and Spotify artist genres, relying strictly on Track Title or explicitly curated Arabic artists so purely English songs by Arabic artists are excluded.
- **FR-3.3 (Global vs. Scope Badges):** The top workflow card (`🌙 Arabic Extractor`) shall always show the **global** Arabic match count across the entire library (`globalArabicCount`), while the workspace header badge shows the count for the currently selected playlist/scope.
- **FR-3.4 (Accurate Empty-Playlist State):** When a selected playlist finishes loading with `0` Arabic matches, the workspace shall immediately display `"No tracks match the current filter"` rather than remaining stuck in `"Analyzing your music library..."`.

---

### FR-4: Workflow 2 — 🧹 1-Click Duplicate Cleaner (`dupes`)
- **FR-4.1 (Context-Scoped Advanced Options):** When `🧹 Clean Duplicates` is active, Advanced Options shall display only deduplication settings (`Match Criteria`, `Duration Tolerance`, `Deduplication Scope`, `Default Keep Strategy`) and hide unrelated Arabic extraction settings.
- **FR-4.2 (Strict vs. Fuzzy Clustering):**
  - **Strict:** Clusters tracks with identical Spotify Track IDs or exact normalized `Title | Primary Artist | Duration (ms)`.
  - **Fuzzy (`±0s` to `±5s`):** Normalizes track titles (stripping `Remastered`, `Radio Edit`, `feat.`, etc.) and groups recordings by the same primary artist whose duration difference is within `durationTolerance` seconds (default `±2s`).
- **FR-4.3 (Per-List vs. Cross-List Scope):**
  - **Per-List (`per` — Default):** Detects duplicates only within the same playlist.
  - **Cross-List (`cross`):** Detects duplicates across all playlists in the active scope.
- **FR-4.4 (Playable-First Smart Keep Strategy):**
  - Within every duplicate cluster, playable tracks (`!isTrackUnplayableOrLocal(item)`) **must always take precedence over unplayable/locked tracks**, regardless of whether `Oldest`, `Newest`, or `Popular` is selected.
  - Among equally playable copies, the user's chosen strategy (`Oldest` added date, `Newest` added date, or highest `Popular` score) determines which single copy is marked `KEEP` (green badge) and which copies are marked `REMOVE` (red badge, pre-selected for 1-click deletion).
- **FR-4.5 (Safe Same-URI Deletion):** When removing duplicate copies of the exact same Spotify URI within a single playlist, the client shall pass occurrence-indexed `positions` where supported or automatically re-add the preserved `KEEP` copy so Spotify's URI-wide `DELETE` endpoint never wipes all copies.

---

### FR-5: Workflow 3 — 🔀 Playlist Compare & Sync (`compare`)
- **FR-5.1 (Dual Playlist Selectors):** Users shall select any **Playlist A (Source)** and **Playlist B (Target)** (including `♥ Liked Songs`) and switch between:
  - **Only in A (`A − B`):** Tracks in A missing from B.
  - **Shared Overlap (`A ∩ B`):** Tracks present in both A and B.
  - **Combined Union (`A ∪ B`):** Deduplicated union of A and B.
- **FR-5.2 (1-Click Sync & Export):** Users shall be able to push selected `A − B` tracks directly into Playlist B (if editable) or save any comparison result as a new Spotify playlist.

---

### FR-6: Workflow 4 — 🏆 Top 50 & Listening History (`top`)
- **FR-6.1 (Live Time-Range Selector):** Users shall switch between:
  - `🔥 Last 4 Weeks` (`short_term` Top 50 Tracks & Top Artists)
  - `📅 Last 6 Months` (`medium_term` Top 50 Tracks & Top Artists)
  - `👑 All-Time Top 50` (`long_term` Top 50 Tracks & Top Artists)
  - `🕒 Recently Played` (Last 50 played tracks with playback timestamps)
- **FR-6.2 (1-Click Top 50 Playlist Snapshot):** Users shall be able to save any Top 50 or Recently Played view as a new Spotify playlist in 1 click.

---

### FR-7: Workflow 5 — 📊 Insights, Health & Smart Genre Splitter (`insights`)
- **FR-7.1 (Library KPI & Health Cards):** Display Total Tracks, Total Duration, Average Popularity (`0–100`), Explicit Track Count/Percentage, and an interactive **👻 Unplayable / Locked** card.
- **FR-7.2 (🎸 Smart Genre Family Splitter):**
  - Classify tracks in the active scope into 6 genre families using real Spotify Artist Genres:
    1. `🌙 Arabic & MENA`
    2. `🎤 Hip-Hop & Rap`
    3. `⚡ Electronic & Dance`
    4. `🎸 Rock & Indie`
    5. `✨ Pop & Mainstream`
    6. `☕ Chill, R&B & Soul`
  - Clicking any genre card filters the track table below and surfaces a **`➕ Save "[Genre]" (N)`** button in the workspace header.
- **FR-7.3 (🎤 Top Artists & 📅 Release Decades Charts):** Interactive horizontal bar charts that filter the track list by artist or release decade on click.
- **FR-7.4 (🔄 3-Stage Unavailable / Locked Track Replacement Engine):**
  - **Detection (`isTrackUnplayableOrLocal`):** Flags tracks where `is_local === true`, `is_playable === false`, `!id && !uri`, or `available_markets.length === 0`.
  - **Stage 1 (Automatic Local Library Cross-Match — `0` API calls):** Automatically cross-matches every dead/locked track against all playable tracks cached across the user's playlists and `Liked Songs` (`localDeadReplacementsMap`).
  - **Stage 2 (Spotify ISRC Master Lookup):** When the user clicks **`🔍 Find Replacements`**, queries `GET /v1/search?type=track&market=from_token&q=isrc:{isrc}` for any dead track carrying an ISRC code (`external_ids.isrc`).
  - **Stage 3 (Fuzzy Title + Artist + Duration `±3s` Search):** Queries `GET /v1/search?type=track&market=from_token&q=track:... artist:...` and scores playable candidates via `findBestPlayableReplacement`:
    - **Tier 3:** Exact ISRC studio master match.
    - **Tier 2:** Normalized Title (edition suffixes stripped) + Primary Artist + Duration within `±3,000ms`.
    - **Tier 1:** Normalized Title + Shared Artist + Duration within `±5,000ms`.
  - **1-Click Preview & Swap:**
    - Track rows display `🔒 Unavailable` and `🔄 Replacement Ready` badges with **`▶ Test New`** (loads the playable replacement in the mini-player) and **`⚡ Replace`** (adds the playable replacement and removes the dead track across editable playlists and `♥ Liked Songs`).
    - Bulk **`🔄 Replace All Found (N)`** swaps all matched dead tracks in one operation.

---

### FR-8: Permanent Playlist Reordering, Excel Export & Mini-Player
- **FR-8.1 (Permanent Playlist Sort — `💾 Save Order to Spotify`):** When viewing a single editable playlist with a non-default sort order (`Release Date`, `Popularity`, `Duration`, `Track Name`, `Artist`), a **`💾 Save Order to Spotify`** button shall permanently write the sorted track order to Spotify via `PUT /v1/playlists/{id}/tracks` (first 100 URIs) followed by chunked `POST` requests.
- **FR-8.2 (Rich Excel Export — `ExcelExporter.js`):** Users shall export selected tracks to `.xlsx` with customizable columns, clickable `=HYPERLINK(...)` Spotify links, ISRC codes, release dates, match reasons, and source playlists.
- **FR-8.3 (Embedded Spotify Mini-Player):** Clicking `▶` on any track row or `▶ Test New` on a replacement candidate shall open the floating bottom Spotify iframe player (`https://open.spotify.com/embed/track/{id}`).

---

## 3. Non-Functional Requirements (NFR)

- **NFR-1 (100% Real Spotify APIs — Zero Mocks):** Every feature must use live, non-deprecated Spotify Web API endpoints. Deprecated endpoints (`/v1/audio-features`, `/v1/recommendations`) and simulated/fake fallbacks are strictly prohibited.
- **NFR-2 (UI Responsiveness & Windowed Rendering):** Track lists exceeding `150` items shall render progressively (`visibleTrackCount` windowing in increments of `150`) so switching between `3,900+` tracks in `🔥 All Songs (Combined)` remains instantaneous (`<16ms` frame budget).
- **NFR-3 (Rate-Limit Resilience):** All Spotify API calls in `spotify.service.js` shall automatically respect `429 Too Many Requests` (`Retry-After` / exponential backoff) and retry transient network failures up to `3` times.
- **NFR-4 (Security & Log Redaction):** Neither the Express backend nor the client ring-buffer logger shall ever log raw OAuth tokens (`Bearer ...`, `access_token=...`, `refresh_token=...`); all sensitive tokens are automatically redacted as `[REDACTED]`.
- **NFR-5 (Production VM Stability):** The Oracle Cloud Ubuntu VM (`152.67.91.217` / `https://toolify.ddns.net`) shall maintain a persistent `2 GB` `/swapfile`, serve static frontend assets directly via Nginx (`Option A`), and run the Express OAuth server under PM2 (`spotify-toolkit` on `127.0.0.1:8888`).
