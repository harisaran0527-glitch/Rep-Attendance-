import { NextRequest, NextResponse } from 'next/server';
import { runMonthlyWarningEmailJob } from '@/lib/monthly-scheduler';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const secretQuery = req.nextUrl.searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    // Check CRON_SECRET for security
    const isHeaderValid = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isQueryValid = cronSecret && secretQuery === cronSecret;

    // Reject unauthorized requests
    if (!isHeaderValid && !isQueryValid && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid or missing CRON_SECRET token.' },
        { status: 401 }
      );
    }

    const force = req.nextUrl.searchParams.get('force') === 'true';
    const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true';

    const result = await runMonthlyWarningEmailJob({
      forceRun: force,
      dryRun,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error executing monthly warning cron endpoint:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
