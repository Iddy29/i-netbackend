const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    // Snapshot of service details at time of purchase
    serviceName: {
      type: String,
      required: true,
    },
    servicePrice: {
      type: Number,
      required: true,
    },
    serviceCurrency: {
      type: String,
      default: 'TZS',
    },
    serviceDuration: {
      type: String,
      required: true,
    },
    serviceIconType: {
      type: String,
      required: true,
    },
    serviceIconImage: {
      type: String,
      default: '',
    },
    serviceColor: {
      type: String,
      default: '#06B6D4',
    },
    // Payment info
    paymentPhone: {
      type: String,
      required: [true, 'Payment phone number is required'],
      trim: true,
    },
    paymentMethod: {
      type: String,
      default: 'mobile_money',
      enum: ['mobile_money', 'manual'],
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'awaiting_verification'],
      default: 'pending',
    },
    paymentTransactionId: {
      type: String,
      default: '',
    },
    paymentNetwork: {
      type: String,
      default: '',
    },
    // Manual payment proof (screenshot text / confirmation message)
    manualPaymentProof: {
      type: String,
      default: '',
    },
    // Order status
    status: {
      type: String,
      enum: ['pending', 'processing', 'active', 'delivered', 'cancelled', 'expired'],
      default: 'pending',
    },
    // Admin can add credentials/delivery info
    credentials: {
      username: { type: String, default: '' },
      password: { type: String, default: '' },
      accountDetails: { type: String, default: '' },
    },
    adminNote: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Populate service and user by default on find queries
orderSchema.pre(/^find/, function (next) {
  this.populate('service', 'name iconType iconImage color category')
      .populate('user', 'fullName email phone');
  next();
});

module.exports = mongoose.model('Order', orderSchema);
