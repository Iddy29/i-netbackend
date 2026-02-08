/**
 * FastLipa Payment API wrapper
 * Handles USSD push payment creation and status polling
 */

const FASTLIPA_API_URL = process.env.FASTLIPA_API_URL || 'https://api.fastlipa.com/api';
const FASTLIPA_API_KEY = process.env.FASTLIPA_API_KEY;

/**
 * Create a payment transaction via FastLipa
 * This sends a USSD push to the customer's phone
 *
 * @param {string} number - Customer phone number (e.g. 0695123456)
 * @param {number} amount - Amount in TZS
 * @param {string} name - Customer name
 * @returns {{ tranID, amount, number, network, status, time }}
 */
const createTransaction = async (number, amount, name) => {
  try {
    const response = await fetch(`${FASTLIPA_API_URL}/create-transaction`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FASTLIPA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number, amount, name }),
    });

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to create payment transaction');
    }

    console.log(`FastLipa transaction created: ${data.data.tranID} | ${data.data.network} | TZS ${amount}`);
    return data.data;
  } catch (error) {
    console.error('FastLipa create transaction error:', error.message);
    throw error;
  }
};

/**
 * Check payment transaction status via FastLipa
 *
 * @param {string} tranId - Transaction ID from createTransaction
 * @returns {{ tranid, payment_status, amount, network, time }}
 */
const checkTransactionStatus = async (tranId) => {
  try {
    const response = await fetch(
      `${FASTLIPA_API_URL}/status-transaction?tranid=${tranId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${FASTLIPA_API_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to check transaction status');
    }

    console.log(`FastLipa status for ${tranId}: payment_status="${data.data.payment_status}"`);
    return data.data;
  } catch (error) {
    console.error('FastLipa status check error:', error.message);
    throw error;
  }
};

/**
 * Normalize FastLipa payment_status to a standard value.
 * FastLipa may return: COMPLETE, COMPLETED, SUCCESS, SUCCESSFUL, PENDING, FAILED, CANCELLED, etc.
 *
 * @param {string} rawStatus - The raw payment_status from FastLipa
 * @returns {'completed' | 'failed' | 'pending'}
 */
const normalizePaymentStatus = (rawStatus) => {
  if (!rawStatus) return 'pending';
  const s = rawStatus.toUpperCase().trim();
  if (['COMPLETE', 'COMPLETED', 'SUCCESS', 'SUCCESSFUL'].includes(s)) {
    return 'completed';
  }
  if (['FAILED', 'FAIL', 'CANCELLED', 'CANCELED', 'REJECTED', 'DECLINED'].includes(s)) {
    return 'failed';
  }
  return 'pending';
};

module.exports = { createTransaction, checkTransactionStatus, normalizePaymentStatus };
