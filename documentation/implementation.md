# Implementation Details

## 1. Duplicate Review Interface
The UI for reviewing duplicates is implemented in `components/DuplicateReview.tsx`.

### Key Implementation Choices:
- **Ultra-Compact Mobile Layout**: To display complex metadata (Track Name, Playlist, Added Date, Duration, Listen Link) on small screens, the data is heavily flattened into a CSS flexbox row.
- **State Management (`decisions`)**: We maintain a React state dictionary tracking which `index` of a cluster the user has selected to keep.
- **Execution Flow**: When "Apply Changes" is clicked, we invert the user's "Keep" selection to generate a list of "Remove" targets, categorizing them by Playlist ID.

## 2. Rate Limit Handling
Spotify's API strictly enforces rate limits.
- In `useProcessingEngine.ts`, we implement a retry-loop with exponential backoff. If we receive a `429` status, we parse the `Retry-After` header (or default to 4 seconds) and halt the producer queue before retrying.

## 3. Track Deletion (Spotify API Quirks)
The deletion logic (`app/api/spotify/remove/route.ts`) handles a major Spotify API quirk:
- **Playlists**: Tracks must be deleted using `DELETE /v1/playlists/{id}/tracks` using their `uri` (spotify:track:123). Max 100 per request.
- **Liked Songs**: Tracks must be deleted using `DELETE /v1/me/tracks` using their `id` (123). Max 50 per request.
The implementation abstracts this quirk away from the UI.

## 4. Arabic Extraction & Strict Mode
The extraction engine (`lib/utils/arabicDetection.ts`) isolates Arabic tracks using regex, Franco-Arabic dictionaries, and Spotify genres.
- **Strict Mode**: Filters out false positives by ignoring underlying Spotify genres and generic Arabic character matches on artist names. It relies strictly on track-title text, known Franco-Arabic words, and a curated whitelist of VIP Known Artists.
- **Instant Filtering**: Tracks are cached locally in memory inside `useExtractEngine.ts`. When a user toggles Strict Mode at the end of a scan, the engine recalculates the filter instantly from memory without querying the Spotify API.
- **Blacklisting**: Generic artist names like "Various Artists" and "فنانون متنوعون" are globally blacklisted to prevent massive compilation albums from pulling in false-positive English tracks.
