const User = require('../models/User');
const Otp = require('../models/Otp');
const { generateToken } = require('../middleware/auth');
const { generateOTP, sendOTPEmail } = require('../utils/email');
const { uploadImage } = require('../utils/imageUpload');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { fullName, email, phone, password, confirmPassword } = req.body;

    // Validate required fields
    if (!fullName || !email || !phone || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Check passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Check password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // If user exists but is not verified, allow re-registration
      if (!existingUser.isVerified) {
        // Update user data
        existingUser.fullName = fullName;
        existingUser.phone = phone;
        existingUser.password = password;
        await existingUser.save();

        // Delete any existing OTPs for this email
        await Otp.deleteMany({ email });

        // Generate and send new OTP
        const otpCode = generateOTP();
        await Otp.create({
          email,
          code: otpCode,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

        await sendOTPEmail(email, otpCode);

        return res.status(200).json({
          success: true,
          message: 'Verification code sent to your email',
          data: { email },
        });
      }

      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // Create new user
    const user = await User.create({
      fullName,
      email,
      phone,
      password,
    });

    // Generate and send OTP
    const otpCode = generateOTP();
    await Otp.create({
      email,
      code: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await sendOTPEmail(email, otpCode);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Verification code sent to your email.',
      data: { email },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
    });
  }
};

/**
 * @desc    Verify OTP code
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP code are required',
      });
    }

    // Find the latest OTP for this email
    const otpRecord = await Otp.findOne({ email }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'No verification code found. Please request a new one.',
      });
    }

    // Check if OTP is expired
    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteMany({ email });
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    // Check max attempts (5 attempts allowed)
    if (otpRecord.attempts >= 5) {
      await Otp.deleteMany({ email });
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new code.',
      });
    }

    // Verify OTP code
    if (otpRecord.code !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        success: false,
        message: 'Invalid verification code',
        attemptsRemaining: 5 - otpRecord.attempts,
      });
    }

    // OTP is valid - verify the user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.isVerified = true;
    await user.save();

    // Clean up OTPs
    await Otp.deleteMany({ email });

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        token,
        user: user.toJSON(),
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification',
    });
  }
};

/**
 * @desc    Resend OTP code
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'This account is already verified',
      });
    }

    // Rate limit: check if an OTP was sent recently (within 60 seconds)
    const recentOtp = await Otp.findOne({ email }).sort({ createdAt: -1 });

    if (recentOtp) {
      const timeSinceLastOtp = Date.now() - recentOtp.createdAt.getTime();
      const cooldownMs = 60 * 1000; // 60 seconds

      if (timeSinceLastOtp < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastOtp) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remainingSeconds} seconds before requesting a new code`,
          retryAfter: remainingSeconds,
        });
      }
    }

    // Delete old OTPs and create new one
    await Otp.deleteMany({ email });

    const otpCode = generateOTP();
    await Otp.create({
      email,
      code: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await sendOTPEmail(email, otpCode);

    res.status(200).json({
      success: true,
      message: 'New verification code sent to your email',
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resending code',
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      // Send a new OTP so user can verify
      await Otp.deleteMany({ email });

      const otpCode = generateOTP();
      await Otp.create({
        email,
        code: otpCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      await sendOTPEmail(email, otpCode);

      return res.status(403).json({
        success: false,
        message: 'Account not verified. A new verification code has been sent to your email.',
        requiresVerification: true,
        data: { email },
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: user.toJSON(),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: { user: req.user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { fullName, phone } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (fullName !== undefined) {
      if (!fullName.trim()) {
        return res.status(400).json({ success: false, message: 'Full name cannot be empty' });
      }
      user.fullName = fullName.trim();
    }

    if (phone !== undefined) {
      if (!phone.trim()) {
        return res.status(400).json({ success: false, message: 'Phone number cannot be empty' });
      }
      user.phone = phone.trim();
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: user.toJSON() },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Upload / update profile picture
 * @route   POST /api/auth/profile-picture
 * @access  Private
 * @body    { image: "base64string" }
 */
const updateProfilePicture = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, message: 'Image data is required' });
    }

    // Upload to imgBB
    const result = await uploadImage(image, `profile_${req.user._id}`);

    // Save URL to user profile
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: result.displayUrl },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile picture updated',
      data: {
        user: user.toJSON(),
        imageUrl: result.displayUrl,
      },
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload profile picture',
    });
  }
};

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { register, verifyOtp, resendOtp, login, getMe, updateProfile, updateProfilePicture, changePassword };
