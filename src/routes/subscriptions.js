const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getPlans,
  getMySubscription,
  validatePromo,
  subscribe,
  checkPaymentStatus,
} = require('../controllers/subscriptionController');

// All routes require authentication
router.use(protect);

router.get('/plans', getPlans);
router.get('/my', getMySubscription);
router.post('/validate-promo', validatePromo);
router.post('/subscribe', subscribe);
router.get('/:subscriptionId/status', checkPaymentStatus);

module.exports = router;
