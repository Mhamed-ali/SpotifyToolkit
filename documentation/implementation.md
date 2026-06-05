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

## 3. Local Development Tunnels (Testing Branches Only)
Spotify OAuth requires exact URL whitelisting (e.g., `http://localhost:3000/api/auth/callback`). To avoid constant Spotify Dashboard reconfiguration when sharing links or testing on mobile during development, we built testing scripts:
- `scripts/dev-tunnel.mjs`
- `scripts/prod-tunnel.mjs`

These scripts launch `localtunnel` to give the app a stable public URL (e.g., `https://spotifytoolkit.loca.lt`) and dynamically inject this URL into the Next.js `.env.local` environment. 
*Note: These scripts are excluded from the `production` branch and are only intended for use on `testing` or `main` branches.*

## 4. Track Deletion (Spotify API Quirks)
The deletion logic (`app/api/spotify/remove/route.ts`) handles a major Spotify API quirk:
- **Playlists**: Tracks must be deleted using `DELETE /v1/playlists/{id}/tracks` using their `uri` (spotify:track:123). Max 100 per request.
- **Liked Songs**: Tracks must be deleted using `DELETE /v1/me/tracks` using their `id` (123). Max 50 per request.
The implementation abstracts this quirk away from the UI.
