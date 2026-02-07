const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAdultVideos,
  getAdultCategories,
  incrementViews,
  initiatePayment,
  checkPaymentStatus,
  checkPurchase,
} = require('../controllers/adultVideoController');

// All routes require authentication
router.use(protect);

router.get('/', getAdultVideos);
router.get('/categories', getAdultCategories);
router.put('/:id/view', incrementViews);

// Purchase / payment
router.post('/pay', initiatePayment);
router.get('/pay/:purchaseId/status', checkPaymentStatus);
router.get('/:videoId/purchased', checkPurchase);

module.exports = router;
