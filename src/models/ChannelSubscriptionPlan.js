const mongoose = require('mongoose');

const channelSubscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    // Duration type
    durationType: {
      type: String,
      enum: ['weekly', 'monthly', 'yearly'],
      required: true,
    },
    // Duration in days (auto-computed or manual)
    durationDays: {
      type: Number,
      required: true,
    },
    // Price in TZS
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
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

module.exports = mongoose.model('ChannelSubscriptionPlan', channelSubscriptionPlanSchema);
