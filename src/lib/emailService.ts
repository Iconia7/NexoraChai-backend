import nodemailer from 'nodemailer';

const ZOHO_HOST = process.env.ZOHO_HOST || 'smtp.zoho.com';
const ZOHO_PORT = parseInt(process.env.ZOHO_PORT || '465');
const ZOHO_USER = process.env.ZOHO_USER;
const ZOHO_PASS = process.env.ZOHO_PASS;
const ZOHO_FROM = process.env.ZOHO_FROM_EMAIL || 'Nexora Chai <hello@nexoracreatives.co.ke>';
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';

const transporter = nodemailer.createTransport({
  host: ZOHO_HOST,
  port: ZOHO_PORT,
  secure: ZOHO_PORT === 465,
  auth: {
    user: ZOHO_USER,
    pass: ZOHO_PASS,
  },
});

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nexora Chai</title>
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #FFF9F0;
            margin: 0;
            padding: 0;
            color: #1A1A1A;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.05);
            border: 1px solid rgba(0,0,0,0.02);
        }
        .header {
            background-color: #914D00;
            padding: 40px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 900;
            letter-spacing: -0.5px;
        }
        .content {
            padding: 40px;
            line-height: 1.6;
        }
        .content h2 {
            font-size: 20px;
            font-weight: 800;
            margin-bottom: 20px;
            color: #1A1A1A;
        }
        .content p {
            margin-bottom: 20px;
            color: #666666;
            font-weight: 500;
        }
        .button-container {
            text-align: center;
            margin-top: 30px;
        }
        .button {
            display: inline-block;
            background-color: #914D00;
            color: #ffffff !important;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 4px 15px rgba(145, 77, 0, 0.2);
        }
        .footer {
            background-color: #f9fafb;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #f3f4f6;
        }
        .footer p {
            font-size: 12px;
            color: #9ca3af;
            margin: 0;
        }
        .logo-img {
            width: 40px;
            height: 40px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>NEXORA CHAI</h1>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Nexora Creatives. All rights reserved.</p>
            <p>Empowering creators across Africa.</p>
        </div>
    </div>
</body>
</html>
`;

export const sendWelcomeEmail = async (email: string, displayName: string) => {
  const content = `
    <h2>Welcome to the community, ${displayName}! ☕</h2>
    <p>We're thrilled to have you on board. Nexora Chai was built to help creators like you receive support directly from your fans, instantly and securely.</p>
    <p>Your creator profile is almost ready. Share your link and start receiving support via M-Pesa and Card.</p>
    <div class="button-container">
        <a href="${FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
    </div>
  `;
  
  try {
    await transporter.sendMail({
      from: ZOHO_FROM,
      to: email,
      subject: 'Welcome to Nexora Chai! ☕',
      html: emailWrapper(content),
    });
    console.log(`Welcome email sent to ${email}`);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
  const content = `
    <h2>Reset your password</h2>
    <p>We received a request to reset the password for your Nexora Chai account. If you didn't make this request, you can safely ignore this email.</p>
    <p>Click the button below to choose a new password. This link will expire in 1 hour.</p>
    <div class="button-container">
        <a href="${resetLink}" class="button">Reset Password</a>
    </div>
    <p style="margin-top: 30px; font-size: 12px; color: #9ca3af;">If the button doesn't work, copy and paste this link into your browser:<br>${resetLink}</p>
  `;

  try {
    await transporter.sendMail({
      from: ZOHO_FROM,
      to: email,
      subject: 'Reset your Nexora Chai password',
      html: emailWrapper(content),
    });
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
};

export const verifyTransporter = async () => {
    try {
        await transporter.verify();
        console.log('Transporter is ready to send emails');
        return true;
    } catch (error) {
        console.error('Transporter verification failed:', error);
        return false;
    }
};
