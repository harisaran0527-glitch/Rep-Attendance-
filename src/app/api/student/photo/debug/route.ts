export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * TEMPORARY diagnostic endpoint — reveals only whether env vars exist (never their values).
 * Remove after fixing the blob credential issue.
 */
export async function GET() {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const blobStoreId = process.env.BLOB_STORE_ID;
  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  const vercelEnv = process.env.VERCEL_ENV;
  const isVercel = process.env.VERCEL;
  const nodeEnv = process.env.NODE_ENV;

  return NextResponse.json({
    diagnostics: {
      hasBlobToken: typeof blobToken === 'string' && blobToken.trim().length > 0,
      blobTokenLength: typeof blobToken === 'string' ? blobToken.trim().length : 0,
      blobTokenPrefix: typeof blobToken === 'string' ? blobToken.substring(0, 16) + '...' : 'MISSING',
      hasBlobStoreId: typeof blobStoreId === 'string' && blobStoreId.trim().length > 0,
      hasOidcToken: typeof oidcToken === 'string' && oidcToken.trim().length > 0,
      vercelEnv: vercelEnv || 'NOT_SET',
      isVercel: isVercel || 'NOT_SET',
      nodeEnv: nodeEnv || 'NOT_SET',
      runtime: 'nodejs',
    },
  });
}
