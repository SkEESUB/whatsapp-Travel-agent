/**
 * Health Check Routes
 * Provides system health and status endpoints
 */

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/', healthController.getHealth);

/**
 * GET /health/detailed
 * Detailed system status with memory and uptime
 */
router.get('/detailed', healthController.getDetailedHealth);

module.exports = router;
