const PaymentSettings = require('../models/PaymentSettings');

// Helper to get or create the singleton settings doc
const getSettingsDoc = async () => {
  let settings = await PaymentSettings.findOne({ key: 'payment_settings' });
  if (!settings) {
    settings = await PaymentSettings.create({ key: 'payment_settings' });
  }
  return settings;
};

// @desc    Get payment settings (public - for mobile app)
// @route   GET /api/settings/payment
// @access  Public
const getPaymentSettings = async (req, res) => {
  try {
    const settings = await getSettingsDoc();
    res.status(200).json({
      success: true,
      data: {
        manualPaymentEnabled: settings.manualPaymentEnabled,
        manualPaymentPhone: settings.manualPaymentPhone,
        manualPaymentName: settings.manualPaymentName,
        manualPaymentInstructions: settings.manualPaymentInstructions,
        ussdPaymentEnabled: settings.ussdPaymentEnabled,
      },
    });
  } catch (error) {
    console.error('Get payment settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get full payment settings (admin)
// @route   GET /api/admin/settings/payment
// @access  Admin
const getAdminPaymentSettings = async (req, res) => {
  try {
    const settings = await getSettingsDoc();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Get admin settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update payment settings (admin)
// @route   PUT /api/admin/settings/payment
// @access  Admin
const updatePaymentSettings = async (req, res) => {
  try {
    const {
      manualPaymentEnabled,
      manualPaymentPhone,
      manualPaymentName,
      manualPaymentInstructions,
      ussdPaymentEnabled,
    } = req.body;

    const settings = await getSettingsDoc();

    if (manualPaymentEnabled !== undefined) settings.manualPaymentEnabled = manualPaymentEnabled;
    if (manualPaymentPhone !== undefined) settings.manualPaymentPhone = manualPaymentPhone;
    if (manualPaymentName !== undefined) settings.manualPaymentName = manualPaymentName;
    if (manualPaymentInstructions !== undefined) settings.manualPaymentInstructions = manualPaymentInstructions;
    if (ussdPaymentEnabled !== undefined) settings.ussdPaymentEnabled = ussdPaymentEnabled;

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Payment settings updated',
      data: settings,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getPaymentSettings, getAdminPaymentSettings, updatePaymentSettings };
