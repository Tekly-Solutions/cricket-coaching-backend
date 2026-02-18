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
            from: 'burlcoachapp@gmail.com',
            to: email,
            subject: 'Welcome to Burl Coach App! 🏏',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FF6B00;">Welcome to Burl Coach App!</h2>
          <p>Hi ${fullName},</p>
          <p>Congratulations! You have successfully registered as a <strong>${role}</strong>.</p>
          <p>We are excited to have you on board. Get ready to take your cricket journey to the next level!</p>
          <br>
          <p>Best Regards,</p>
          <p>The Burl Coach App Team</p>
        </div>
      `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Welcome email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending welcome email:', error);
        return false;
    }
};
