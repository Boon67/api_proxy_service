const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'snowflake-api-proxy' },
  transports: [
    // Write all logs to a single file
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/backend.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}] ${message}`;
        // Add key metadata
        if (meta.requestId) msg += ` [${meta.requestId}]`;
        if (meta.error) msg += ` - Error: ${meta.error}`;
        if (meta.username) msg += ` - User: ${meta.username}`;
        return msg;
      })
    )
  }));
}

module.exports = logger;
