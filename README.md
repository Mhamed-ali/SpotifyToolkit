# 🎧 Spotify Toolkit 2.0

Welcome to **Spotify Toolkit 2.0**! A fast, powerful, and privacy-focused web application designed to help you deeply analyze, manage, and curate your Spotify playlists and Liked Songs. 

Version 2.0 introduces our state-of-the-art **Duplicate Processing Engine**, featuring fuzzy matching algorithms, cross-playlist comparisons, and intelligent deletion logic to keep your library completely clean.

---

## 🌐 Live Demo
Version 0.2 is currently deployed and running live on an Oracle VM instance.
**Try it here:** [https://toolify.ddns.net/](https://toolify.ddns.net/) *(Note: If you need access, please contact me.)*

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

## 🚀 Running Locally

**Prerequisites:** Node.js installed.

1. **Development Mode:**
   Run `npm run dev`. This automatically starts the Next.js dev server on `http://localhost:3000`.
   
2. **Local Production Mode:**
   Run `npm run build` followed by `npm start`. This builds the Next.js optimized production bundle locally and serves it on port 3000.

---

## 🛡️ Privacy First (Zero Data Storage)

Your privacy is our top priority. **Spotify Toolkit is completely stateless.** 
* **No Databases:** We do not store your Spotify profile, playlists, or listening history on any servers.
* **No Tracking:** Once you close the app, your session memory is completely wiped. 
* **Secure Connection (HttpOnly Cookies):** We use secure, encrypted `HttpOnly` cookies to store your temporary session token, ensuring it is inaccessible to third-party scripts. 
* **Transparent Permissions:** We only ask for the specific Spotify OAuth scopes needed to view and organize your music (`playlist-read-private`, `playlist-read-collaborative`, `user-library-read`, `playlist-modify-public`, `playlist-modify-private`). We cannot see your email or account password.