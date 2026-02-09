const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

// Connection pool configuration for production
const prismaConfig = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
};

// Create Prisma client with connection pooling
const prisma = new PrismaClient(prismaConfig);

// Log slow queries (> 1 second)
prisma.$on('query', (e) => {
  if (e.duration > 1000) {
    logger.warn('Slow query detected', {
      query: e.query,
      duration: `${e.duration}ms`,
      params: e.params,
    });
  }
});

// Log errors
prisma.$on('error', (e) => {
  logger.error('Database error', {
    message: e.message,
    target: e.target,
  });
});

// Log warnings
prisma.$on('warn', (e) => {
  logger.warn('Database warning', {
    message: e.message,
  });
});

// Connection pool health check
async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection healthy');
    return true;
  } catch (error) {
    logger.error('Database connection failed', {
      error: error.message,
    });
    return false;
  }
}

// Graceful shutdown
async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting database', {
      error: error.message,
    });
  }
}

// Connection pool statistics
async function getConnectionPoolStats() {
  try {
    const result = await prisma.$queryRaw`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        max(state_change) as last_activity
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;
    
    return result[0];
  } catch (error) {
    logger.error('Error getting connection pool stats', {
      error: error.message,
    });
    return null;
  }
}

// Database size and statistics
async function getDatabaseStats() {
  try {
    const sizeResult = await prisma.$queryRaw`
      SELECT pg_size_pretty(pg_database_size(current_database())) as database_size
    `;
    
    const tableStats = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 10
    `;
    
    return {
      databaseSize: sizeResult[0].database_size,
      largestTables: tableStats,
    };
  } catch (error) {
    logger.error('Error getting database stats', {
      error: error.message,
    });
    return null;
  }
}

module.exports = prisma;
module.exports.checkDatabaseConnection = checkDatabaseConnection;
module.exports.disconnectDatabase = disconnectDatabase;
module.exports.getConnectionPoolStats = getConnectionPoolStats;
module.exports.getDatabaseStats = getDatabaseStats;
