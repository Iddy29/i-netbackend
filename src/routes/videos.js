const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getVideoChannels, getVideoCategories } = require('../controllers/videoChannelController');

// Public (authenticated user) routes
router.use(protect);
router.get('/', getVideoChannels);
router.get('/categories', getVideoCategories);

module.exports = router;
