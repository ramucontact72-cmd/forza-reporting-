/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: false,
  experimental: { optimizePackageImports: ["antd", "@ant-design/icons"] },
};

module.exports = nextConfig;
