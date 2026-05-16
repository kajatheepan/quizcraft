/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      poll: 1000,
      aggregateTimeout: 300,
      followSymlinks: false,
      ignored: [
        "**/.git/**",
        "**/.next/**",
        "**/node_modules/**",
        "**/coverage/**",
        "**/dist/**",
        "**/build/**",
        "/mnt/**/.git/**",
        "/mnt/**/.next/**",
        "/mnt/**/node_modules/**",
      ],
    };

    return config;
  },
};

module.exports = nextConfig;
