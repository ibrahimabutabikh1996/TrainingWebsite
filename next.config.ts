import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Files under public/ are served with `Cache-Control: public, max-age=0` by
  // default, so every visit re-validates the 357 KB icon font over the network.
  // The font filenames carry their version, so they can be cached permanently —
  // if a font file is ever replaced, rename it rather than overwriting it.
  async headers() {
    return [
      {
        source: '/fonts/:file*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
