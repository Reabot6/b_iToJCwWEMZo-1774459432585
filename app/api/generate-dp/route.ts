import { NextRequest, NextResponse } from 'next/server';
import { removeBackground } from '@imgly/background-removal-node';

export const maxDuration = 60;
export const runtime = 'nodejs';

const MIME_MAP: Record<string, string> = {
  'image/jpeg':    'image/jpeg',
  'image/jpg':     'image/jpeg',
  'image/png':     'image/png',
  'image/webp':    'image/webp',
  'image/gif':     'image/gif',
  'image/bmp':     'image/bmp',
  'image/tiff':    'image/tiff',
  'image/heic':    'image/jpeg',
  'image/heif':    'image/jpeg',
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB' }, { status: 400 });
    }

    // Resolve mime type — browser sometimes sends empty or wrong type
    let mimeType = file.type?.toLowerCase() || '';

    if (!mimeType || !MIME_MAP[mimeType]) {
      const ext = file.name?.split('.').pop()?.toLowerCase() ?? '';
      const extMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
        tiff: 'image/tiff', tif: 'image/tiff',
        heic: 'image/jpeg', heif: 'image/jpeg',
      };
      mimeType = extMap[ext] ?? 'image/jpeg';
    }

    const resolvedMime = MIME_MAP[mimeType] ?? 'image/jpeg';

    console.log(`[DP] File: ${file.name} | browser type: "${file.type}" → resolved: ${resolvedMime}`);

    const arrayBuffer = await file.arrayBuffer();

    // Pass as a Blob with explicit correct mime type — required by the library
    const inputBlob = new Blob([arrayBuffer], { type: resolvedMime });

    console.log('[DP] Running background removal...');
    const resultBlob = await removeBackground(inputBlob);

    const resultBuffer = Buffer.from(await resultBlob.arrayBuffer());

    console.log('[DP] Done. Returning PNG cutout.');

    return new NextResponse(resultBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="person-cutout.png"',
      },
    });

  } catch (error: any) {
    console.error('[DP] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove background' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}