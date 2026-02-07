const mongoose = require('mongoose');

const adultVideoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Video title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    // Cloudinary video URL
    videoUrl: {
      type: String,
      required: [true, 'Video URL is required'],
    },
    // Cloudinary public ID (for deletion)
    cloudinaryId: {
      type: String,
      default: '',
    },
    // Thumbnail — can be auto-generated from Cloudinary or uploaded separately
    thumbnail: {
      type: String,
      default: '',
    },
    thumbnailCloudinaryId: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'Uncategorized',
      trim: true,
    },
    duration: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    // Price in TZS — 0 means free
    price: {
      type: Number,
      default: 0,
    },
    isFree: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AdultVideo', adultVideoSchema);
