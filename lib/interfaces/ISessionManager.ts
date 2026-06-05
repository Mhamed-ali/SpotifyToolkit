export interface ISessionManager {
  createCsrfState(): Promise<string>;
  verifyCsrfState(stateToVerify: string | null): Promise<boolean>;
  createSession(accessToken: string, refreshToken?: string, expiresIn?: number): Promise<void>;
}
