import nodemailer from 'nodemailer';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  senderName: string;
  senderEmail: string;
}

export async function sendLowAttendanceEmail(
  studentName: string,
  studentEmail: string,
  percentage: number,
  threshold: number,
  smtpSettings: SmtpConfig,
  attended: number = 0,
  total: number = 0
): Promise<{ success: boolean; status: 'Sent' | 'Simulated'; error?: string }> {
  // Calculate classes needed to reach threshold
  const classesNeeded = total > 0 ? Math.max(0, Math.ceil(3 * total - 4 * attended)) : 0;
  
  const subject = `Attendance Notice: Low Attendance Alert (${percentage}%)`;
  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #f1f5f9;">
        <h2 style="color: #e11d48; margin: 0; font-size: 20px;">Low Attendance Notification</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">College Attendance Monitoring System</p>
      </div>

      <div style="padding: 20px 0;">
        <p style="font-size: 15px; margin: 0 0 12px 0;">Dear <strong>${studentName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
          We are writing to gently inform you that your current overall attendance percentage is <strong>${percentage}%</strong> (${attended} out of ${total} periods attended).
        </p>

        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #9f1239; font-weight: 600;">
            ⚠️ Required Attendance Threshold: ${threshold}%
          </p>
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #be123c; line-height: 1.5;">
            Your attendance is currently below the mandatory ${threshold}% requirement. We strongly encourage you to attend your regular classes consistently to improve your standing.
          </p>
          ${classesNeeded > 0 ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #881337; font-weight: 600;">👉 Target Advice: You need to attend the next <strong>${classesNeeded}</strong> periods consecutively to reach the ${threshold}% mark.</p>` : ''}
        </div>

        <p style="font-size: 13px; line-height: 1.6; color: #475569; margin: 16px 0 0 0;">
          If you have any valid medical reasons or duty approvals, please submit the necessary documents to your class advisor at the earliest.
        </p>
      </div>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 12px; color: #64748b;">
        <p style="margin: 0;">Warm regards,</p>
        <p style="margin: 4px 0 0 0; font-weight: bold; color: #1e293b;">${smtpSettings.senderName || 'College Administration'}</p>
      </div>
    </div>
  `;

  const bodyText = `
    Dear ${studentName},
    
    We are writing to inform you that your current overall attendance is ${percentage}% (${attended}/${total} periods).
    
    The minimum required attendance threshold is ${threshold}%.
    
    Your attendance has fallen below the required threshold. Please make sure to attend upcoming classes consistently to improve your attendance percentage.
    
    Target Advice: You need to attend the next ${classesNeeded} periods consecutively to reach ${threshold}%.
    
    Sincerely,
    ${smtpSettings.senderName || 'College Administration'}
  `;

  // Determine if SMTP is fully configured
  const isSmtpConfigured =
    smtpSettings.host &&
    smtpSettings.port &&
    smtpSettings.user &&
    smtpSettings.password;

  if (isSmtpConfigured) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpSettings.host,
        port: smtpSettings.port,
        secure: smtpSettings.secure, // true for 465, false for 587/other
        auth: {
          user: smtpSettings.user,
          pass: smtpSettings.password,
        },
      });

      const info = await transporter.sendMail({
        from: `"${smtpSettings.senderName}" <${smtpSettings.senderEmail || smtpSettings.user}>`,
        to: studentEmail,
        subject: subject,
        text: bodyText,
        html: bodyHtml,
      });

      console.log(`[SMTP] Email warning successfully sent to ${studentEmail}. MessageId: ${info.messageId}`);
      return { success: true, status: 'Sent' };
    } catch (err: any) {
      console.error(`[SMTP] Error sending actual email warning to ${studentEmail}:`, err);
      return { success: false, status: 'Simulated', error: err.message };
    }
  } else {
    // Simulated delivery (e.g. SMTP config is blank)
    console.log(`
=============================================
[EMAIL SIMULATOR] (No SMTP Configured)
To: ${studentEmail} (${studentName})
Subject: ${subject}
Percentage: ${percentage}% (Threshold: ${threshold}%)
Sender: ${smtpSettings.senderName}
=============================================
${bodyText}
=============================================
    `);
    return { success: true, status: 'Simulated' };
  }
}
