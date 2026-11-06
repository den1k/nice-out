/** @type {import('next').NextConfig} */
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  // Note: This is only an example. If you use Pages Router,
  // use something else that works, such as "service-worker/index.ts".
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
})
const nextConfig = {
  // next/image is unused. This makes /_next/image return 404, which closes the
  // Image Optimization API advisories that Next 14 will not get a patch for.
  images: { unoptimized: true },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    })

    return config
  },
}

export default withSerwist({
  // Your Next.js config
  ...nextConfig,
})
