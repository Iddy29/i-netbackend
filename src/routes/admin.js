const express = require('express');
const router = express.Router();
const { adminProtect } = require('../middleware/admin');
const { getAllCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
const { getAllServices, createService, updateService, deleteService, getStats, uploadServiceIcon } = require('../controllers/serviceController');
const { getAllOrders, updateOrder, getOrderStats } = require('../controllers/orderController');
const { getAdminPaymentSettings, updatePaymentSettings } = require('../controllers/settingsController');
const { getAllVideoChannels, createVideoChannel, updateVideoChannel, deleteVideoChannel, uploadThumbnail } = require('../controllers/videoChannelController');
const {
  getAllAdultVideos,
  createAdultVideo,
  updateAdultVideo,
  deleteAdultVideo,
  uploadVideo: uploadAdultVideo,
  uploadVideoUrl: uploadAdultVideoUrl,
  uploadThumbnail: uploadAdultThumbnail,
} = require('../controllers/adultVideoController');
const {
  getAllPlans, createPlan, updatePlan, deletePlan,
  getAllPromoCodes, createPromoCode, updatePromoCode, deletePromoCode,
  getSubscriptionStats,
} = require('../controllers/subscriptionController');

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

// Video Channels CRUD
router.get('/videos', getAllVideoChannels);
router.post('/videos', createVideoChannel);
router.post('/videos/upload-thumbnail', uploadThumbnail);
router.put('/videos/:id', updateVideoChannel);
router.delete('/videos/:id', deleteVideoChannel);

// Adult Videos CRUD
router.get('/adult-videos', getAllAdultVideos);
router.post('/adult-videos', createAdultVideo);
router.post('/adult-videos/upload-video', uploadAdultVideo);
router.post('/adult-videos/upload-video-url', uploadAdultVideoUrl);
router.post('/adult-videos/upload-thumbnail', uploadAdultThumbnail);
router.put('/adult-videos/:id', updateAdultVideo);
router.delete('/adult-videos/:id', deleteAdultVideo);

// Subscription Plans CRUD
router.get('/subscriptions/plans', getAllPlans);
router.post('/subscriptions/plans', createPlan);
router.put('/subscriptions/plans/:id', updatePlan);
router.delete('/subscriptions/plans/:id', deletePlan);
router.get('/subscriptions/stats', getSubscriptionStats);

// Promo Codes CRUD
router.get('/promo-codes', getAllPromoCodes);
router.post('/promo-codes', createPromoCode);
router.put('/promo-codes/:id', updatePromoCode);
router.delete('/promo-codes/:id', deletePromoCode);

module.exports = router;
