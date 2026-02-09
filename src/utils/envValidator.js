const logger = require('./logger');

/**
 * Environment Variable Validator
 * Validates all required environment variables on startup
 */

const REQUIRED_ENV_VARS = {
  // Server
  NODE_ENV: {
    required: true,
    type: 'string',
    allowedValues: ['development', 'production', 'test'],
    description: 'Application environment',
  },
  PORT: {
    required: true,
    type: 'number',
    description: 'Server port',
  },
  API_VERSION: {
    required: true,
    type: 'string',
    description: 'API version',
  },

  // Database
  DATABASE_URL: {
    required: true,
    type: 'string',
    pattern: /^postgresql:\/\/.+/,
    description: 'PostgreSQL connection string',
  },

  // Redis
  REDIS_HOST: {
    required: true,
    type: 'string',
    description: 'Redis host',
  },
  REDIS_PORT: {
    required: true,
    type: 'number',
    description: 'Redis port',
  },

  // JWT
  JWT_SECRET: {
    required: true,
    type: 'string',
    minLength: 32,
    description: 'JWT secret key (min 32 characters)',
  },
  JWT_EXPIRES_IN: {
    required: true,
    type: 'string',
    description: 'JWT expiration time',
  },

  // WhatsApp
  WHATSAPP_VERIFY_TOKEN: {
    required: true,
    type: 'string',
    minLength: 16,
    description: 'WhatsApp webhook verification token',
  },

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: {
    required: false,
    type: 'number',
    default: 900000,
    description: 'Rate limit window in milliseconds',
  },
  RATE_LIMIT_MAX_REQUESTS: {
    required: false,
    type: 'number',
    default: 100,
    description: 'Maximum requests per window',
  },
};

/**
 * Validate environment variable type
 */
function validateType(value, type) {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return !isNaN(Number(value));
    case 'boolean':
      return value === 'true' || value === 'false';
    default:
      return true;
  }
}

/**
 * Validate environment variable value
 */
function validateValue(key, value, config) {
  const errors = [];

  // Check type
  if (!validateType(value, config.type)) {
    errors.push(`${key} must be of type ${config.type}`);
    return errors;
  }

  // Convert to correct type
  let convertedValue = value;
  if (config.type === 'number') {
    convertedValue = Number(value);
  } else if (config.type === 'boolean') {
    convertedValue = value === 'true';
  }

  // Check allowed values
  if (config.allowedValues && !config.allowedValues.includes(convertedValue)) {
    errors.push(`${key} must be one of: ${config.allowedValues.join(', ')}`);
  }

  // Check pattern
  if (config.pattern && !config.pattern.test(value)) {
    errors.push(`${key} does not match required pattern`);
  }

  // Check min length
  if (config.minLength && value.length < config.minLength) {
    errors.push(`${key} must be at least ${config.minLength} characters long`);
  }

  // Check max length
  if (config.maxLength && value.length > config.maxLength) {
    errors.push(`${key} must be at most ${config.maxLength} characters long`);
  }

  return errors;
}

/**
 * Validate all environment variables
 */
function validateEnvironment() {
  const errors = [];
  const warnings = [];

  logger.info('Validating environment variables...');

  // Check each required variable
  for (const [key, config] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[key];

    // Check if required variable is missing
    if (config.required && !value) {
      errors.push(`Missing required environment variable: ${key} - ${config.description}`);
      continue;
    }

    // Use default if not provided
    if (!value && config.default !== undefined) {
      process.env[key] = String(config.default);
      warnings.push(`Using default value for ${key}: ${config.default}`);
      continue;
    }

    // Validate value if provided
    if (value) {
      const validationErrors = validateValue(key, value, config);
      errors.push(...validationErrors);
    }
  }

  // Production-specific checks
  if (process.env.NODE_ENV === 'production') {
    // Check JWT secret strength
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
      warnings.push('JWT_SECRET should be at least 64 characters in production');
    }

    // Check if using default/weak values
    const weakSecrets = ['secret', 'password', 'admin', 'test', '123456'];
    if (process.env.JWT_SECRET && weakSecrets.some(weak => process.env.JWT_SECRET.toLowerCase().includes(weak))) {
      errors.push('JWT_SECRET appears to be weak or default value in production');
    }

    // Check WhatsApp token strength
    if (process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_VERIFY_TOKEN.length < 32) {
      warnings.push('WHATSAPP_VERIFY_TOKEN should be at least 32 characters in production');
    }

    // Check database URL doesn't use default password
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('password')) {
      warnings.push('DATABASE_URL appears to contain default password');
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn('Environment validation warnings:', { warnings });
  }

  // If errors, throw
  if (errors.length > 0) {
    logger.error('Environment validation failed:', { errors });
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  logger.info('Environment validation passed');
  return true;
}

/**
 * Get environment info (safe for logging)
 */
function getEnvironmentInfo() {
  return {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    apiVersion: process.env.API_VERSION,
    databaseConfigured: !!process.env.DATABASE_URL,
    redisConfigured: !!process.env.REDIS_HOST && !!process.env.REDIS_PORT,
    jwtConfigured: !!process.env.JWT_SECRET,
    whatsappConfigured: !!process.env.WHATSAPP_VERIFY_TOKEN,
  };
}

module.exports = {
  validateEnvironment,
  getEnvironmentInfo,
};
