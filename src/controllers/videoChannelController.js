const VideoChannel = require('../models/VideoChannel');
const { uploadImage } = require('../utils/imageUpload');

// @desc    Get active video channels (public)
// @route   GET /api/videos
const getVideoChannels = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { isActive: true };

    if (category && category !== 'All') {
      filter.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    const channels = await VideoChannel.find(filter).sort({ sortOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: channels });
  } catch (error) {
    console.error('Get video channels error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get video channel categories (public)
// @route   GET /api/videos/categories
const getVideoCategories = async (req, res) => {
  try {
    const categories = await VideoChannel.distinct('category', { isActive: true });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error('Get video categories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all video channels (admin)
// @route   GET /api/admin/videos
const getAllVideoChannels = async (req, res) => {
  try {
    const channels = await VideoChannel.find().sort({ sortOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: channels });
  } catch (error) {
    console.error('Get all video channels error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create video channel (admin)
// @route   POST /api/admin/videos
const createVideoChannel = async (req, res) => {
  try {
    const { name, description, streamUrl, thumbnail, category, isActive, sortOrder } = req.body;

    if (!name || !streamUrl) {
      return res.status(400).json({
        success: false,
        message: 'Name and stream URL are required',
      });
    }

    const channel = await VideoChannel.create({
      name,
      description: description || '',
      streamUrl,
      thumbnail: thumbnail || '',
      category: category || 'General',
      isActive: isActive !== undefined ? isActive : true,
      sortOrder: sortOrder || 0,
    });

    res.status(201).json({
      success: true,
      message: 'Video channel created',
      data: channel,
    });
  } catch (error) {
    console.error('Create video channel error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Update video channel (admin)
// @route   PUT /api/admin/videos/:id
const updateVideoChannel = async (req, res) => {
  try {
    const channel = await VideoChannel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Video channel not found' });
    }

    const updates = req.body;
    Object.keys(updates).forEach((key) => {
      channel[key] = updates[key];
    });

    await channel.save();

    res.status(200).json({
      success: true,
      message: 'Video channel updated',
      data: channel,
    });
  } catch (error) {
    console.error('Update video channel error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Delete video channel (admin)
// @route   DELETE /api/admin/videos/:id
const deleteVideoChannel = async (req, res) => {
  try {
    const channel = await VideoChannel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, message: 'Video channel not found' });
    }

    await channel.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Video channel deleted',
    });
  } catch (error) {
    console.error('Delete video channel error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Upload video channel thumbnail (admin)
// @route   POST /api/admin/videos/upload-thumbnail
const uploadThumbnail = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Image data is required' });
    }

    const result = await uploadImage(image, `video_thumb_${Date.now()}`);
    res.status(200).json({
      success: true,
      message: 'Thumbnail uploaded',
      data: { url: result.displayUrl, thumbnail: result.thumbnail },
    });
  } catch (error) {
    console.error('Upload thumbnail error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload thumbnail' });
  }
};

module.exports = {
  getVideoChannels,
  getVideoCategories,
  getAllVideoChannels,
  createVideoChannel,
  updateVideoChannel,
  deleteVideoChannel,
  uploadThumbnail,
};
