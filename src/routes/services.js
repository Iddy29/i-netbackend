const express = require('express');
const router = express.Router();
const { getServices, getService } = require('../controllers/serviceController');

// Public routes
router.get('/', getServices);
router.get('/:id', getService);

module.exports = router;
