const ChannelSubscriptionPlan = require('../models/ChannelSubscriptionPlan');
const ChannelSubscription = require('../models/ChannelSubscription');
const PromoCode = require('../models/PromoCode');
const { createTransaction, checkTransactionStatus, normalizePaymentStatus } = require('../utils/payment');

// ═══════════════════════════════════════
// ── Public endpoints (authenticated) ──
// ═══════════════════════════════════════

// Get active subscription plans
exports.getPlans = async (req, res) => {
  try {
    const plans = await ChannelSubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1, price: 1 });
    res.json({ success: true, data: plans });
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Check if user has an active subscription
exports.getMySubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    const activeSub = await ChannelSubscription.findOne({
      user: userId,
      isActive: true,
      paymentStatus: 'completed',
      endDate: { $gt: now },
    }).sort({ endDate: -1 });

    if (activeSub) {
      return res.json({
        success: true,
        data: {
          subscribed: true,
          subscription: {
            _id: activeSub._id,
            planName: activeSub.planName,
            durationType: activeSub.durationType,
            startDate: activeSub.startDate,
            endDate: activeSub.endDate,
            daysRemaining: Math.ceil((activeSub.endDate - now) / (1000 * 60 * 60 * 24)),
          },
        },
      });
    }

    res.json({ success: true, data: { subscribed: false, subscription: null } });
  } catch (err) {
    console.error('Get my subscription error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Validate a promo code
exports.validatePromo = async (req, res) => {
  try {
    const { code, planId } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Code is required' });

    const promo = await PromoCode.findOne({ code: code.toUpperCase(), isActive: true });
    if (!promo) return res.status(404).json({ success: false, message: 'Invalid promo code' });

    const now = new Date();
    if (promo.validFrom && now < promo.validFrom) {
      return res.status(400).json({ success: false, message: 'This promo code is not yet active' });
    }
    if (promo.validUntil && now > promo.validUntil) {
      return res.status(400).json({ success: false, message: 'This promo code has expired' });
    }
    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ success: false, message: 'This promo code has reached its usage limit' });
    }

    // Check per-user usage
    const userUsage = await ChannelSubscription.countDocuments({
      user: req.user._id,
      promoCode: promo.code,
      paymentStatus: 'completed',
    });
    if (userUsage >= promo.maxUsesPerUser) {
      return res.status(400).json({ success: false, message: 'You have already used this promo code' });
    }

    // Calculate discount
    let discountInfo = { type: promo.type, description: '' };
    if (promo.type === 'discount') {
      discountInfo.discountPercent = promo.discountPercent;
      discountInfo.description = `${promo.discountPercent}% off`;
    } else if (promo.type === 'fixed') {
      discountInfo.fixedAmount = promo.fixedAmount;
      discountInfo.description = `TZS ${promo.fixedAmount.toLocaleString()} off`;
    } else if (promo.type === 'free_access') {
      discountInfo.freeAccessDays = promo.freeAccessDays;
      discountInfo.description = `${promo.freeAccessDays} days free access`;
    }

    // If planId provided, calculate final price
    if (planId) {
      const plan = await ChannelSubscriptionPlan.findById(planId);
      if (plan) {
        let finalPrice = plan.price;
        if (promo.type === 'discount') {
          finalPrice = Math.round(plan.price * (1 - promo.discountPercent / 100));
        } else if (promo.type === 'fixed') {
          finalPrice = Math.max(0, plan.price - promo.fixedAmount);
        } else if (promo.type === 'free_access') {
          finalPrice = 0;
        }
        discountInfo.originalPrice = plan.price;
        discountInfo.finalPrice = finalPrice;
        discountInfo.saved = plan.price - finalPrice;
      }
    }

    res.json({ success: true, data: discountInfo });
  } catch (err) {
    console.error('Validate promo error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Subscribe — initiate payment
exports.subscribe = async (req, res) => {
  try {
    const { planId, phoneNumber, name, promoCode } = req.body;
    const userId = req.user._id;

    if (!planId) return res.status(400).json({ success: false, message: 'Plan ID is required' });

    const plan = await ChannelSubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    // Check if already has active subscription
    const now = new Date();
    const existingSub = await ChannelSubscription.findOne({
      user: userId,
      isActive: true,
      paymentStatus: 'completed',
      endDate: { $gt: now },
    });
    if (existingSub) {
      return res.json({
        success: true,
        message: 'Already subscribed',
        data: { alreadySubscribed: true, endDate: existingSub.endDate },
      });
    }

    let finalPrice = plan.price;
    let discount = 0;
    let appliedPromo = '';
    let paymentMethod = 'ussd';
    let freeAccessDays = 0;

    // Apply promo code if provided
    if (promoCode) {
      const promo = await PromoCode.findOne({ code: promoCode.toUpperCase(), isActive: true });
      if (promo) {
        const promoNow = new Date();
        const validTime = (!promo.validFrom || promoNow >= promo.validFrom) && (!promo.validUntil || promoNow <= promo.validUntil);
        const validUsage = promo.maxUses === 0 || promo.usedCount < promo.maxUses;
        const userUsage = await ChannelSubscription.countDocuments({
          user: userId, promoCode: promo.code, paymentStatus: 'completed',
        });
        const validPerUser = userUsage < promo.maxUsesPerUser;

        if (validTime && validUsage && validPerUser) {
          appliedPromo = promo.code;
          if (promo.type === 'discount') {
            discount = Math.round(plan.price * promo.discountPercent / 100);
            finalPrice = plan.price - discount;
          } else if (promo.type === 'fixed') {
            discount = Math.min(promo.fixedAmount, plan.price);
            finalPrice = plan.price - discount;
          } else if (promo.type === 'free_access') {
            freeAccessDays = promo.freeAccessDays;
            finalPrice = 0;
            paymentMethod = 'promo';
          }
        }
      }
    }

    // Free access via promo — activate immediately
    if (finalPrice <= 0) {
      const startDate = new Date();
      const days = freeAccessDays > 0 ? freeAccessDays : plan.durationDays;
      const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

      const sub = await ChannelSubscription.create({
        user: userId,
        plan: plan._id,
        planName: plan.name,
        durationType: plan.durationType,
        durationDays: days,
        amount: 0,
        discount: plan.price,
        promoCode: appliedPromo,
        paymentMethod,
        paymentStatus: 'completed',
        startDate,
        endDate,
        isActive: true,
      });

      // Increment promo usage
      if (appliedPromo) {
        await PromoCode.findOneAndUpdate({ code: appliedPromo }, { $inc: { usedCount: 1 } });
      }

      return res.json({
        success: true,
        message: 'Subscription activated!',
        data: { subscriptionId: sub._id, startDate, endDate, free: true },
      });
    }

    // Paid subscription — needs USSD payment
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required for payment' });
    }

    const txn = await createTransaction(phoneNumber, finalPrice, name || 'Customer');

    const sub = await ChannelSubscription.create({
      user: userId,
      plan: plan._id,
      planName: plan.name,
      durationType: plan.durationType,
      durationDays: plan.durationDays,
      amount: finalPrice,
      discount,
      promoCode: appliedPromo,
      paymentMethod: 'ussd',
      transactionId: txn.tranID,
      phoneNumber,
      paymentStatus: 'pending',
    });

    res.json({
      success: true,
      message: 'Payment initiated. Check your phone.',
      data: {
        subscriptionId: sub._id,
        transactionId: txn.tranID,
        amount: finalPrice,
        originalPrice: plan.price,
        discount,
        network: txn.network,
      },
    });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ success: false, message: 'Failed to initiate subscription: ' + (err.message || 'Unknown error') });
  }
};

// Check subscription payment status
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user._id;

    const sub = await ChannelSubscription.findOne({ _id: subscriptionId, user: userId });
    if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

    if (sub.paymentStatus === 'completed') {
      return res.json({ success: true, data: { status: 'completed', endDate: sub.endDate } });
    }
    if (sub.paymentStatus === 'failed') {
      return res.json({ success: true, data: { status: 'failed' } });
    }

    // Poll FastLipa
    let txnStatus;
    try {
      txnStatus = await checkTransactionStatus(sub.transactionId);
    } catch (err) {
      return res.json({ success: true, data: { status: 'pending', rawStatus: 'NETWORK_ERROR' } });
    }

    const rawStatus = txnStatus.payment_status;
    const normalized = normalizePaymentStatus(rawStatus);

    if (normalized === 'completed') {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + sub.durationDays * 24 * 60 * 60 * 1000);

      sub.paymentStatus = 'completed';
      sub.startDate = startDate;
      sub.endDate = endDate;
      sub.isActive = true;
      await sub.save();

      // Increment promo usage if applied
      if (sub.promoCode) {
        await PromoCode.findOneAndUpdate({ code: sub.promoCode }, { $inc: { usedCount: 1 } });
      }

      return res.json({ success: true, data: { status: 'completed', startDate, endDate, rawStatus } });
    }

    if (normalized === 'failed') {
      sub.paymentStatus = 'failed';
      await sub.save();
      return res.json({ success: true, data: { status: 'failed', rawStatus } });
    }

    res.json({ success: true, data: { status: 'pending', rawStatus } });
  } catch (err) {
    console.error('Check subscription payment error:', err);
    res.status(500).json({ success: false, message: 'Failed to check payment status' });
  }
};

// ═══════════════════════════
// ── Admin endpoints ──
// ═══════════════════════════

// Get all plans (admin)
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await ChannelSubscriptionPlan.find().sort({ sortOrder: 1, price: 1 });
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const { name, description, durationType, price, isActive, sortOrder } = req.body;
    if (!name || !durationType || price === undefined) {
      return res.status(400).json({ success: false, message: 'Name, duration type, and price are required' });
    }

    const durationMap = { weekly: 7, monthly: 30, yearly: 365 };
    const durationDays = durationMap[durationType] || 30;

    const plan = await ChannelSubscriptionPlan.create({
      name, description: description || '', durationType, durationDays, price: parseInt(price) || 0,
      isActive: isActive !== false, sortOrder: sortOrder || 0,
    });

    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    console.error('Create plan error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.price !== undefined) updateData.price = parseInt(updateData.price) || 0;
    if (updateData.durationType) {
      const durationMap = { weekly: 7, monthly: 30, yearly: 365 };
      updateData.durationDays = durationMap[updateData.durationType] || 30;
    }

    const plan = await ChannelSubscriptionPlan.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const plan = await ChannelSubscriptionPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Promo codes admin
exports.getAllPromoCodes = async (req, res) => {
  try {
    const codes = await PromoCode.find().sort({ createdAt: -1 });
    res.json({ success: true, data: codes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createPromoCode = async (req, res) => {
  try {
    const { code, description, type, discountPercent, fixedAmount, freeAccessDays, maxUses, maxUsesPerUser, validFrom, validUntil, isActive } = req.body;
    if (!code || !type) {
      return res.status(400).json({ success: false, message: 'Code and type are required' });
    }

    const existing = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existing) return res.status(400).json({ success: false, message: 'Promo code already exists' });

    const promo = await PromoCode.create({
      code: code.toUpperCase(),
      description: description || '',
      type,
      discountPercent: parseInt(discountPercent) || 0,
      fixedAmount: parseInt(fixedAmount) || 0,
      freeAccessDays: parseInt(freeAccessDays) || 0,
      maxUses: parseInt(maxUses) || 0,
      maxUsesPerUser: parseInt(maxUsesPerUser) || 1,
      validFrom: validFrom || new Date(),
      validUntil: validUntil || null,
      isActive: isActive !== false,
    });

    res.status(201).json({ success: true, data: promo });
  } catch (err) {
    console.error('Create promo error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

exports.updatePromoCode = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.code) updateData.code = updateData.code.toUpperCase();

    const promo = await PromoCode.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!promo) return res.status(404).json({ success: false, message: 'Promo code not found' });
    res.json({ success: true, data: promo });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deletePromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findByIdAndDelete(req.params.id);
    if (!promo) return res.status(404).json({ success: false, message: 'Promo code not found' });
    res.json({ success: true, message: 'Promo code deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get subscription stats (admin)
exports.getSubscriptionStats = async (req, res) => {
  try {
    const totalActive = await ChannelSubscription.countDocuments({ isActive: true, paymentStatus: 'completed', endDate: { $gt: new Date() } });
    const totalRevenue = await ChannelSubscription.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    res.json({
      success: true,
      data: {
        activeSubscriptions: totalActive,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
