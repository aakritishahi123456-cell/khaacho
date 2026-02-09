const Queue = require('bull');
const logger = require('../utils/logger');
const config = require('../config');

// Queue configuration - support both REDIS_URL and individual settings
const REDIS_CONFIG = config.redis.url 
  ? config.redis.url // Use REDIS_URL if available (Render format)
  : {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

// Default job options
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 500, // Keep last 500 failed jobs
};

// Queue definitions
const QUEUES = {
  WHATSAPP: 'whatsapp-messages',
  CREDIT_SCORE: 'credit-score-calculation',
  ORDER_ROUTING: 'order-routing',
  PAYMENT_REMINDERS: 'payment-reminders',
  REPORT_GENERATION: 'report-generation',
  EMAIL: 'email-notifications',
  ORDER_PROCESSING: 'order-processing',
};

class QueueManager {
  constructor() {
    this.queues = {};
    this.processors = {};
  }

  /**
   * Initialize all queues
   */
  initialize() {
    logger.info('Initializing queue manager...');

    // Create all queues
    Object.entries(QUEUES).forEach(([key, queueName]) => {
      this.queues[key] = new Queue(queueName, {
        redis: REDIS_CONFIG,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });

      // Setup event listeners
      this.setupQueueEvents(this.queues[key], queueName);
    });

    logger.info(`Initialized ${Object.keys(this.queues).length} queues`);
  }

  /**
   * Setup event listeners for a queue
   */
  setupQueueEvents(queue, queueName) {
    queue.on('error', (error) => {
      logger.error(`Queue ${queueName} error`, {
        error: error.message,
        stack: error.stack,
      });
    });

    queue.on('waiting', (jobId) => {
      logger.debug(`Job ${jobId} is waiting in queue ${queueName}`);
    });

    queue.on('active', (job) => {
      logger.info(`Job ${job.id} started in queue ${queueName}`, {
        jobData: job.data,
      });
    });

    queue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed in queue ${queueName}`, {
        duration: Date.now() - job.timestamp,
        result: result,
      });
    });

    queue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} failed in queue ${queueName}`, {
        error: error.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        jobData: job.data,
      });
    });

    queue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} stalled in queue ${queueName}`);
    });
  }

  /**
   * Register a processor for a queue
   */
  registerProcessor(queueKey, processor, concurrency = 1) {
    if (!this.queues[queueKey]) {
      throw new Error(`Queue ${queueKey} not found`);
    }

    this.processors[queueKey] = processor;
    this.queues[queueKey].process(concurrency, processor);

    logger.info(`Registered processor for queue ${queueKey} with concurrency ${concurrency}`);
  }

  /**
   * Add a job to a queue
   */
  async addJob(queueKey, jobName, data, options = {}) {
    if (!this.queues[queueKey]) {
      throw new Error(`Queue ${queueKey} not found`);
    }

    const jobOptions = {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
      jobId: options.jobId || `${jobName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Check for duplicate if deduplication is enabled
    if (options.deduplicate && options.deduplicationKey) {
      const existingJob = await this.queues[queueKey].getJob(options.deduplicationKey);
      if (existingJob) {
        const state = await existingJob.getState();
        if (state === 'waiting' || state === 'active' || state === 'delayed') {
          logger.info(`Duplicate job detected, skipping: ${options.deduplicationKey}`);
          return existingJob;
        }
      }
      jobOptions.jobId = options.deduplicationKey;
    }

    const job = await this.queues[queueKey].add(jobName, data, jobOptions);

    logger.info(`Added job ${job.id} to queue ${queueKey}`, {
      jobName,
      data,
    });

    return job;
  }

  /**
   * Get queue by key
   */
  getQueue(queueKey) {
    return this.queues[queueKey];
  }

  /**
   * Get job counts for a queue
   */
  async getQueueCounts(queueKey) {
    if (!this.queues[queueKey]) {
      throw new Error(`Queue ${queueKey} not found`);
    }

    return await this.queues[queueKey].getJobCounts();
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats() {
    const stats = {};

    for (const [key, queue] of Object.entries(this.queues)) {
      stats[key] = {
        name: queue.name,
        counts: await queue.getJobCounts(),
        isPaused: await queue.isPaused(),
      };
    }

    return stats;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueKey) {
    if (!this.queues[queueKey]) {
      throw new Error(`Queue ${queueKey} not found`);
    }

    await this.queues[queueKey].pause();
    logger.info(`Queue ${queueKey} paused`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueKey) {
    if (!this.queues[queueKey]) {
      throw new Error(`Queue ${queueKey} not found`);
    }

    await this.queues[queueKey].resume();
    logger.info(`Queue ${queueKey} resumed`);
  }

  /**
   * Clean old jobs from a queue
   */
  async cleanQueue(queueKey, grace = 24 * 3600 * 1000, status = 'completed') {
    if (!this.queues[queueKey]) {
      throw new Error(`Queue ${queueKey} not found`);
    }

    const jobs = await this.queues[queueKey].clean(grace, status);
    logger.info(`Cleaned ${jobs.length} ${status} jobs from queue ${queueKey}`);
    return jobs;
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(queueKey, start = 0, end = 10) {
    if (!this.queues[queueKey]) {
      throw new Error(`Queue ${queueKey} not found`);
    }

    return await this.queues[queueKey].getFailed(start, end);
  }

  /**
   * Retry a failed job
   */
  async retryJob(queueKey, jobId) {
    if (!this.queues[queueKey]) {
      throw new Error(`Queue ${queueKey} not found`);
    }

    const job = await this.queues[queueKey].getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    logger.info(`Retrying job ${jobId} in queue ${queueKey}`);
    return job;
  }

  /**
   * Remove a job
   */
  async removeJob(queueKey, jobId) {
    if (!this.queues[queueKey]) {
      throw new Error(`Queue ${queueKey} not found`);
    }

    const job = await this.queues[queueKey].getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.remove();
    logger.info(`Removed job ${jobId} from queue ${queueKey}`);
  }

  /**
   * Close all queues
   */
  async closeAll() {
    logger.info('Closing all queues...');

    const closePromises = Object.values(this.queues).map(queue => queue.close());
    await Promise.all(closePromises);

    logger.info('All queues closed');
  }
}

// Export singleton instance
const queueManager = new QueueManager();

module.exports = {
  queueManager,
  QUEUES,
  REDIS_CONFIG,
};
