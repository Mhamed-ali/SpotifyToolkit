import fs from 'fs';
import path from 'path';
import { ILoggerService } from '../interfaces/ILoggerService';

export class LoggerService implements ILoggerService {
  private logDirectory: string;
  private logFilePath: string;
  private isFileLoggingEnabled: boolean;
  private logLevel: number;

  private static readonly LEVELS: Record<string, number> = {
    'none': 0,
    'error': 1,
    'warn': 2,
    'info': 3,
  };

  constructor() {
    this.logDirectory = path.join(process.cwd(), 'logs');
    this.logFilePath = path.join(this.logDirectory, 'server.log');

    // Read Configuration from Environment Variables
    this.isFileLoggingEnabled = process.env.ENABLE_FILE_LOGGING !== 'false';
    
    const envLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
    this.logLevel = LoggerService.LEVELS[envLevel] ?? 3; // Default to 'info'

    // Ensure the logs directory exists on instantiation if file logging is enabled
    if (this.isFileLoggingEnabled && !fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level}] ${message}`;
    
    if (data !== undefined) {
      if (data instanceof Error) {
        formatted += `\n${data.stack || data.message}`;
      } else if (typeof data === 'object') {
        formatted += `\n${JSON.stringify(data, null, 2)}`;
      } else {
        formatted += ` - ${data}`;
      }
    }
    return formatted + '\n';
  }

  private writeToFile(logData: string): void {
    if (!this.isFileLoggingEnabled) return;

    // Using synchronous append for simplicity in this MVP to avoid complex locking mechanisms,
    // though async fs.promises.appendFile is preferred in highly concurrent production environments.
    try {
      fs.appendFileSync(this.logFilePath, logData, 'utf8');
    } catch (err) {
      console.error('CRITICAL: Failed to write to log file:', err);
    }
  }

  public info(message: string, context?: any): void {
    if (this.logLevel < 3) return;
    const logData = this.formatMessage('INFO', message, context);
    console.log(logData.trim());
    this.writeToFile(logData);
  }

  public warn(message: string, context?: any): void {
    if (this.logLevel < 2) return;
    const logData = this.formatMessage('WARN', message, context);
    console.warn(logData.trim());
    this.writeToFile(logData);
  }

  public error(message: string, error?: any): void {
    if (this.logLevel < 1) return;
    const logData = this.formatMessage('ERROR', message, error);
    console.error(logData.trim());
    this.writeToFile(logData);
  }
}
