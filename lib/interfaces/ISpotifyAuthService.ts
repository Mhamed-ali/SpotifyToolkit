import { TokenResponse } from '../types/spotify';

export interface ISpotifyAuthService {
  getAuthorizationUrl(state: string): string;
  exchangeCodeForToken(code: string): Promise<TokenResponse>;
}
