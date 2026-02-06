const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Generate a random 6-digit OTP code
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP verification email using Resend
 */
const sendOTPEmail = async (to, otpCode) => {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_EMAIL_FROM || 'onboarding@resend.dev',
      to,
      subject: 'Your i-Net Verification Code',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background-color: #f8fafc; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 8px;">i-Net</h1>
            <p style="color: #64748b; font-size: 14px; margin: 0;">Email Verification</p>
          </div>
          <div style="background-color: #ffffff; padding: 32px; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <p style="color: #334155; font-size: 16px; margin-bottom: 24px;">
              Use the following code to verify your account:
            </p>
            <div style="background-color: #f1f5f9; padding: 16px 24px; border-radius: 8px; display: inline-block; margin-bottom: 24px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0891b2;">
                ${otpCode}
              </span>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">
              This code expires in <strong>10 minutes</strong>.<br/>
              If you didn't request this, please ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend email error:', error);
      throw new Error(error.message || 'Failed to send email');
    }

    console.log('OTP email sent successfully:', data?.id);
    return data;
  } catch (error) {
    console.error('Email sending failed:', error.message);
    throw error;
  }
};

module.exports = { generateOTP, sendOTPEmail };
