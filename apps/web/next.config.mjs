/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@vaultdrop/crypto", "@vaultdrop/ui"],
  reactStrictMode: true,
};

export default nextConfig;
