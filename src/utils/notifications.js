const Notification = require('../models/Notification');

/**
 * Create a notification for a user
 */
const createNotification = async ({ user, type, title, message, order, metadata }) => {
  try {
    await Notification.create({
      user,
      type,
      title,
      message,
      order: order || undefined,
      metadata: metadata || {},
    });
  } catch (error) {
    // Don't let notification errors break main flows
    console.error('Failed to create notification:', error.message);
  }
};

/**
 * Create notification when USSD payment is confirmed
 */
const notifyPaymentCompleted = async (order) => {
  const amount = order.serviceCurrency === 'TZS'
    ? `TZS ${Number(order.servicePrice).toLocaleString()}`
    : `$${Number(order.servicePrice).toFixed(2)}`;

  await createNotification({
    user: order.user,
    type: 'payment_completed',
    title: 'Payment Successful',
    message: `Your payment of ${amount} for ${order.serviceName} has been confirmed. Your order is now being processed.`,
    order: order._id,
    metadata: {
      serviceName: order.serviceName,
      serviceColor: order.serviceColor,
      serviceIconType: order.serviceIconType,
      orderId: order._id.toString(),
      amount,
    },
  });
};

/**
 * Create notification when payment fails / times out
 */
const notifyPaymentFailed = async (order) => {
  await createNotification({
    user: order.user,
    type: 'payment_failed',
    title: 'Payment Failed',
    message: `Your payment for ${order.serviceName} was not completed. No money was deducted from your account.`,
    order: order._id,
    metadata: {
      serviceName: order.serviceName,
      serviceColor: order.serviceColor,
      serviceIconType: order.serviceIconType,
      orderId: order._id.toString(),
    },
  });
};

/**
 * Create notification when manual payment is verified by admin
 */
const notifyPaymentVerified = async (order) => {
  const amount = order.serviceCurrency === 'TZS'
    ? `TZS ${Number(order.servicePrice).toLocaleString()}`
    : `$${Number(order.servicePrice).toFixed(2)}`;

  await createNotification({
    user: order.user,
    type: 'payment_verified',
    title: 'Payment Verified',
    message: `Your manual payment of ${amount} for ${order.serviceName} has been verified by our team.`,
    order: order._id,
    metadata: {
      serviceName: order.serviceName,
      serviceColor: order.serviceColor,
      serviceIconType: order.serviceIconType,
      orderId: order._id.toString(),
      amount,
    },
  });
};

/**
 * Create notification when order status changes
 */
const notifyOrderStatusChange = async (order, newStatus, oldStatus) => {
  // Don't notify if status didn't actually change
  if (newStatus === oldStatus) return;

  const configs = {
    processing: {
      type: 'order_processing',
      title: 'Order Being Processed',
      message: `Your order for ${order.serviceName} is now being processed. We'll notify you once it's ready.`,
    },
    active: {
      type: 'order_active',
      title: 'Order Activated!',
      message: `Great news! Your ${order.serviceName} subscription is now active. Check your order details for access credentials.`,
    },
    delivered: {
      type: 'order_delivered',
      title: 'Order Delivered',
      message: `Your order for ${order.serviceName} has been delivered. Enjoy your service!`,
    },
    cancelled: {
      type: 'order_cancelled',
      title: 'Order Cancelled',
      message: `Your order for ${order.serviceName} has been cancelled.${order.adminNote ? ' Note: ' + order.adminNote : ''}`,
    },
  };

  const config = configs[newStatus];
  if (!config) return;

  await createNotification({
    user: order.user,
    type: config.type,
    title: config.title,
    message: config.message,
    order: order._id,
    metadata: {
      serviceName: order.serviceName,
      serviceColor: order.serviceColor,
      serviceIconType: order.serviceIconType,
      orderId: order._id.toString(),
    },
  });
};

/**
 * Notify when admin adds/updates credentials
 */
const notifyCredentialsAdded = async (order) => {
  await createNotification({
    user: order.user,
    type: 'order_credentials',
    title: 'Access Credentials Ready',
    message: `Your login credentials for ${order.serviceName} are now available. Go to My Orders to view them.`,
    order: order._id,
    metadata: {
      serviceName: order.serviceName,
      serviceColor: order.serviceColor,
      serviceIconType: order.serviceIconType,
      orderId: order._id.toString(),
    },
  });
};

module.exports = {
  createNotification,
  notifyPaymentCompleted,
  notifyPaymentFailed,
  notifyPaymentVerified,
  notifyOrderStatusChange,
  notifyCredentialsAdded,
};
