import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateImage } from '../services/gemini';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, aspectRatio, useOptimization, customApiKey } = req.body;
    const imageUrl = await generateImage(prompt, aspectRatio, useOptimization, customApiKey);
    return res.status(200).json({ imageUrl });
  } catch (error: any) {
    console.error("Vercel API generate-image error:", error);
    return res.status(500).json({ error: error?.message || "Image generation failed." });
  }
}
