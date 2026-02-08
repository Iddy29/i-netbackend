const AdultVideo = require('../models/AdultVideo');
const AdultVideoPurchase = require('../models/AdultVideoPurchase');
const cloudinary = require('../config/cloudinary');
const { createTransaction, checkTransactionStatus, normalizePaymentStatus } = require('../utils/payment');

// ── Public: Get active adult videos (with user's purchase status) ──
exports.getAdultVideos = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { isActive: true };
    if (category && category !== 'All') filter.category = category;

    const videos = await AdultVideo.find(filter).sort({ sortOrder: 1, createdAt: -1 }).lean();

    // Get user's completed purchases
    const userId = req.user?._id;
    let purchasedIds = [];
    if (userId) {
      const purchases = await AdultVideoPurchase.find({ user: userId, status: 'completed' }).select('video');
      purchasedIds = purchases.map((p) => p.video.toString());
    }

    // Mark each video with purchased status, hide videoUrl for unpurchased paid videos
    // A video is "paid" if price > 0 (isFree field is secondary/legacy)
    const result = videos.map((v) => {
      const videoPrice = parseInt(v.price) || 0;
      const isPaid = videoPrice > 0;
      const purchased = purchasedIds.includes(v._id.toString());
      return {
        ...v,
        price: videoPrice,
        isFree: !isPaid,
        purchased: isPaid ? purchased : true,
        videoUrl: (isPaid && !purchased) ? '' : v.videoUrl, // hide URL if not purchased
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Get adult videos error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Public: Get adult video categories ──
exports.getAdultCategories = async (req, res) => {
  try {
    const categories = await AdultVideo.distinct('category', { isActive: true });
    res.json({ success: true, data: categories });
  } catch (err) {
    console.error('Get adult categories error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Public: Increment view count ──
exports.incrementViews = async (req, res) => {
  try {
    const video = await AdultVideo.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    res.json({ success: true, data: video });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: Get all adult videos ──
exports.getAllAdultVideos = async (req, res) => {
  try {
    const videos = await AdultVideo.find().sort({ createdAt: -1 });
    res.json({ success: true, data: videos });
  } catch (err) {
    console.error('Admin get adult videos error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: Upload video to Cloudinary ──
exports.uploadVideo = async (req, res) => {
  try {
    const { video } = req.body; // base64 or data URI

    if (!video) {
      return res.status(400).json({ success: false, message: 'No video data provided' });
    }

    const result = await cloudinary.uploader.upload(video, {
      resource_type: 'video',
      folder: 'inet-adult-videos',
      chunk_size: 6000000, // 6MB chunks for large files
    });

    // Auto-generate thumbnail from video
    const thumbnailUrl = cloudinary.url(result.public_id, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        { width: 640, height: 360, crop: 'fill' },
        { start_offset: '2' }, // grab frame at 2s
      ],
    });

    res.json({
      success: true,
      data: {
        videoUrl: result.secure_url,
        cloudinaryId: result.public_id,
        thumbnail: thumbnailUrl,
        duration: result.duration ? `${Math.floor(result.duration / 60)}:${String(Math.floor(result.duration % 60)).padStart(2, '0')}` : '',
      },
    });
  } catch (err) {
    console.error('Cloudinary video upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload video: ' + (err.message || 'Unknown error') });
  }
};

// ── Admin: Upload video via URL (for large files) ──
exports.uploadVideoUrl = async (req, res) => {
  try {
    const { videoUrl } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ success: false, message: 'No video URL provided' });
    }

    const result = await cloudinary.uploader.upload(videoUrl, {
      resource_type: 'video',
      folder: 'inet-adult-videos',
    });

    const thumbnailUrl = cloudinary.url(result.public_id, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        { width: 640, height: 360, crop: 'fill' },
        { start_offset: '2' },
      ],
    });

    res.json({
      success: true,
      data: {
        videoUrl: result.secure_url,
        cloudinaryId: result.public_id,
        thumbnail: thumbnailUrl,
        duration: result.duration ? `${Math.floor(result.duration / 60)}:${String(Math.floor(result.duration % 60)).padStart(2, '0')}` : '',
      },
    });
  } catch (err) {
    console.error('Cloudinary URL upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload video from URL' });
  }
};

// ── Admin: Upload thumbnail to Cloudinary ──
exports.uploadThumbnail = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'No image data provided' });
    }

    const result = await cloudinary.uploader.upload(image, {
      folder: 'inet-adult-thumbnails',
      transformation: [{ width: 640, height: 360, crop: 'fill' }],
    });

    res.json({
      success: true,
      data: {
        thumbnail: result.secure_url,
        thumbnailCloudinaryId: result.public_id,
      },
    });
  } catch (err) {
    console.error('Thumbnail upload error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload thumbnail' });
  }
};

// ── Admin: Create adult video entry ──
exports.createAdultVideo = async (req, res) => {
  try {
    const { title, description, videoUrl, cloudinaryId, thumbnail, thumbnailCloudinaryId, category, duration, sortOrder, isActive, price, isFree } = req.body;

    if (!title || !videoUrl) {
      return res.status(400).json({ success: false, message: 'Title and video URL are required' });
    }

    const videoPrice = parseInt(price) || 0;
    // isFree: if explicitly set to false, it's paid; otherwise compute from price
    const computedIsFree = isFree === false || isFree === 'false' ? false : (videoPrice <= 0);

    console.log('Creating adult video | price:', videoPrice, '| isFree:', computedIsFree, '| raw isFree:', isFree);

    const video = await AdultVideo.create({
      title,
      description: description || '',
      videoUrl,
      cloudinaryId: cloudinaryId || '',
      thumbnail: thumbnail || '',
      thumbnailCloudinaryId: thumbnailCloudinaryId || '',
      category: category || 'Uncategorized',
      duration: duration || '',
      sortOrder: sortOrder || 0,
      isActive: isActive !== false,
      price: videoPrice,
      isFree: computedIsFree,
    });

    res.status(201).json({ success: true, data: video });
  } catch (err) {
    console.error('Create adult video error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: Update adult video ──
exports.updateAdultVideo = async (req, res) => {
  try {
    const updateData = { ...req.body };
    // Ensure price is a number
    if (updateData.price !== undefined) {
      updateData.price = parseInt(updateData.price) || 0;
    }
    // Ensure isFree is a proper boolean
    if (updateData.isFree !== undefined) {
      updateData.isFree = updateData.isFree === true || updateData.isFree === 'true';
    }
    // If price is set but isFree not explicitly sent, auto-compute
    if (updateData.price !== undefined && updateData.isFree === undefined) {
      updateData.isFree = updateData.price <= 0;
    }

    console.log('Updating adult video:', req.params.id, '| price:', updateData.price, '| isFree:', updateData.isFree);

    const video = await AdultVideo.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    res.json({ success: true, data: video });
  } catch (err) {
    console.error('Update adult video error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: Delete adult video (also removes from Cloudinary) ──
exports.deleteAdultVideo = async (req, res) => {
  try {
    const video = await AdultVideo.findById(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });

    // Delete video from Cloudinary
    if (video.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(video.cloudinaryId, { resource_type: 'video' });
      } catch (e) {
        console.warn('Cloudinary video delete failed:', e.message);
      }
    }

    // Delete thumbnail from Cloudinary
    if (video.thumbnailCloudinaryId) {
      try {
        await cloudinary.uploader.destroy(video.thumbnailCloudinaryId);
      } catch (e) {
        console.warn('Cloudinary thumbnail delete failed:', e.message);
      }
    }

    await AdultVideo.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Video deleted' });
  } catch (err) {
    console.error('Delete adult video error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════════════
// ── Public: Purchase / Unlock a paid video via USSD ──
// ══════════════════════════════════════════════════════

exports.initiatePayment = async (req, res) => {
  try {
    const { videoId, phoneNumber, name } = req.body;
    const userId = req.user._id;

    if (!videoId || !phoneNumber) {
      return res.status(400).json({ success: false, message: 'Video ID and phone number are required' });
    }

    const video = await AdultVideo.findById(videoId);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    const videoPrice = parseInt(video.price) || 0;
    if (videoPrice <= 0) {
      return res.status(400).json({ success: false, message: 'This video is free' });
    }

    // Check if already purchased
    const existing = await AdultVideoPurchase.findOne({ user: userId, video: videoId, status: 'completed' });
    if (existing) {
      return res.json({ success: true, message: 'Already purchased', data: { alreadyPurchased: true } });
    }

    // Create FastLipa transaction
    const txn = await createTransaction(phoneNumber, videoPrice, name || 'Customer');

    // Save purchase record as pending
    const purchase = await AdultVideoPurchase.create({
      user: userId,
      video: videoId,
      amount: videoPrice,
      paymentMethod: 'ussd',
      transactionId: txn.tranID,
      phoneNumber,
      status: 'pending',
    });

    res.json({
      success: true,
      message: 'Payment initiated. Check your phone.',
      data: {
        purchaseId: purchase._id,
        transactionId: txn.tranID,
        amount: videoPrice,
        network: txn.network,
      },
    });
  } catch (err) {
    console.error('Initiate adult video payment error:', err);
    res.status(500).json({ success: false, message: 'Failed to initiate payment: ' + (err.message || 'Unknown error') });
  }
};

exports.checkPaymentStatus = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const userId = req.user._id;

    const purchase = await AdultVideoPurchase.findOne({ _id: purchaseId, user: userId });
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found' });

    if (purchase.status === 'completed') {
      return res.json({ success: true, data: { status: 'completed' } });
    }
    if (purchase.status === 'failed') {
      return res.json({ success: true, data: { status: 'failed' } });
    }

    // Poll FastLipa
    let txnStatus;
    try {
      txnStatus = await checkTransactionStatus(purchase.transactionId);
    } catch (err) {
      return res.json({ success: true, data: { status: 'pending', rawStatus: 'NETWORK_ERROR' } });
    }

    const rawStatus = txnStatus.payment_status;
    const normalized = normalizePaymentStatus(rawStatus);

    if (normalized === 'completed') {
      purchase.status = 'completed';
      await purchase.save();
      return res.json({ success: true, data: { status: 'completed', rawStatus } });
    }

    if (normalized === 'failed') {
      purchase.status = 'failed';
      await purchase.save();
      return res.json({ success: true, data: { status: 'failed', rawStatus } });
    }

    // Still pending
    res.json({ success: true, data: { status: 'pending', rawStatus } });
  } catch (err) {
    console.error('Check adult video payment status error:', err);
    res.status(500).json({ success: false, message: 'Failed to check payment status' });
  }
};

// Check if user has purchased a specific video
exports.checkPurchase = async (req, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user._id;
    const purchase = await AdultVideoPurchase.findOne({ user: userId, video: videoId, status: 'completed' });
    res.json({ success: true, data: { purchased: !!purchase } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
