const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createOrder, createManualOrder, getMyOrders, getOrder, checkPaymentStatus, paymentTimeout } = require('../controllers/orderController');

// All order routes require authentication
router.use(protect);

router.post('/', createOrder);
router.post('/manual', createManualOrder);
router.get('/', getMyOrders);
router.get('/:id', getOrder);
router.get('/:id/payment-status', checkPaymentStatus);
router.post('/:id/payment-timeout', paymentTimeout);

module.exports = router;
