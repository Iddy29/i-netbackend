const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'payment_completed',
        'payment_failed',
        'payment_verified',      // manual payment verified by admin
        'order_processing',
        'order_active',
        'order_delivered',
        'order_cancelled',
        'order_credentials',     // admin added credentials
        'welcome',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    // Optional reference to the related order
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    // Extra data (service name, etc.)
    metadata: {
      serviceName: String,
      serviceColor: String,
      serviceIconType: String,
      orderId: String,
      amount: String,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient unread count queries
notificationSchema.index({ user: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
