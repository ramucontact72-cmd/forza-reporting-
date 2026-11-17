/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: false,
  experimental: {
    serverComponentsExternalPackages: ["mongodb"],
    optimizePackageImports: ["antd", "@ant-design/icons"],
  },
};

module.exports = nextConfig;
