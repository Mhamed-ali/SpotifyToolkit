import { ISessionManager } from '../interfaces/ISessionManager';
import { ISpotifyAuthService } from '../interfaces/ISpotifyAuthService';
import { ISpotifyApiService } from '../interfaces/ISpotifyApiService';
import { ILoggerService } from '../interfaces/ILoggerService';

import { SessionManager } from '../services/SessionManager';
import { SpotifyAuthService } from '../services/SpotifyAuthService';
import { SpotifyApiService } from '../services/SpotifyApiService';
import { LoggerService } from '../services/LoggerService';

/**
 * ServiceFactory acting as a basic Dependency Injection container.
 * This decouples API routes (Controllers) from concrete class implementations,
 * fulfilling the Dependency Inversion Principle.
 */
export class ServiceFactory {
  // Singleton instance for the logger
  private static loggerInstance: ILoggerService;

  public static getLoggerService(): ILoggerService {
    if (!this.loggerInstance) {
      this.loggerInstance = new LoggerService();
    }
    return this.loggerInstance;
  }

  public static getSessionManager(): ISessionManager {
    return new SessionManager();
  }

  public static getSpotifyAuthService(): ISpotifyAuthService {
    return new SpotifyAuthService();
  }

  public static getSpotifyApiService(accessToken: string): ISpotifyApiService {
    return new SpotifyApiService(accessToken, this.getLoggerService());
  }
}
