const config = require('../config');
const logger = require('./logger');

// Simple in-memory queue fallback if Redis is not available
class InMemoryQueue {
  constructor(name) {
    this.name = name;
    this.queue = [];
    this.processing = false;
  }

  async add(jobName, data, options = {}) {
    this.queue.push({ jobName, data, options, timestamp: Date.now() });
    logger.info(`Job added to ${this.name}`, { jobName, queueSize: this.queue.length });
    
    if (!this.processing) {
      this.process();
    }
    
    return { id: Date.now() };
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      
      try {
        logger.info(`Processing job from ${this.name}`, { jobName: job.jobName });
        // Job processing would happen here
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing
      } catch (error) {
        logger.error(`Job failed in ${this.name}`, {
          jobName: job.jobName,
          error: error.message,
        });
      }
    }
    
    this.processing = false;
  }
}

// Queue manager that uses Bull if available, otherwise falls back to in-memory
class QueueManager {
  constructor() {
    this.queues = new Map();
    this.useBull = config.features.backgroundJobs;
    
    if (this.useBull) {
      try {
        this.bullQueues = require('../queues');
        logger.info('Using Bull queues with Redis');
      } catch (error) {
        logger.warn('Bull queues not available, using in-memory fallback', {
          error: error.message,
        });
        this.useBull = false;
      }
    }
  }

  getQueue(name) {
    if (this.useBull && this.bullQueues && this.bullQueues[`${name}Queue`]) {
      return this.bullQueues[`${name}Queue`];
    }
    
    if (!this.queues.has(name)) {
      this.queues.set(name, new InMemoryQueue(name));
    }
    
    return this.queues.get(name);
  }

  async addJob(queueName, jobName, data, options = {}) {
    const queue = this.getQueue(queueName);
    return await queue.add(jobName, data, options);
  }
}

const queueManager = new QueueManager();

module.exports = queueManager;
