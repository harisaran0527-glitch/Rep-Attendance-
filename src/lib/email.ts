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
  smtpSettings: SmtpConfig;
}

export async function sendLowAttendanceEmail(
  params: MonthlyWarningEmailParams
): Promise<{ success: boolean; status: 'Sent' | 'Simulated'; error?: string }> {
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
    smtpSettings,
  } = params;

  const subject = `Monthly Attendance Warning – Attendance Below 75%`;
  const appName = smtpSettings.senderName || 'College Attendance Portal';

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9;">
        <h2 style="color: #e11d48; margin: 0; font-size: 22px;">Monthly Attendance Warning – Below 75%</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 6px; font-weight: 600;">${appName}</p>
      </div>

      <div style="padding: 24px 0;">
        <p style="font-size: 15px; margin: 0 0 14px 0;">Dear <strong>${studentName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
          This is an official monthly attendance warning notification for <strong>${month}</strong>. Your current overall attendance percentage is <strong style="color: #e11d48; font-size: 16px;">${percentage}%</strong>, which is strictly below the required minimum of <strong>${threshold}%</strong>.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <h4 style="margin: 0 0 14px 0; color: #0f172a; font-size: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">Student Attendance Record Breakdown</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
            <tr><td style="padding: 6px 0; font-weight: bold; width: 45%;">Student Name:</td><td>${studentName}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Register Number:</td><td style="font-family: monospace; font-weight: bold; color: #2563eb;">${registerNumber}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Class / Department:</td><td>${department} &bull; ${year} Year (Sec ${section})</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Evaluation Month & Date:</td><td>${month} (${warningDate})</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Total Working Sessions:</td><td>${totalWorkingSessions} Days</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Days Present (incl. OD):</td><td style="color: #16a34a; font-weight: bold;">${presentCount} Days</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Days Absent:</td><td style="color: #dc2626; font-weight: bold;">${absentCount} Days</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Current Attendance Rate:</td><td style="color: #e11d48; font-weight: bold; font-size: 15px;">${percentage}%</td></tr>
            <tr><td style="padding: 6px 0; font-weight: bold;">Required Minimum:</td><td style="font-weight: bold;">${threshold}%</td></tr>
          </table>
        </div>

        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; padding: 18px; border-radius: 10px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #9f1239; font-weight: 700;">
            WARNING NOTICE & ACTION REQUIRED:
          </p>
          <p style="margin: 0; font-size: 13px; color: #881337; line-height: 1.5;">
            You are required to attend all upcoming scheduled sessions to improve your percentage above ${threshold}%. Please contact your Class Representative or Department Administration immediately if you require clarification regarding your attendance records.
          </p>
        </div>
      </div>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; font-size: 13px; color: #64748b;">
        <p style="margin: 0;">Regards,</p>
        <p style="margin: 4px 0 0 0; font-weight: bold; color: #0f172a;">${appName} Administration</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Class Representative & Attendance Management System</p>
      </div>
    </div>
  `;

  const bodyText = `MONTHLY ATTENDANCE WARNING – ATTENDANCE BELOW 75%
${appName}

Dear ${studentName},

This is an official monthly attendance warning notification for ${month}. Your overall attendance percentage is ${percentage}%, which is strictly below the required minimum of ${threshold}%.

Student Attendance Record Breakdown:
- Student Name: ${studentName}
- Register Number: ${registerNumber}
- Department: ${department}
- Year: ${year}
- Section: ${section}
- Evaluation Month: ${month}
- Warning Date: ${warningDate}
- Total Working Sessions: ${totalWorkingSessions} Days
- Days Present (incl. OD): ${presentCount} Days
- Days Absent: ${absentCount} Days
- Current Attendance: ${percentage}%
- Minimum Required: ${threshold}%

WARNING NOTICE & ACTION REQUIRED:
You are required to attend all upcoming scheduled sessions to improve your percentage above ${threshold}%. Please contact your Class Representative or Department Administration immediately if you require clarification.

Regards,
${appName} Administration`;

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
        secure: smtpSettings.secure,
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

      console.log(`[SMTP] Monthly warning email successfully sent to ${studentEmail}. MessageId: ${info.messageId}`);
      return { success: true, status: 'Sent' };
    } catch (err: any) {
      console.error(`[SMTP] Error sending monthly warning email to ${studentEmail}:`, err);
      return { success: false, status: 'Simulated', error: err.message };
    }
  } else {
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
