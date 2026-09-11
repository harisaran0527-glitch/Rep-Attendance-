import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 1x1 transparent PNG pixel buffer
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const resolvedParams = await params;
    const token = resolvedParams?.token;

    if (token && typeof token === 'string' && token.trim().length > 0) {
      const cleanToken = token.trim();

      // Find matching email log by unique trackingToken
      const emailLog = await prisma.emailLog.findFirst({
        where: { trackingToken: cleanToken },
        select: { id: true, opened: true },
      });

      if (emailLog) {
        // Mark opened = true and set openedAt timestamp
        await prisma.emailLog.update({
          where: { id: emailLog.id },
          data: {
            opened: true,
            openedAt: emailLog.opened ? undefined : new Date(),
          },
        });
      }
    }
  } catch (error) {
    console.error('Error tracking email open pixel:', error);
  }

  // Always return 1x1 transparent PNG image response
  return new NextResponse(TRANSPARENT_PNG, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': TRANSPARENT_PNG.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
