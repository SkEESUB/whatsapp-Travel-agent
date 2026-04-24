// Message Queue Configuration
// BullMQ queue for processing WhatsApp messages asynchronously

const { Queue } = require('bullmq');
const logger = require('../config/logger');
const { getRedisClient, isRedisConnected } = require('../config/redis');

// Queue configuration
const QUEUE_NAME = 'whatsapp-messages';
const QUEUE_CONFIG = {
  connection: null, // Will be set in initializeQueue
  
  // Default job options
  defaultJobOptions: {
    attempts: 3, // Max retry attempts
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with 1s, then 2s, 4s
    },
    timeout: 30000, // 30 seconds timeout
    removeOnComplete: {
      age: 3600, // Remove after 1 hour
      count: 1000, // Keep last 1000 completed
    },
    removeOnFail: {
      age: 86400, // Remove failed jobs after 24 hours
    },
  },
};

// Global queue instance
let messageQueue = null;

/**
 * Initialize the message queue
 */
async function initializeQueue() {
  try {
    const redisClient = getRedisClient();
    
    if (!redisClient) {
      throw new Error('Redis client not available');
    }

    QUEUE_CONFIG.connection = redisClient;
    messageQueue = new Queue(QUEUE_NAME, QUEUE_CONFIG);

    // Event: Job completed
    messageQueue.on('completed', (job) => {
      logger.info('✅ Job completed', {
        jobId: job.id,
        phoneNumber: job.data?.phoneNumber,
        duration: job.finishedOn - job.processedOn,
      });
    });

    // Event: Job failed
    messageQueue.on('failed', (job, error) => {
      logger.error('❌ Job failed', {
        jobId: job.id,
        phoneNumber: job.data?.phoneNumber,
        error: error.message,
        attempts: job.attemptsMade,
      });
    });

    // Event: Job stalled
    messageQueue.on('stalled', (jobId) => {
      logger.warn('⚠️ Job stalled', { jobId });
    });

    logger.info('🚀 Message queue initialized', {
      queueName: QUEUE_NAME,
      redisConnected: isRedisConnected(),
    });

    return messageQueue;
  } catch (error) {
    logger.error('Failed to initialize message queue', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Add message to queue
 */
async function addMessageToQueue(phoneNumber, message, metadata = {}) {
  try {
    if (!messageQueue) {
      await initializeQueue();
    }

    const job = await messageQueue.add(QUEUE_NAME, {
      phoneNumber,
      message,
      timestamp: new Date().toISOString(),
      ...metadata,
    }, {
      jobId: `${phoneNumber}-${Date.now()}`, // Unique job ID
    });

    logger.debug('Message added to queue', {
      jobId: job.id,
      phoneNumber,
      queueLength: await messageQueue.getWaitingCount(),
    });

    return job;
  } catch (error) {
    logger.error('Failed to add message to queue', {
      phoneNumber,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get queue instance
 */
function getQueue() {
  return messageQueue;
}

/**
 * Get queue statistics
 */
async function getQueueStats() {
  try {
    if (!messageQueue) {
      return {
        active: 0,
        waiting: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      };
    }

    const [active, waiting, completed, failed, delayed, paused] = await Promise.all([
      messageQueue.getActiveCount(),
      messageQueue.getWaitingCount(),
      messageQueue.getCompletedCount(),
      messageQueue.getFailedCount(),
      messageQueue.getDelayedCount(),
      messageQueue.getPausedCount(),
    ]);

    return {
      active,
      waiting,
      completed,
      failed,
      delayed,
      paused,
      total: active + waiting + completed + failed + delayed + paused,
    };
  } catch (error) {
    logger.error('Failed to get queue stats', {
      error: error.message,
    });
    return {
      active: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      total: 0,
    };
  }
}

/**
 * Get failed jobs for debugging
 */
async function getFailedJobs(start = 0, end = 10) {
  try {
    if (!messageQueue) {
      return [];
    }

    const failedJobs = await messageQueue.getJobs(['failed'], start, end, true);
    
    return failedJobs.map(job => ({
      id: job.id,
      phoneNumber: job.data?.phoneNumber,
      message: job.data?.message?.substring(0, 100),
      error: job.failedReason,
      attempts: job.attemptsMade,
      timestamp: job.timestamp,
    }));
  } catch (error) {
    logger.error('Failed to get failed jobs', {
      error: error.message,
    });
    return [];
  }
}

/**
 * Retry a failed job
 */
async function retryFailedJob(jobId) {
  try {
    if (!messageQueue) {
      throw new Error('Queue not initialized');
    }

    const job = await messageQueue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    
    logger.info('Job retried', { jobId });
    return true;
  } catch (error) {
    logger.error('Failed to retry job', {
      jobId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Clear completed jobs
 */
async function clearCompletedJobs() {
  try {
    if (!messageQueue) {
      return 0;
    }

    const count = await messageQueue.obliterate({ force: false });
    logger.info('Cleared completed jobs', { count });
    return count;
  } catch (error) {
    logger.error('Failed to clear completed jobs', {
      error: error.message,
    });
    return 0;
  }
}

/**
 * Pause queue (emergency stop)
 */
async function pauseQueue() {
  try {
    if (!messageQueue) {
      return;
    }

    await messageQueue.pause();
    logger.warn('⏸️ Queue paused');
  } catch (error) {
    logger.error('Failed to pause queue', {
      error: error.message,
    });
  }
}

/**
 * Resume queue
 */
async function resumeQueue() {
  try {
    if (!messageQueue) {
      return;
    }

    await messageQueue.resume();
    logger.info('▶️ Queue resumed');
  } catch (error) {
    logger.error('Failed to resume queue', {
      error: error.message,
    });
  }
}

/**
 * Drain queue (remove all waiting jobs)
 */
async function drainQueue() {
  try {
    if (!messageQueue) {
      return;
    }

    await messageQueue.drain();
    logger.warn('🗑️ Queue drained');
  } catch (error) {
    logger.error('Failed to drain queue', {
      error: error.message,
    });
  }
}

/**
 * Close queue connection
 */
async function closeQueue() {
  try {
    if (messageQueue) {
      await messageQueue.close();
      messageQueue = null;
      logger.info('Queue closed');
    }
  } catch (error) {
    logger.error('Failed to close queue', {
      error: error.message,
    });
  }
}

module.exports = {
  initializeQueue,
  addMessageToQueue,
  getQueue,
  getQueueStats,
  getFailedJobs,
  retryFailedJob,
  clearCompletedJobs,
  pauseQueue,
  resumeQueue,
  drainQueue,
  closeQueue,
  QUEUE_NAME,
};
