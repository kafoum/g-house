/**
 * Simple structured logger
 * Can be extended to use Winston or Pino in the future
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Format log message with timestamp and level
 */
function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logObject = {
    timestamp,
    level,
    message,
    ...meta
  };
  
  if (isDevelopment) {
    // Pretty print in development
    console.log(`[${timestamp}] ${level}: ${message}`, 
      Object.keys(meta).length > 0 ? meta : '');
  } else {
    // JSON format in production
    console.log(JSON.stringify(logObject));
  }
}

const logger = {
  error: (message, meta) => formatLog(LOG_LEVELS.ERROR, message, meta),
  warn: (message, meta) => formatLog(LOG_LEVELS.WARN, message, meta),
  info: (message, meta) => formatLog(LOG_LEVELS.INFO, message, meta),
  debug: (message, meta) => {
    if (isDevelopment) {
      formatLog(LOG_LEVELS.DEBUG, message, meta);
    }
  }
};

module.exports = logger;
