# Product Requirements Document (PRD)

## 1. Project Overview
**Spotify Toolkit 2.0** is a privacy-first web application built to help users seamlessly manage, analyze, and curate their Spotify playlists. The primary goal is to provide advanced power-user features—like duplicate detection and specialized track extraction—without requiring users to surrender their data to third-party databases.

## 2. Core Features

### 2.1. Advanced Deduplication
- **Fuzzy Matching**: Detect duplicates even when titles/artists are slightly different (e.g., "Remastered" versions, Live cuts).
- **Duration Tolerance**: Option to configure a ± second tolerance for matching tracks.
- **Cross-Playlist vs. Per-Playlist Scopes**: Ability to deduplicate within a single playlist or across multiple playlists simultaneously.
- **Keep Strategies**: Intelligent suggestions to automatically keep either the oldest or newest version of a duplicated track based on `added_at` dates.

### 2.2. Specialized Filtering (e.g., Language Extraction)
- Capability to extract tracks based on language characteristics (like Arabic tracks) from massive library collections.
- Ability to instantly compile the extracted results into brand-new playlists on the user's account.

### 2.3. Bulk Actions
- **Execution Engine**: Apply deletions or creations in bulk.
- Handle Spotify API Rate Limiting gracefully during mass-deletions or mass-additions.

## 3. Non-Functional Requirements
- **Privacy First (Stateless)**: No databases. The application must not store user profiles, track data, or tokens on external servers. All operations happen in-memory and via secure `HttpOnly` cookies.
- **Responsive Design**: The UI must look beautiful and native on both mobile and desktop screens.
- **Performance**: High-speed processing engine that uses chunked concurrent fetching to analyze playlists of 10,000+ songs efficiently.
- **Dark Mode**: A sleek, modern dark-mode aesthetic.
