/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { GoogleGenAI, Modality } from "@google/genai";
import { extractHtmlFromText } from "../utils/html";

// Initialize Gemini Client dynamically with active API key
export const getActiveApiKey = (customKey?: string): string => {
  if (customKey && customKey.trim()) {
    return customKey.trim();
  }
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('custom_gemini_api_key');
    if (stored && stored.trim()) {
      return stored.trim();
    }
  }
  return process.env.GEMINI_API_KEY || process.env.API_KEY || '';
};

export const getGenAIClient = (customKey?: string): GoogleGenAI => {
  const apiKey = getActiveApiKey(customKey);
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please click 'API Key' at the top to configure your API key.");
  }
  return new GoogleGenAI({ apiKey });
};

export const IMAGE_SYSTEM_PROMPT = "Generate a vibrant, highly detailed, beautifully lit isolated object or diorama on a clean simple background, ideal for 3D voxel art conversion.";
export const VOXEL_PROMPT = `You are a master 3D voxel artist and Three.js creative developer.
Analyze the provided image thoroughly and write a complete, standalone, single-page HTML file that renders an exquisite, highly detailed 3D animated voxel art scene inspired by the image.

Key Instructions:
1. 3D VOXEL ART DIORAMA & HIGH FIDELITY:
   - Create a rich 3D voxel diorama (e.g., detailed floating island, pedestal terrain, architectural base, or layered diorama base).
   - Accurately recreate all key subjects, shapes, depth layers, silhouettes, props, and features from the image using crisp voxel blocks.
   - Extract a rich, cohesive color palette (8-16+ vibrant colors) directly from the image, including distinct highlight, midtone, and shadow tones for rich 3D depth.

2. PURE 3D SCENE (NO TEXT OVERLAYS OR UI):
   - CRITICAL: DO NOT include ANY text, HTML UI elements, titles, headers, descriptions, cards, banners, badges, tags, or instruction overlays (e.g., absolutely NO 'Drag to rotate' hints, NO subject titles, NO description cards).
   - The <body> element MUST contain ONLY the Three.js <canvas> and <script> tags. The viewport must be 100% clean 3D art with zero HTML DOM text.

3. HIGH PERFORMANCE (InstancedMesh):
   - Use THREE.InstancedMesh with THREE.BoxGeometry(1, 1, 1) and THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.15 }) or multiple InstancedMeshes by material/color to ensure buttery-smooth 60 FPS performance even with thousands of voxels.
   - Set individual instance matrices and instance colors efficiently.

4. BEAUTIFUL LIGHTING, SHADOWS & ATMOSPHERE:
   - Configure renderer.shadowMap.enabled = true and renderer.shadowMap.type = THREE.SoftShadowMap.
   - Add a bright directional sun light with shadows cast onto the scene, a soft ambient/hemisphere light, and a subtle warm rim/backlight.
   - Atmospheric background color and matching subtle fog (THREE.FogExp2) that complements the image's mood.

5. DELIGHTFUL ANIMATIONS:
   - Add smooth, subtle idle animations in the requestAnimationFrame loop (e.g. gentle floating/bobbing of the island/subject using Math.sin(time)).
   - Include ambient animated particle effects relevant to the scene (e.g. floating fireflies/sparkles, falling leaves/petals, rising chimney smoke voxels, magical embers, or water ripples).
   - Use OrbitControls with controls.enableDamping = true and gentle controls.autoRotate = true (speed ~0.5) so the user can freely explore in 3D.

6. STANDALONE & REUSABLE CODE:
   - Return a single, valid, complete HTML file starting with <!DOCTYPE html> and closing with </html>.
   - Use ES module importmap for Three.js:
     <script type="importmap">
     {
       "imports": {
         "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
         "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
       }
     }
     </script>
   - Include window resize handler to maintain proper aspect ratio.
   - Clean, well-structured, modular JavaScript code so the user can easily export, customize, and build games or applications with it.`;

export const generateImage = async (
  prompt: string, 
  aspectRatio: string = '1:1', 
  optimize: boolean = true,
  customApiKey?: string
): Promise<string> => {
  // If running on client, try server API first, with fallback to direct client call for static hosting (like Vercel)
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio, useOptimization: optimize, customApiKey }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.imageUrl) return data.imageUrl;
      }
    } catch (netErr) {
      console.warn("Server API not available, falling back to direct client generation:", netErr);
    }
  }

  // Client-side direct generation (or server-side execution):
  const ai = getGenAIClient(customApiKey);
  let finalPrompt = prompt;

  if (optimize) {
    try {
      const optResponse = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [
          `You are an expert prompt engineer. Expand this simple prompt into a highly descriptive, visually rich scenic prompt designed for an AI image generator. Describe the lighting, exact color schemes, atmosphere, precise camera angle, and artistic composition. Keep the final output under 150 words. Do not include any intros or explanations.

Prompt: ${prompt}`
        ]
      });
      if (optResponse.text) {
        finalPrompt = optResponse.text.trim();
      }
    } catch (e) {
      finalPrompt = `${IMAGE_SYSTEM_PROMPT}\n\nSubject: ${prompt}`;
    }
  }

  const imageModels = ['gemini-2.5', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite-image'];

  for (const modelName of imageModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            {
              text: finalPrompt,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData) {
            const base64ImageBytes = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            return `data:${mimeType};base64,${base64ImageBytes}`;
          }
        }
      }
    } catch (err: any) {
      console.warn(`Image generation with ${modelName} failed, trying next method:`, err?.message || err);
    }
  }

  // Fallback to Imagen 3
  try {
    const imagenResponse = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: finalPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: aspectRatio as any,
        outputMimeType: 'image/jpeg',
      },
    });

    const generatedImage = imagenResponse.generatedImages?.[0];
    if (generatedImage?.image?.imageBytes) {
      return `data:image/jpeg;base64,${generatedImage.image.imageBytes}`;
    }
  } catch (imagenErr: any) {
    console.warn("Imagen 3 fallback failed, using AI SVG vector art generator:", imagenErr);
  }

  // ULTIMATE BULLETPROOF FALLBACK: Use Gemini 3.7 Flash text model to generate custom SVG vector art
  try {
    const svgResponse = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [
        `Create a stunning, detailed, colorful vector illustration SVG XML representing: "${prompt}".
Requirements:
- Return ONLY valid raw SVG code starting with <svg> and ending with </svg>.
- Use rich colors, gradients, and shapes suitable for a 3D voxel art scene.
- Do NOT include markdown code blocks, just the raw <svg>...</svg> string.`
      ]
    });

    let svgText = svgResponse.text?.trim() || "";
    svgText = svgText.replace(/^```xml\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    const svgStart = svgText.indexOf('<svg');
    const svgEnd = svgText.lastIndexOf('</svg>');
    if (svgStart !== -1 && svgEnd !== -1) {
      const cleanSvg = svgText.substring(svgStart, svgEnd + 6);
      const base64Svg = btoa(unescape(encodeURIComponent(cleanSvg)));
      return `data:image/svg+xml;base64,${base64Svg}`;
    }
  } catch (svgErr) {
    console.warn("SVG generation fallback failed:", svgErr);
  }

  // Final procedural fallback if everything else fails
  const encodedPrompt = encodeURIComponent(prompt);
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%234f46e5"/><stop offset="100%" stop-color="%239333ea"/></linearGradient></defs><rect width="512" height="512" fill="url(%23g)"/><text x="256" y="240" font-family="sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">${encodedPrompt}</text><text x="256" y="280" font-family="sans-serif" font-size="16" fill="%23cbd5e1" text-anchor="middle">3D Voxel Scene Concept</text></svg>`;
};

export const generateVoxelScene = async (
  imageBase64: string, 
  onThoughtUpdate?: (thought: string) => void,
  customApiKey?: string
): Promise<string> => {
  // If running on client, try server API first with SSE streaming, with fallback to direct client call for static hosting (Vercel)
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/api/generate-voxel-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64, customApiKey }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalCode = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            try {
              const jsonStr = trimmed.slice(6).trim();
              if (!jsonStr) continue;
              const data = JSON.parse(jsonStr);

              if (data.type === 'thought') {
                if (onThoughtUpdate) onThoughtUpdate(data.text);
              } else if (data.type === 'result') {
                finalCode = data.text;
              } else if (data.type === 'error') {
                throw new Error(data.text);
              }
            } catch (e: any) {
              if (e.message && (e.message.includes("Voxel generation failed") || e.message.includes("Permission denied"))) {
                throw e;
              }
            }
          }
        }

        if (finalCode) {
          return finalCode;
        }
      }
    } catch (netErr) {
      console.warn("Server streaming API not available, falling back to direct client generation:", netErr);
    }
  }

  // Client-side direct generation (or server-side execution):
  const base64Data = imageBase64.split(',')[1] || imageBase64;
  const mimeMatch = imageBase64.match(/^data:(.*?);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const modelsToTry = ['gemini-2.5', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.7-flash'];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    let fullHtml = "";
    try {
      const ai = getGenAIClient(customApiKey);
      const response = await ai.models.generateContentStream({
        model: modelName,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            },
            {
              text: VOXEL_PROMPT
            }
          ]
        },
        config: {
          thinkingConfig: {
            includeThoughts: true,
          },
        },
      });

      for await (const chunk of response) {
        const candidates = chunk.candidates;
        if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
          for (const part of candidates[0].content.parts) {
            const p = part as any;
            if (p.thought) {
              if (onThoughtUpdate && p.text) {
                onThoughtUpdate(p.text);
              }
            } else {
              if (p.text) {
                fullHtml += p.text;
              }
            }
          }
        }
      }

      const extracted = extractHtmlFromText(fullHtml);
      if (extracted && extracted.length > 50) {
        return extracted;
      }
    } catch (error: any) {
      console.warn(`Voxel generation with ${modelName} failed:`, error?.message || error);
      lastError = error;
    }
  }

  throw lastError || new Error("Failed to generate 3D Voxel scene.");
};
