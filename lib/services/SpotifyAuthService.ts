import { TokenResponse } from '../types/spotify';
import { ISpotifyAuthService } from '../interfaces/ISpotifyAuthService';

export class SpotifyAuthService implements ISpotifyAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private scopes = 'user-library-read playlist-read-private playlist-modify-public playlist-modify-private';

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || '';

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('Missing Spotify environment variables.');
    }
  }

  /**
   * Constructs the official Spotify authorization URL.
   */
  public getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: this.scopes,
      redirect_uri: this.redirectUri,
      state: state,
      show_dialog: 'true', // Forces Spotify to show the approval screen every time
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for an access token via Spotify Accounts API.
   */
  public async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    const tokenParams = new URLSearchParams({
      code: code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`,
      },
      body: tokenParams.toString(),
    });

    const tokenData = (await tokenResponse.json()) as TokenResponse;

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    return tokenData;
  }
}
