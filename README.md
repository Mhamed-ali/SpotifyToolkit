# 🎧 Spotify Toolkit 2.0

Welcome to **Spotify Toolkit 2.0**! A fast, powerful, and privacy-focused web application designed to help you deeply analyze, manage, and curate your Spotify playlists and Liked Songs. 

Version 2.0 introduces our state-of-the-art **Duplicate Processing Engine**, featuring fuzzy matching algorithms, cross-playlist comparisons, and intelligent deletion logic to keep your library completely clean.

---

## ✨ Key Features

* **🔒 Secure Spotify Login:** Connect directly and securely using your official Spotify account.
* **📚 Complete Library View:** Instantly view all your custom playlists and "Liked Songs" in a clean, highly responsive dark-mode dashboard that looks gorgeous on both phone and desktop.
* **👯 Advanced Deduplication Engine:**
    * **Strict & Fuzzy Matching:** Find exact duplicate Spotify IDs or use fuzzy matching (comparing normalized Track + Artist strings) to catch duplicates even if they are from different album releases.
    * **Duration Tolerance:** Slider to allow matching of fuzzy tracks that differ slightly in length (e.g., ±2 seconds).
    * **Deduplication Scopes:** Scan for duplicates *across* multiple selected playlists, or isolate the scan to run *per-playlist*.
    * **Intelligent Keep Strategies:** Automatically suggest keeping the "Oldest" or "Newest" version of a duplicate based on the date you added it to Spotify.
* **⚡ One-Click Purge:** Automatically removes unselected duplicate tracks in bulk via the Spotify API, using intelligent batch chunking to avoid rate limits.

---

## 🏗️ Architecture & Technology Stack

Built for speed and modern web standards:
* **Framework:** Next.js 15 (App Router)
* **Styling:** Tailwind CSS (Dark theme optimized with smooth micro-animations and responsive flex layouts)
* **API:** Secure Next.js Serverless Route Handlers
* **Language:** TypeScript

---

## 🚀 Running Locally (Testing Branches)

> **Note:** The local tunneling scripts are designed exclusively for the `testing` and `main` branches to facilitate local development. They are intentionally removed from the `production` branch.

We have built custom local tunnel scripts so you can easily run this app and authenticate with Spotify without worrying about configuring static `localhost` callback URIs every time you code.

**Prerequisites:** Node.js installed.

1. **Development Mode:**
   Run `start-dev.bat`. This automatically starts the Next.js dev server AND launches a LocalTunnel instance. It automatically injects the tunnel URL into your `.env.local` file so Spotify Auth works instantly.
   
2. **Local Production Mode:**
   Run `start-prod.bat`. This builds the Next.js optimized production bundle locally, starts it, and exposes it securely via a production LocalTunnel instance.

---

## 🛡️ Privacy First (Zero Data Storage)

Your privacy is our top priority. **Spotify Toolkit is completely stateless.** 
* **No Databases:** We do not store your Spotify profile, playlists, or listening history on any servers.
* **No Tracking:** Once you close the app, your session memory is completely wiped. 
* **Secure Connection (HttpOnly Cookies):** We use secure, encrypted `HttpOnly` cookies to store your temporary session token, ensuring it is inaccessible to third-party scripts. 
* **Transparent Permissions:** We only ask for the specific Spotify OAuth scopes needed to view and organize your music (`playlist-read-private`, `playlist-read-collaborative`, `user-library-read`, `playlist-modify-public`, `playlist-modify-private`). We cannot see your email or account password.