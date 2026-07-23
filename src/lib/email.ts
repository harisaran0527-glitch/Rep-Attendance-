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
  smtpSettings: SmtpConfig
): Promise<{ success: boolean; status: 'Sent' | 'Simulated'; error?: string }> {
  const subject = `Urgent: Low Attendance Warning (${percentage}%)`;
  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #dc2626; border-bottom: 2px solid #fecaca; padding-bottom: 10px; margin-top: 0;">Attendance Alert</h2>
      <p>Dear <strong>${studentName}</strong>,</p>
      <p>This email is to notify you that your current overall attendance percentage has fallen to <strong>${percentage}%</strong>.</p>
      <p>The minimum attendance percentage required by the college is <strong>${threshold}%</strong>.</p>
      <p style="background-color: #fef2f2; border-left: 4px solid #f87171; padding: 12px; color: #991b1b; font-weight: 500;">
        You are currently below the required attendance threshold. Please contact your department advisor immediately to discuss your attendance standing.
      </p>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        Sincerely,<br />
        <strong>${smtpSettings.senderName || 'College Administration'}</strong><br />
        Attendance Monitoring System
      </p>
    </div>
  `;

  const bodyText = `
    Dear ${studentName},
    
    This is an automated notification that your overall attendance is currently ${percentage}%.
    
    The minimum required attendance is ${threshold}%.
    
    Please contact your advisor immediately.
    
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
