const mongoose = require('mongoose');

const adultVideoPurchaseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdultVideo',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['ussd', 'manual'],
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
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly check if user has purchased a video
adultVideoPurchaseSchema.index({ user: 1, video: 1 });

module.exports = mongoose.model('AdultVideoPurchase', adultVideoPurchaseSchema);
