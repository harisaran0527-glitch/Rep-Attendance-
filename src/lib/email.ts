import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  senderName: string;
  senderEmail: string;
}

export interface MonthlyWarningEmailParams {
  studentName: string;
  studentEmail: string;
  registerNumber: string;
  department: string;
  year: string;
  section: string;
  percentage: number;
  threshold: number;
  totalWorkingSessions: number;
  presentCount: number;
  absentCount: number;
  month: string;
  warningDate: string;
  alertDateTimeStr?: string;
  trackingToken?: string;
  smtpSettings: SmtpConfig;
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || 'N/A';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
}

export async function sendEmailWithProvider(payload: {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  registerNumber?: string;
  studentName?: string;
  smtpSettings: SmtpConfig;
}): Promise<{
  success: boolean;
  status: string;
  providerName: string;
  requestAttempted: boolean;
  messageId?: string;
  error?: string;
}> {
  const { to, subject, bodyText, bodyHtml, registerNumber, smtpSettings } = payload;
  const maskedTo = maskEmail(to);

  // 1. Check Resend API Key
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey && resendApiKey.trim().length > 0) {
    const fromAddr = process.env.RESEND_FROM || `${smtpSettings.senderName || 'College Attendance Portal'} <onboarding@resend.dev>`;
    console.log(`[EMAIL DIAGNOSTIC] RegNo: ${registerNumber || 'N/A'}, Recipient: ${maskedTo}, Provider: Resend API, Attempting Request: Yes`);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [to],
          subject: subject,
          html: bodyHtml,
          text: bodyText,
        }),
      });

      const data = await res.json();
      if (res.ok && data?.id) {
        console.log(`[EMAIL DIAGNOSTIC] RegNo: ${registerNumber || 'N/A'}, Provider: Resend API, Response ACCEPTED, MessageID: ${data.id}`);
        return {
          success: true,
          status: 'Sent',
          providerName: 'Resend API',
          requestAttempted: true,
          messageId: data.id,
        };
      } else {
        const errMsg = data?.message || data?.error?.message || `HTTP ${res.status} ${res.statusText}`;
        console.error(`[EMAIL DIAGNOSTIC] RegNo: ${registerNumber || 'N/A'}, Provider: Resend API, Response REJECTED, Error: ${errMsg}`);
        return {
          success: false,
          status: 'Failed',
          providerName: 'Resend API',
          requestAttempted: true,
          error: `Resend API Error: ${errMsg}`,
        };
      }
    } catch (err: any) {
      console.error(`[EMAIL DIAGNOSTIC] RegNo: ${registerNumber || 'N/A'}, Provider: Resend API, Request EXCEPTION, Error: ${err.message}`);
      return {
        success: false,
        status: 'Failed',
        providerName: 'Resend API',
        requestAttempted: true,
        error: err.message || 'Resend request failed',
      };
    }
  }

  // 2. Check Nodemailer / SMTP Settings
  const smtpHost = process.env.SMTP_HOST || smtpSettings.host;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : smtpSettings.port;
  const smtpSecure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : smtpSettings.secure;
  const smtpUser = process.env.SMTP_USER || smtpSettings.user;
  const smtpPassword = process.env.SMTP_PASS || smtpSettings.password;

  const isSmtpConfigured =
    smtpHost &&
    smtpPort &&
    smtpUser &&
    smtpUser.trim().length > 0 &&
    smtpPassword &&
    smtpPassword.trim().length > 0;

  if (isSmtpConfigured) {
    console.log(`[EMAIL DIAGNOSTIC] RegNo: ${registerNumber || 'N/A'}, Recipient: ${maskedTo}, Provider: Nodemailer SMTP (${smtpHost}), Attempting Request: Yes`);
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: Boolean(smtpSecure),
        auth: {
          user: smtpUser.trim(),
          pass: smtpPassword.trim(),
        },
      });

      const fromEmail = smtpSettings.senderEmail || smtpUser.trim();
      const info = await transporter.sendMail({
        from: `"${smtpSettings.senderName || 'College Attendance Portal'}" <${fromEmail}>`,
        to: to,
        subject: subject,
        text: bodyText,
        html: bodyHtml,
      });

      if (info && info.messageId) {
        console.log(`[EMAIL DIAGNOSTIC] RegNo: ${registerNumber || 'N/A'}, Provider: Nodemailer SMTP, Response ACCEPTED, MessageID: ${info.messageId}`);
        return {
          success: true,
          status: 'Sent',
          providerName: `Nodemailer SMTP (${smtpHost})`,
          requestAttempted: true,
          messageId: info.messageId,
        };
      } else {
        console.error(`[EMAIL DIAGNOSTIC] RegNo: ${registerNumber || 'N/A'}, Provider: Nodemailer SMTP, Response NO MESSAGE ID`);
        return {
          success: false,
          status: 'Failed',
          providerName: `Nodemailer SMTP (${smtpHost})`,
          requestAttempted: true,
          error: 'SMTP server returned no message ID.',
        };
      }
    } catch (err: any) {
      const safeErr = err?.message || 'SMTP delivery failed';
      console.error(`[EMAIL DIAGNOSTIC] RegNo: ${registerNumber || 'N/A'}, Provider: Nodemailer SMTP, Error: ${safeErr}`);
      return {
        success: false,
        status: 'Failed',
        providerName: `Nodemailer SMTP (${smtpHost})`,
        requestAttempted: true,
        error: safeErr,
      };
    }
  }

  // 3. No Email Provider Credentials Configured
  console.warn(`[EMAIL DIAGNOSTIC] RegNo: ${registerNumber || 'N/A'}, Recipient: ${maskedTo}, Provider: None, Attempting Request: No, Status: Failed — Email provider not configured`);
  return {
    success: false,
    status: 'Failed — Email provider not configured',
    providerName: 'None',
    requestAttempted: false,
    error: 'Email provider credentials (Resend API Key or SMTP User/Pass) are missing or not configured.',
  };
}

export async function sendLowAttendanceEmail(
  params: MonthlyWarningEmailParams
): Promise<{
  success: boolean;
  status: string;
  providerName?: string;
  requestAttempted?: boolean;
  messageId?: string;
  error?: string;
}> {
  const {
    studentName,
    studentEmail,
    registerNumber,
    department,
    year,
    section,
    percentage,
    threshold,
    totalWorkingSessions,
    presentCount,
    absentCount,
    month,
    warningDate,
    alertDateTimeStr,
    trackingToken,
    smtpSettings,
  } = params;

  const subject = `Attendance Alert — Your Attendance is Below Required Percentage`;
  const appName = smtpSettings.senderName || 'College Attendance Portal';
  const alertTimeFormatted = alertDateTimeStr || `${warningDate} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://rep-attendance.vercel.app');
  const trackingPixelHtml = trackingToken
    ? `<img src="${baseUrl}/api/email-track/${trackingToken}" width="1" height="1" style="display:none; width:1px; height:1px; opacity:0;" alt="" />`
    : '';

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9;">
        <h2 style="color: #e11d48; margin: 0; font-size: 20px;">Attendance Alert — Low Attendance Warning</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 6px; font-weight: 600;">${appName}</p>
      </div>

      <div style="padding: 24px 0;">
        <p style="font-size: 15px; margin: 0 0 14px 0;">Dear <strong>${studentName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
          This is an official low-attendance warning alert. Your current overall attendance percentage is <strong style="color: #e11d48; font-size: 16px;">${percentage}%</strong>, which is strictly below the required minimum threshold of <strong>${threshold}%</strong>.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <h4 style="margin: 0 0 14px 0; color: #0f172a; font-size: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">Student Attendance Summary</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
            <tr><td style="padding: 6px 0; font-weight: bold; width: 45%;">Student Name:</td><td>${studentName}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Register Number:</td><td style="font-family: monospace; font-weight: bold; color: #2563eb;">${registerNumber}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Department & Class:</td><td>${department} &bull; ${year} Year (${section})</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Current Attendance:</td><td style="color: #e11d48; font-weight: bold; font-size: 15px;">${percentage}%</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Required Minimum:</td><td style="font-weight: bold;">${threshold}%</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Total Sessions:</td><td>${totalWorkingSessions} Sessions</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Sessions Attended:</td><td style="color: #16a34a; font-weight: bold;">${presentCount} Days</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Sessions Absent:</td><td style="color: #dc2626; font-weight: bold;">${absentCount} Days</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Alert Date & Time:</td><td>${alertTimeFormatted}</td></tr>
          </table>
        </div>

        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; padding: 18px; border-radius: 10px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #9f1239; font-weight: 700;">
            URGENT ACTION REQUIRED:
          </p>
          <p style="margin: 0; font-size: 13px; color: #881337; line-height: 1.5;">
            Please attend all upcoming classes regularly to improve your attendance percentage above ${threshold}%. Contact your Class Representative or HOD immediately for any attendance corrections.
          </p>
        </div>
      </div>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; font-size: 13px; color: #64748b;">
        <p style="margin: 0;">Regards,</p>
        <p style="margin: 4px 0 0 0; font-weight: bold; color: #0f172a;">${appName} Administration</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Class Representative & Attendance Management System</p>
      </div>
      ${trackingPixelHtml}
    </div>
  `;

  const bodyText = `ATTENDANCE ALERT — YOUR ATTENDANCE IS BELOW REQUIRED PERCENTAGE
${appName}

Dear ${studentName},

This is an official low-attendance warning alert. Your current overall attendance percentage is ${percentage}%, which is strictly below the required minimum threshold of ${threshold}%.

Student Attendance Summary:
- Student Name: ${studentName}
- Register Number: ${registerNumber}
- Department: ${department} (${year} Year - ${section})
- Current Attendance Percentage: ${percentage}%
- Required Minimum Percentage: ${threshold}%
- Total Sessions: ${totalWorkingSessions} Days
- Sessions Attended: ${presentCount} Days
- Sessions Absent: ${absentCount} Days
- Alert Date & Time: ${alertTimeFormatted}

URGENT ACTION REQUIRED:
Please attend all upcoming classes regularly to improve your attendance percentage above ${threshold}%. Contact your Class Representative or HOD immediately.

Regards,
${appName} Administration`;

  return sendEmailWithProvider({
    to: studentEmail,
    subject,
    bodyText,
    bodyHtml,
    registerNumber,
    studentName,
    smtpSettings,
  });
}
