# Architecture Overview

## 1. Technology Stack
* **Framework**: Next.js 15 (App Router)
* **Language**: TypeScript
* **Styling**: Tailwind CSS
* **Authentication**: Spotify OAuth 2.0 via secure serverless routes

## 2. High-Level System Architecture
Spotify Toolkit is a completely **Stateless Client-Server Architecture**.
1. **Client (Browser)**: Handles UI state, the execution engine queues, and the clustering algorithms.
2. **Server (Next.js API Routes)**: Acts purely as a secure proxy to the official Spotify Web API.

By funneling all requests through the Next.js API (`/api/spotify/*`), we ensure the user's Access Token is never exposed to the frontend JavaScript. It remains securely tucked inside an `HttpOnly` encrypted cookie.

## 3. Core Modules

### 3.1. Authentication Layer
* `app/api/auth/login`: Redirects user to Spotify OAuth portal.
* `app/api/auth/callback`: Receives the OAuth code, exchanges it for an Access Token, and securely sets it as an `HttpOnly` cookie.

### 3.2. Spotify Service Layer
* `lib/services/SpotifyApiService.ts`: A robust service class responsible for talking to the Spotify API. It handles fetching playlists, paginating through thousands of tracks, and executing deletion requests.

### 3.3. Processing Engine
* `hooks/useProcessingEngine.ts`: A custom React hook that orchestrates the massive background downloading of tracks. It uses a **Producer-Consumer Concurrency Model** to fetch tracks in chunks (e.g., 30 concurrent requests of 100 tracks each) while gracefully respecting Spotify's `429 Too Many Requests` rate limits.

### 3.4. Clustering Engine
* `lib/utils/clustering.ts`: The mathematical brain of the deduplication. It normalizes text (removing "Remastered", "Live", punctuation) and uses exact and fuzzy matching heuristics to group identical songs into `TrackCluster` objects.
