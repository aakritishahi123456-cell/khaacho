const Queue = require('bull');
const config = require('../config');
const logger = require('../utils/logger');

// Redis connection for Bull queues
const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// WhatsApp notification queue (high priority)
const whatsappQueue = new Queue('whatsapp-notifications', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Order processing queue
const orderQueue = new Queue('order-processing', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Credit calculation queue (low priority, can be delayed)
const creditQueue = new Queue('credit-calculations', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 10000,
    },
    removeOnComplete: 50,
    removeOnFail: 200,
  },
});

// Analytics queue (lowest priority)
const analyticsQueue = new Queue('analytics', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 20,
    removeOnFail: 100,
  },
});

// Queue event handlers
const setupQueueEvents = (queue, queueName) => {
  queue.on('completed', (job) => {
    logger.info(`${queueName} job completed`, {
      jobId: job.id,
      duration: Date.now() - job.timestamp,
    });
  });

  queue.on('failed', (job, err) => {
    logger.error(`${queueName} job failed`, {
      jobId: job.id,
      error: err.message,
      attempts: job.attemptsMade,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`${queueName} job stalled`, {
      jobId: job.id,
    });
  });
};

setupQueueEvents(whatsappQueue, 'WhatsApp');
setupQueueEvents(orderQueue, 'Order');
setupQueueEvents(creditQueue, 'Credit');
setupQueueEvents(analyticsQueue, 'Analytics');

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Closing queues...');
  await Promise.all([
    whatsappQueue.close(),
    orderQueue.close(),
    creditQueue.close(),
    analyticsQueue.close(),
  ]);
  logger.info('All queues closed');
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = {
  whatsappQueue,
  orderQueue,
  creditQueue,
  analyticsQueue,
};
