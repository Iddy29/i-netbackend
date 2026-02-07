const mongoose = require('mongoose');

const videoChannelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Channel name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    streamUrl: {
      type: String,
      required: [true, 'Stream URL is required'],
      trim: true,
    },
    thumbnail: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('VideoChannel', videoChannelSchema);
