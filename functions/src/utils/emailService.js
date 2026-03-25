import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'burlcoachapp@gmail.com',
    pass: 'zgjj mknd fljm zybd',
  },
});

export const sendWelcomeEmail = async (email, fullName, role) => {
  try {
    const mailOptions = {
      from: '"Burl Coach App" <burlcoachapp@gmail.com>',
      to: email,
      subject: 'Welcome to Burl Coach App!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:30px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background-color:#1A2B4A;padding:30px;text-align:center;">
                      <h1 style="color:#FF6B00;margin:0;font-size:28px;">Burl Coach App</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px 30px;">
                      <h2 style="color:#1A2B4A;margin-top:0;">Welcome aboard, ${fullName}!</h2>
                      <p style="color:#555;font-size:16px;line-height:1.6;">
                        Congratulations! You have successfully registered as a <strong style="color:#FF6B00;">${role}</strong> on Burl Coach App.
                      </p>
                      <p style="color:#555;font-size:16px;line-height:1.6;">
                        We are excited to have you on board. Get ready to take your cricket journey to the next level!
                      </p>

                      <p style="color:#888;font-size:14px;">
                        If you did not create this account, please ignore this email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color:#f9f9f9;padding:20px 30px;text-align:center;border-top:1px solid #eee;">
                      <p style="color:#aaa;font-size:12px;margin:0;">
                        Burl Coach App. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};
