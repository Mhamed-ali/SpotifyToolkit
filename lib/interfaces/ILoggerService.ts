export interface ILoggerService {
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, error?: any): void;
}
