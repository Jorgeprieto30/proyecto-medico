/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Excluir /api/auth/* (rutas de NextAuth) del proxy al backend
      {
        source: '/api/((?!auth).*)',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
