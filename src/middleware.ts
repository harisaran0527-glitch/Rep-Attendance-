import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const adminSession = request.cookies.get('admin_session')?.value;
  const teacherSession = request.cookies.get('teacher_session')?.value;
  const studentSession = request.cookies.get('student_session')?.value;
  const { pathname } = request.nextUrl;

  const isStudentRoute = pathname === '/student' || pathname.startsWith('/student/');
  const isStudentLogin = pathname === '/student/login';
  
  const isTeacherLogin = pathname === '/teacher/login';
  const isAdminLogin = pathname === '/login';

  const isAdmin = adminSession === 'classrep@gmail.com';
  const isTeacher = !!teacherSession;
  const isStaff = isAdmin || isTeacher;

  const adminOnlyRoutes = ['/settings', '/emaillogs'];
  const isAdminOnlyRoute = adminOnlyRoutes.some((route) => pathname.startsWith(route));

  if (isStudentRoute) {
    if (!isStudentLogin && !studentSession) {
      return NextResponse.redirect(new URL('/student/login', request.url));
    }
    if (isStudentLogin && studentSession) {
      return NextResponse.redirect(new URL('/student/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (isTeacherLogin) {
    if (isTeacher) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (isAdminLogin) {
    if (isAdmin) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Admin-only route guard
  if (isAdminOnlyRoute && !isAdmin) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Staff routes guard
  if (!isStaff) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

