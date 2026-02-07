const mongoose = require('mongoose');

const channelSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChannelSubscriptionPlan',
      required: true,
    },
    // Snapshot of plan details at time of purchase
    planName: { type: String, default: '' },
    durationType: { type: String, default: '' },
    durationDays: { type: Number, default: 0 },
    amount: {
      type: Number,
      required: true,
    },
    // Discount applied (from promo code)
    discount: {
      type: Number,
      default: 0,
    },
    promoCode: {
      type: String,
      default: '',
    },
    // Payment details
    paymentMethod: {
      type: String,
      enum: ['ussd', 'manual', 'promo'],
      default: 'ussd',
    },
    transactionId: {
      type: String,
      default: '',
    },
    phoneNumber: {
      type: String,
      default: '',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    // Subscription period
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for quick lookup
channelSubscriptionSchema.index({ user: 1, isActive: 1, endDate: 1 });

module.exports = mongoose.model('ChannelSubscription', channelSubscriptionSchema);
