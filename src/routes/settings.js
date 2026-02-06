const express = require('express');
const router = express.Router();
const { getPaymentSettings } = require('../controllers/settingsController');

// Public route - mobile app fetches payment options
router.get('/payment', getPaymentSettings);

module.exports = router;
