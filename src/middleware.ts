import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('admin_session')?.value;
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname === '/login';
  const isAppRoute =
    pathname === '/' ||
    pathname.startsWith('/students') ||
    pathname.startsWith('/attendance') ||
    pathname.startsWith('/history') ||
    pathname.startsWith('/reports');

  if (isAppRoute && session !== 'admin@gmail.com') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthRoute && session === 'admin@gmail.com') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
