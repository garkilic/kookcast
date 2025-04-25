import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log('Middleware called for path:', pathname);
  
  // Allow access to all pages for now
  // We'll implement proper auth checks later
  const response = NextResponse.next();
  
  // Add some headers for debugging
  response.headers.set('x-middleware-cache', 'no-cache');
  response.headers.set('x-middleware-path', pathname);
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 