export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    // Proteger todas las rutas excepto login, register y assets
    '/((?!login|register|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
