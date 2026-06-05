# Upcoming Features & Roadmap

While Spotify Toolkit 2.0 covers the core Duplicate Engine and Library Management, there are several exciting avenues for future development:

## 1. Multi-Language AI Filtering
- Currently, the app isolates Arabic tracks based on character sets. In the future, we can implement lightweight local AI or NLP categorization to isolate tracks based on multiple languages (French, Spanish, Japanese, etc.) without relying on metadata alone.

## 2. Deep Audio-Feature Deduplication
- Spotify provides an Audio Features API (tempo, danceability, acousticness, energy).
- We can implement a mode that flags tracks that *sound* identical or have the exact same BPM and key, helping DJs deduplicate their massive setlist libraries.

## 3. Smart Playlist Generation
- Auto-generate "Decade" playlists (e.g., pulling all 80s songs from a user's library into a new playlist).
- Generate "Mood" playlists by categorizing the user's Liked Songs using the Audio Features API.

## 4. CSV Library Export
- Implement a feature allowing users to download their entire Spotify library metadata (Track, Artist, Album, Added Date, ISRC) as a clean `.csv` file for personal backup or data analysis.

## 5. Offline Caching Mode
- Currently, the app downloads tracks into memory and wipes them when the tab closes.
- Future versions could leverage `IndexedDB` in the browser to cache library metadata for a few hours, dramatically speeding up subsequent deduplication scans without compromising the "No Server Database" privacy promise.
