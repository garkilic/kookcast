import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  console.log('Middleware called for path:', request.nextUrl.pathname);
  
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth');
  const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard');

  // For now, we'll allow access to all pages
  // In a production environment, you would want to implement proper Firebase auth checks here
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*']
}; 