import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateVoxelScene } from '../services/gemini';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, customApiKey } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const voxelCode = await generateVoxelScene(
      image,
      (thought) => {
        res.write(`data: ${JSON.stringify({ type: 'thought', text: thought })}\n\n`);
      },
      customApiKey
    );

    res.write(`data: ${JSON.stringify({ type: 'result', text: voxelCode })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("Vercel API generate-voxel-stream error:", error);
    res.write(`data: ${JSON.stringify({ type: 'error', text: error?.message || "Voxel generation failed." })}\n\n`);
    res.end();
  }
}
