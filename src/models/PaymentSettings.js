const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema(
  {
    // There should only be one settings document
    key: {
      type: String,
      default: 'payment_settings',
      unique: true,
    },
    // Manual payment details (set by admin)
    manualPaymentEnabled: {
      type: Boolean,
      default: true,
    },
    manualPaymentPhone: {
      type: String,
      default: '',
      trim: true,
    },
    manualPaymentName: {
      type: String,
      default: '',
      trim: true,
    },
    manualPaymentInstructions: {
      type: String,
      default: 'Send the exact amount to the number above via M-Pesa, Tigo Pesa, or Airtel Money. Then paste your payment confirmation message below.',
    },
    // USSD push enabled
    ussdPaymentEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PaymentSettings', paymentSettingsSchema);
