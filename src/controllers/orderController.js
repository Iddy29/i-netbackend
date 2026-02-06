const Order = require('../models/Order');
const Service = require('../models/Service');
const { createTransaction, checkTransactionStatus } = require('../utils/payment');
const {
  notifyPaymentCompleted,
  notifyPaymentFailed,
  notifyPaymentVerified,
  notifyOrderStatusChange,
  notifyCredentialsAdded,
} = require('../utils/notifications');

// ==================== USER ROUTES ====================

// @desc    Create a new order + initiate FastLipa USSD push
// @route   POST /api/orders
// @access  Private (user)
const createOrder = async (req, res) => {
  try {
    const { serviceId, paymentPhone } = req.body;

    if (!serviceId || !paymentPhone) {
      return res.status(400).json({
        success: false,
        message: 'Service ID and payment phone number are required',
      });
    }

    // Validate phone format (Tanzania: starts with 0 or +255, 10-13 digits)
    const cleanPhone = paymentPhone.replace(/\s/g, '');
    if (!/^(\+?255|0)\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid Tanzanian phone number',
      });
    }

    // Get service details
    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or no longer available',
      });
    }

    // Initiate FastLipa USSD push payment
    let transaction;
    try {
      transaction = await createTransaction(
        cleanPhone,
        Math.round(service.price), // FastLipa expects integer amounts
        req.user.fullName || 'Customer'
      );
    } catch (paymentError) {
      return res.status(502).json({
        success: false,
        message: 'Failed to initiate payment. Please try again.',
      });
    }

    // Create order with payment pending
    const order = await Order.create({
      user: req.user._id,
      service: serviceId,
      serviceName: service.name,
      servicePrice: service.price,
      serviceCurrency: service.currency || 'TZS',
      serviceDuration: service.duration,
      serviceIconType: service.iconType,
      serviceIconImage: service.iconImage || '',
      serviceColor: service.color,
      paymentPhone: cleanPhone,
      paymentStatus: 'pending',
      paymentTransactionId: transaction.tranID,
      paymentNetwork: transaction.network || '',
      status: 'pending',
    });

    // Fetch the populated order
    const populatedOrder = await Order.findById(order._id);

    res.status(201).json({
      success: true,
      message: 'USSD push sent! Please check your phone and enter your PIN.',
      data: populatedOrder,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
    });
  }
};

// @desc    Check payment status of an order (polls FastLipa)
// @route   GET /api/orders/:id/payment-status
// @access  Private (user)
const checkPaymentStatus = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).setOptions({ populate: [] });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // If payment is already resolved, return immediately
    if (order.paymentStatus === 'completed') {
      return res.status(200).json({
        success: true,
        data: { paymentStatus: 'completed', orderStatus: order.status },
      });
    }

    if (order.paymentStatus === 'failed') {
      return res.status(200).json({
        success: true,
        data: { paymentStatus: 'failed', orderStatus: order.status },
      });
    }

    // No transaction ID means something went wrong
    if (!order.paymentTransactionId) {
      return res.status(200).json({
        success: true,
        data: { paymentStatus: 'failed', orderStatus: order.status },
      });
    }

    // Poll FastLipa for current status
    let fastLipaStatus;
    try {
      fastLipaStatus = await checkTransactionStatus(order.paymentTransactionId);
    } catch (err) {
      // If FastLipa is unreachable, don't fail - just return pending
      return res.status(200).json({
        success: true,
        data: { paymentStatus: 'pending', orderStatus: order.status },
      });
    }

    const paymentResult = fastLipaStatus.payment_status;

    if (paymentResult === 'COMPLETE') {
      // Payment succeeded - update order
      order.paymentStatus = 'completed';
      // Keep order status as 'pending' for admin to process
      await order.save();

      // Send notification
      notifyPaymentCompleted(order);

      return res.status(200).json({
        success: true,
        data: { paymentStatus: 'completed', orderStatus: order.status },
      });
    }

    // Still pending
    return res.status(200).json({
      success: true,
      data: { paymentStatus: 'pending', orderStatus: order.status },
    });
  } catch (error) {
    console.error('Check payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
    });
  }
};

// @desc    Mark payment as failed (called by frontend after 1.5 min timeout)
// @route   POST /api/orders/:id/payment-timeout
// @access  Private (user)
const paymentTimeout = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).setOptions({ populate: [] });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Only mark as failed if still pending
    if (order.paymentStatus === 'pending') {
      order.paymentStatus = 'failed';
      order.status = 'cancelled';
      order.adminNote = 'Payment timed out - customer did not confirm USSD push within 1.5 minutes';
      await order.save();

      // Send notification
      notifyPaymentFailed(order);
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled due to payment timeout',
    });
  } catch (error) {
    console.error('Payment timeout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Create order with manual payment proof
// @route   POST /api/orders/manual
// @access  Private (user)
const createManualOrder = async (req, res) => {
  try {
    const { serviceId, paymentPhone, manualPaymentProof } = req.body;

    if (!serviceId || !paymentPhone || !manualPaymentProof) {
      return res.status(400).json({
        success: false,
        message: 'Service ID, phone number, and payment proof are required',
      });
    }

    if (manualPaymentProof.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please paste the full payment confirmation message',
      });
    }

    const cleanPhone = paymentPhone.replace(/\s/g, '');

    // Get service details
    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or no longer available',
      });
    }

    // Create order with manual payment awaiting verification
    const order = await Order.create({
      user: req.user._id,
      service: serviceId,
      serviceName: service.name,
      servicePrice: service.price,
      serviceCurrency: service.currency || 'TZS',
      serviceDuration: service.duration,
      serviceIconType: service.iconType,
      serviceIconImage: service.iconImage || '',
      serviceColor: service.color,
      paymentPhone: cleanPhone,
      paymentMethod: 'manual',
      paymentStatus: 'awaiting_verification',
      manualPaymentProof: manualPaymentProof.trim(),
      status: 'pending',
    });

    const populatedOrder = await Order.findById(order._id);

    res.status(201).json({
      success: true,
      message: 'Order placed! Your payment is being verified by our team.',
      data: populatedOrder,
    });
  } catch (error) {
    console.error('Create manual order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
    });
  }
};

// @desc    Get current user's orders
// @route   GET /api/orders
// @access  Private (user)
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
    });
  }
};

// @desc    Get single order by ID (user)
// @route   GET /api/orders/:id
// @access  Private (user)
const getOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
    });
  }
};

// ==================== ADMIN ROUTES ====================

// @desc    Get all orders (admin)
// @route   GET /api/admin/orders
// @access  Admin
const getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
    });
  }
};

// @desc    Update order status (admin)
// @route   PUT /api/admin/orders/:id
// @access  Admin
const updateOrder = async (req, res) => {
  try {
    const { status, credentials, adminNote } = req.body;

    const order = await Order.findById(req.params.id).setOptions({ populate: [] });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const oldStatus = order.status;
    const oldPaymentStatus = order.paymentStatus;
    const hadCredentials = !!(order.credentials?.username || order.credentials?.password);

    if (status) order.status = status;
    if (adminNote !== undefined) order.adminNote = adminNote;
    if (credentials) {
      if (credentials.username !== undefined) order.credentials.username = credentials.username;
      if (credentials.password !== undefined) order.credentials.password = credentials.password;
      if (credentials.accountDetails !== undefined) order.credentials.accountDetails = credentials.accountDetails;
    }

    // If admin is processing a manual payment order, mark payment as verified
    if (order.paymentMethod === 'manual' && oldPaymentStatus === 'awaiting_verification' && status && status !== 'cancelled') {
      order.paymentStatus = 'completed';
      notifyPaymentVerified(order);
    }

    await order.save();

    // Send notifications for status change
    if (status && status !== oldStatus) {
      notifyOrderStatusChange(order, status, oldStatus);
    }

    // Send notification if credentials were added/updated
    const nowHasCredentials = !!(order.credentials?.username || order.credentials?.password);
    if (!hadCredentials && nowHasCredentials) {
      notifyCredentialsAdded(order);
    }

    // Return populated order
    const populated = await Order.findById(order._id);

    res.status(200).json({
      success: true,
      message: 'Order updated',
      data: populated,
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order',
    });
  }
};

// @desc    Get order stats for dashboard
const getOrderStats = async (req, res) => {
  try {
    const [pending, processing, active, delivered, cancelled, total] = await Promise.all([
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'processing' }),
      Order.countDocuments({ status: 'active' }),
      Order.countDocuments({ status: 'delivered' }),
      Order.countDocuments({ status: 'cancelled' }),
      Order.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: { pending, processing, active, delivered, cancelled, total },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createOrder,
  createManualOrder,
  checkPaymentStatus,
  paymentTimeout,
  getMyOrders,
  getOrder,
  getAllOrders,
  updateOrder,
  getOrderStats,
};
