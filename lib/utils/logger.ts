// Minimal logger optimized for Vercel: debug is no-op, info only in dev,
// warn/error always print with light formatting.
class Logger {
  debug(_message: string, _context?: Record<string, unknown>) {
    // Intentionally no-op to keep logs quiet in serverless
  }

  info(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[INFO]', message, context || '');
    }
  }

  warn(message: string, context?: Record<string, unknown>) {
    console.warn('[WARN]', message, context || '');
  }

  error(message: string, error?: Error, context?: Record<string, unknown>) {
    if (error) {
      console.error('[ERROR]', message, error.message, context || '');
    } else {
      console.error('[ERROR]', message, context || '');
    }
  }
}

export const logger = new Logger();
