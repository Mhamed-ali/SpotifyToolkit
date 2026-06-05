import { cookies } from 'next/headers';
import { ISessionManager } from '../interfaces/ISessionManager';

export class SessionManager implements ISessionManager {
  private static readonly STATE_COOKIE_NAME = 'spotify_auth_state';
  private static readonly ACCESS_TOKEN_COOKIE = 'spotify_access_token';
  private static readonly REFRESH_TOKEN_COOKIE = 'spotify_refresh_token';

  /**
   * Generates a CSRF state, stores it securely, and returns it.
   */
  public async createCsrfState(): Promise<string> {
    const state = crypto.randomUUID();
    const cookieStore = await cookies();
    
    cookieStore.set(SessionManager.STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 3600, // 1 hour
    });

    return state;
  }

  /**
   * Validates the provided state against the stored cookie, then deletes the cookie.
   */
  public async verifyCsrfState(stateToVerify: string | null): Promise<boolean> {
    const cookieStore = await cookies();
    const storedState = cookieStore.get(SessionManager.STATE_COOKIE_NAME)?.value;

    if (!stateToVerify || stateToVerify !== storedState) {
      return false;
    }

    // Clear single-use state cookie
    cookieStore.delete(SessionManager.STATE_COOKIE_NAME);
    return true;
  }

  /**
   * Securely stores OAuth tokens in HttpOnly cookies.
   */
  public async createSession(accessToken: string, refreshToken?: string, expiresIn: number = 3600): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.set(SessionManager.ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: expiresIn,
    });

    if (refreshToken) {
      cookieStore.set(SessionManager.REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }
  }
}
