const express = require('express');
const router = express.Router();
const { adminProtect } = require('../middleware/admin');
const { getAllCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { getAllServices, createService, updateService, deleteService, getStats, uploadServiceIcon } = require('../controllers/serviceController');
const { getAllOrders, updateOrder, getOrderStats } = require('../controllers/orderController');
const { getAdminPaymentSettings, updatePaymentSettings } = require('../controllers/settingsController');

// All admin routes require admin authentication
router.use(adminProtect);

// Dashboard stats
router.get('/stats', getStats);

// Orders management
router.get('/orders', getAllOrders);
router.get('/orders/stats', getOrderStats);
router.put('/orders/:id', updateOrder);

// Categories CRUD
router.get('/categories', getAllCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Services CRUD
router.get('/services', getAllServices);
router.post('/services', createService);
router.post('/services/upload-icon', uploadServiceIcon);
router.put('/services/:id', updateService);
router.delete('/services/:id', deleteService);

// Payment Settings
router.get('/settings/payment', getAdminPaymentSettings);
router.put('/settings/payment', updatePaymentSettings);

module.exports = router;
