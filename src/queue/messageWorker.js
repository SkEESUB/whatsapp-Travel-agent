// Message Worker - Processes enqueued WhatsApp messages asynchronously using BullMQ

const { Worker } = require('bullmq');
const logger = require('../config/logger');
const { getRedisClient } = require('../config/redis');
const { QUEUE_NAME } = require('./messageQueue');
const whatsappSender = require('../utils/whatsappSender');
const webhookController = require('../controllers/webhookController');

// Configuration
const CONCURRENCY = 10;
let worker = null;

async function processMessageJob(job) {
  const { messageId, phoneNumber, type, text, mediaId, latitude, longitude, name, address, caption, timestamp } = job.data;
  
  logger.info('Worker processing message job', {
    jobId: job.id,
    messageId,
    phoneNumber,
    type,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Construct mock request object matching WhatsApp Webhook format
    const mockReq = {
      body: {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: messageId,
                      from: phoneNumber,
                      type: type,
                      text: type === 'text' ? { body: text } : undefined,
                      image: type === 'image' ? { id: mediaId, caption } : undefined,
                      audio: type === 'audio' ? { id: mediaId } : undefined,
                      location: type === 'location' ? { latitude, longitude, name, address } : undefined,
                      timestamp: timestamp
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    };

    // Custom sendMessageFn that wraps whatsappSender
    const sendMessageFn = async (to, responseText) => {
      await whatsappSender.sendMessage(to, responseText);
    };

    // Call the central controller handler
    await webhookController.handleMessage(mockReq, null, sendMessageFn);

    logger.info('✅ Message job processed successfully by worker', {
      messageId,
      phoneNumber
    });

    return { success: true };
  } catch (error) {
    logger.error('❌ Worker error processing message job', {
      messageId,
      phoneNumber,
      error: error.message,
      stack: error.stack,
    });

    // Notify user of error
    try {
      const errorMessage = error.message?.toLowerCase().includes('timeout')
        ? '⏳ Taking longer than expected. Please wait...'
        : '⚠️ Sorry, something went wrong. Please try again.';

      await whatsappSender.sendMessage(phoneNumber, errorMessage);
    } catch (sendError) {
      logger.error('Failed to send worker error message to user', {
        phoneNumber,
        error: sendError.message,
      });
    }

    throw error; // Propagate to BullMQ retry strategy
  }
}

async function initializeWorker() {
  try {
    const redisClient = getRedisClient();

    worker = new Worker(
      QUEUE_NAME,
      processMessageJob,
      {
        connection: redisClient,
        concurrency: CONCURRENCY,
      }
    );

    worker.on('ready', () => {
      logger.info('🚀 Message worker ready', { concurrency: CONCURRENCY });
    });

    worker.on('completed', (job) => {
      logger.info('✅ Worker completed job', { jobId: job.id });
    });

    worker.on('failed', (job, error) => {
      logger.error('❌ Worker failed job', {
        jobId: job?.id,
        error: error.message,
      });
    });

    worker.on('error', (error) => {
      logger.error('❌ Worker error', { error: error.message });
    });

    return worker;
  } catch (error) {
    logger.error('Failed to initialize worker', { error: error.message });
    throw error;
  }
}

async function closeWorker() {
  try {
    if (worker) {
      await worker.close();
      worker = null;
      logger.info('Worker closed');
    }
  } catch (error) {
    logger.error('Failed to close worker', { error: error.message });
  }
}

module.exports = {
  initializeWorker,
  closeWorker,
  processMessageJob,
  CONCURRENCY,
};
