const express = require('express');
const router = express.Router();
const { register, verifyOtp, resendOtp, login, getMe, updateProfile, updateProfilePicture, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);

// Protected routes
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/profile-picture', protect, updateProfilePicture);
router.put('/change-password', protect, changePassword);

module.exports = router;
