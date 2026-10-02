/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/temp_uploads/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/temp_uploads/:path*`,
      },
    ];
  },
  distDir: process.env.NODE_ENV === 'production' ? '.next-build' : '.next',
};

export default nextConfig;
