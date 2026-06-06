/**
 * Global Logger Configuration
 * This file controls the verbosity and features of the backend logger.
 */

export const loggerConfig = {
  // Master switch for writing logs to the /logs/server.log file
  enableFileLogging: true,

  // Minimum log level to display. 
  // 0 = none, 1 = error, 2 = warn, 3 = info
  logLevel: 3,

  // Display toggles for the log prefix
  showTimestamp: true,
  showUser: true,
  showReqId: true,

  // Advanced Configurations
  enableConsoleLogging: true,           // Print logs to the terminal
  maxLogFileSize: 5 * 1024 * 1024,      // 5MB limit before file rollover
  logFullDataObjects: false,            // If false, truncates large JSON objects
  // --- Time & Geolocation ---
  // useLocalTime (Master Switch):
  // If false: Forces global UTC (Zulu) time (e.g. 2026-06-06T11:17:54Z). Safe for massive scaling.
  // If true: Prints human-readable local time without the 'T' and 'Z'.
  useLocalTime: true,
  
  // timeZone (Geolocation Lock):
  // If blank: The server just guesses the time based on the physical hardware it runs on.
  // If set: Mathematically locks the logs to a specific timezone (e.g., 'Africa/Cairo')
  // even if the server is physically deployed to New York or Tokyo.
  timeZone: 'Africa/Cairo',
};
