export interface LoggerMeta {
  user?: string;
  reqId?: string;
}

export interface ILoggerService {
  info(message: string, context?: any, meta?: LoggerMeta): void;
  warn(message: string, context?: any, meta?: LoggerMeta): void;
  error(message: string, error?: any, meta?: LoggerMeta): void;
}
