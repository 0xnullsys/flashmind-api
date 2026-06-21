/**
 * Cloudinary onboarding script — TypeScript (Node)
 *
 * Flow:
 *  1. Configure Cloudinary with inline credentials
 *  2. Upload a sample image from Cloudinary's demo domain
 *  3. Fetch + print image metadata (width, height, format, bytes)
 *  4. Generate a transformed URL (f_auto + q_auto) and print
 *
 * Run:   npx tsx scripts/cloudinary-onboard.ts
 */

import { v2 as cloudinary } from 'cloudinary';

// 1. Configure Cloudinary — inline credentials (no .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,    // ← replace this
  api_key: process.env.CLOUDINARY_API_KEY,   // ← replace this
  api_secret: process.env.CLOUDINARY_API_SECRET, // ← replace this
  secure: true,
});

const SAMPLE_IMAGE =
  'https://res.cloudinary.com/demo/image/upload/sample.jpg';

async function main() {
  // 2. Upload sample image from Cloudinary demo domain
  console.log('Uploading sample image...');
  const uploadResult = await cloudinary.uploader.upload(SAMPLE_IMAGE, {
    folder: 'flashmind-onboard',
    public_id: 'sample',
    overwrite: true,
  });
  console.log('Uploaded!');
  console.log('  secure_url :', uploadResult.secure_url);
  console.log('  public_id  :', uploadResult.public_id);

  // 3. Fetch image details (metadata)
  console.log('\nFetching image details...');
  const details = await cloudinary.api.resource(uploadResult.public_id, {
    image_metadata: true,
  });
  console.log('  width  :', details.width);
  console.log('  height :', details.height);
  console.log('  format :', details.format);
  console.log('  bytes  :', details.bytes);

  // 4. Transform: f_auto picks best modern format (avif/webp) per browser,
  //              q_auto compresses to perceived-quality sweet spot.
  const transformedUrl = cloudinary.url(uploadResult.public_id, {
    secure: true,
    transformation: [
      { fetch_format: 'auto' }, // f_auto
      { quality: 'auto' },      // q_auto
    ],
  });

  console.log('\nDone! Click link below to see optimized version of the image. Check the size and the format.');
  console.log('  Transformed URL:', transformedUrl);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
