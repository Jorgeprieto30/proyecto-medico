export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    // Proteger rutas del panel admin; excluir auth, portal y assets
    '/((?!login|register|api/auth|portal|_next/static|_next/image|favicon.ico).*)',
  ],
};
