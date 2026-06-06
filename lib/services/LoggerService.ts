import fs from 'fs';
import path from 'path';
import { ILoggerService, LoggerMeta } from '../interfaces/ILoggerService';
import { loggerConfig } from '../config/logger.config';

export class LoggerService implements ILoggerService {
  private logDirectory: string;
  private logFilePath: string;
  private isFileLoggingEnabled: boolean;
  private logLevel: number;
  private showTimestamp: boolean;
  private showUser: boolean;
  private showReqId: boolean;
  private enableConsoleLogging: boolean;
  private maxLogFileSize: number;
  private logFullDataObjects: boolean;
  private useLocalTime: boolean;
  private timeZone: string | undefined;

  constructor() {
    this.logDirectory = path.join(process.cwd(), 'logs');
    this.logFilePath = path.join(this.logDirectory, 'server.log');

    // Read Configuration from TS file
    this.isFileLoggingEnabled = loggerConfig.enableFileLogging;
    this.showTimestamp = loggerConfig.showTimestamp;
    this.showUser = loggerConfig.showUser;
    this.showReqId = loggerConfig.showReqId;
    this.logLevel = loggerConfig.logLevel;
    this.enableConsoleLogging = loggerConfig.enableConsoleLogging;
    this.maxLogFileSize = loggerConfig.maxLogFileSize;
    this.logFullDataObjects = loggerConfig.logFullDataObjects;
    this.useLocalTime = loggerConfig.useLocalTime;
    this.timeZone = loggerConfig.timeZone;

    // Ensure the logs directory exists on instantiation if file logging is enabled
    if (this.isFileLoggingEnabled && !fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  private formatMessage(level: string, message: string, data?: any, meta?: LoggerMeta): string {
    let prefix = `[${level}]`;
    if (this.showTimestamp) {
      const now = new Date();
      let timestamp = '';
      if (this.useLocalTime) {
        if (this.timeZone) {
          try {
            const formatter = new Intl.DateTimeFormat('en-CA', {
              timeZone: this.timeZone,
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              fractionalSecondDigits: 3, hour12: false
            });
            const formattedTime = formatter.format(now).replace(', ', ' ');
            const location = this.timeZone.split('/').pop() || this.timeZone;
            timestamp = `${formattedTime} [${location}]`;
          } catch (e) {
            // Bulletproof Fallback if server Node.js lacks ICU tzdata
            if (this.timeZone === 'Africa/Cairo') {
              const cairoOffset = 3 * 60 * 60000; // UTC+3
              const localISOTime = (new Date(now.getTime() + cairoOffset)).toISOString().slice(0, -1);
              timestamp = `${localISOTime.replace('T', ' ')} [Cairo]`;
            } else {
              timestamp = now.toISOString();
            }
          }
        } else {
          // Format as YYYY-MM-DD HH:mm:ss.SSS (Local Computer Time)
          const tzOffset = now.getTimezoneOffset() * 60000;
          const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, -1);
          timestamp = localISOTime.replace('T', ' ');
        }
      } else {
        timestamp = now.toISOString();
      }
      prefix = `[${timestamp}] ` + prefix;
    }
    if (this.showUser && meta?.user) prefix += ` [User: ${meta.user}]`;
    if (this.showReqId && meta?.reqId) prefix += ` [${meta.reqId}]`;
    
    let formatted = `${prefix} ${message}`;
    
    if (data !== undefined) {
      if (data instanceof Error) {
        formatted += `\n${data.stack || data.message}`;
      } else if (typeof data === 'object') {
        if (this.logFullDataObjects) {
          formatted += `\n${JSON.stringify(data, null, 2)}`;
        } else {
          // Truncate large objects
          const typeName = data.constructor ? data.constructor.name : 'Object';
          formatted += ` - [${typeName} Data truncated]`;
        }
      } else {
        formatted += ` - ${data}`;
      }
    }
    return formatted + '\n';
  }

  private writeToFile(logData: string): void {
    if (!this.isFileLoggingEnabled) return;

    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        if (stats.size >= this.maxLogFileSize) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          fs.renameSync(this.logFilePath, path.join(this.logDirectory, `server-${timestamp}.log`));
        }
      }
      fs.appendFileSync(this.logFilePath, logData, 'utf8');
    } catch (err) {
      console.error('CRITICAL: Failed to write to log file:', err);
    }
  }

  public info(message: string, context?: any, meta?: LoggerMeta): void {
    if (this.logLevel < 3) return;
    const logData = this.formatMessage('INFO', message, context, meta);
    if (this.enableConsoleLogging) console.log(logData.trim());
    this.writeToFile(logData);
  }

  public warn(message: string, context?: any, meta?: LoggerMeta): void {
    if (this.logLevel < 2) return;
    const logData = this.formatMessage('WARN', message, context, meta);
    if (this.enableConsoleLogging) console.warn(logData.trim());
    this.writeToFile(logData);
  }

  public error(message: string, error?: any, meta?: LoggerMeta): void {
    if (this.logLevel < 1) return;
    const logData = this.formatMessage('ERROR', message, error, meta);
    if (this.enableConsoleLogging) console.error(logData.trim());
    this.writeToFile(logData);
  }
}
