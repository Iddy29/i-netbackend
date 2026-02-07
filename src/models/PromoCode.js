const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Promo code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    // Type: 'discount' reduces price by percentage, 'fixed' reduces by fixed amount, 'free_access' gives free time
    type: {
      type: String,
      enum: ['discount', 'fixed', 'free_access'],
      required: true,
    },
    // For 'discount': percentage (e.g. 50 = 50% off)
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // For 'fixed': fixed amount in TZS to subtract
    fixedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // For 'free_access': number of days of free access
    freeAccessDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Usage limits
    maxUses: {
      type: Number,
      default: 0, // 0 = unlimited
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    // Per-user limit
    maxUsesPerUser: {
      type: Number,
      default: 1,
    },
    // Validity period
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PromoCode', promoCodeSchema);
