/** @type {import('next').NextConfig} */
const nextConfig = {
  // Necessário para a imagem Docker: gera .next/standalone com server.js
  output: 'standalone',
  poweredByHeader: false,
};

module.exports = nextConfig;
