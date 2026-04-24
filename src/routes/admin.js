// Admin Routes
// Admin dashboard API endpoints

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateAdmin, adminRateLimiter } = require('../middleware/adminAuth');

// Apply authentication and rate limiting to all admin routes
router.use(authenticateAdmin);
router.use(adminRateLimiter);

/**
 * @route GET /admin/stats
 * @desc Get dashboard statistics
 * @access Admin
 */
router.get('/stats', adminController.getStats);

/**
 * @route GET /admin/popular-destinations
 * @desc Get top destinations
 * @access Admin
 * @query days - Number of days to look back (default: 7)
 */
router.get('/popular-destinations', adminController.getPopularDestinations);

/**
 * @route GET /admin/users
 * @desc Get paginated user list
 * @access Admin
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 20)
 */
router.get('/users', adminController.getUsers);

/**
 * @route GET /admin/trips
 * @desc Get recent trips
 * @access Admin
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 20)
 */
router.get('/trips', adminController.getTrips);

/**
 * @route GET /admin/revenue
 * @desc Get revenue breakdown
 * @access Admin
 * @query from - Start date (ISO format)
 * @query to - End date (ISO format)
 */
router.get('/revenue', adminController.getRevenue);

/**
 * @route GET /admin/queue-stats
 * @desc Get BullMQ queue statistics
 * @access Admin
 */
router.get('/queue-stats', adminController.getQueueStats);

/**
 * @route GET /admin/cache-stats
 * @desc Get Redis cache statistics
 * @access Admin
 */
router.get('/cache-stats', adminController.getCacheStats);

/**
 * @route GET /admin/health
 * @desc Get system health check
 * @access Admin
 */
router.get('/health', adminController.getHealth);

/**
 * @route POST /admin/broadcast
 * @desc Send message to all users or filtered group
 * @access Admin
 * @body message - Message to send
 * @body filter - Filter criteria (plan, activeDays)
 * @body limit - Max users to send (default: 100)
 */
router.post('/broadcast', adminController.broadcastMessage);

/**
 * @route POST /admin/block-user
 * @desc Block abusive user
 * @access Admin
 * @body phoneNumber - Phone number to block
 * @body reason - Reason for blocking
 */
router.post('/block-user', adminController.blockUser);

module.exports = router;
