/**
 * Application-wide configuration and utility functions.
 */

/**
 * Returns the base Frontend URI for safe redirects, prioritizing the environment variable
 * to ensure robust URL resolution across different deployment environments.
 */
export function getFrontendUri(request?: Request): string {
  if (process.env.FRONTEND_URI) {
    return process.env.FRONTEND_URI;
  }
  if (request) {
    return new URL('/', request.url).toString();
  }
  return 'http://localhost:3000';
}
