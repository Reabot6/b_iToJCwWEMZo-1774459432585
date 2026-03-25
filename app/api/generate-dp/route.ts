import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  const tempDir = '/tmp/dp-generator';
  let inputPath = '';
  let outputPath = '';

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const name = (formData.get('name') as string || '').trim();

    if (!file) return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5MB' }, { status: 400 });
    }

    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    inputPath = join(tempDir, `input-${timestamp}.png`);
    outputPath = join(tempDir, `cutout-${timestamp}.png`);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);

    const basePath = process.cwd();
    const scriptPath = join(basePath, 'scripts', 'process-dp.py');

    // ✅ FIXED: Always use python3 on Vercel (python command doesn't exist)
    const pythonCmd = 'python3';

    const command = `"${pythonCmd}" "${scriptPath}" "${inputPath}" "${outputPath}" "${name}"`;
    console.log(`[DP] Running: ${command}`);

    const output = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 30 * 1024 * 1024,
    });

    const jsonMatch = output.match(/\{[\s\S]*?\}(?=\s*$)/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { success: false, error: 'No JSON from Python' };

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Processing failed' }, { status: 500 });
    }

    const { readFile } = await import('fs/promises');
    const imageBuffer = await readFile(outputPath);

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="person-cutout.png"`,
      },
    });

  } catch (error: any) {
    console.error('[DP] Full Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to generate cutout' 
    }, { status: 500 });
  } finally {
    try {
      if (inputPath && existsSync(inputPath)) await unlink(inputPath);
      if (outputPath && existsSync(outputPath)) await unlink(outputPath);
    } catch (e) {
      console.warn('[DP] Cleanup warning:', e);
    }
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}