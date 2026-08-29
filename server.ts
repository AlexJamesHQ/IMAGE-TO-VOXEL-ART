import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { generateImage, generateVoxelScene } from "./services/gemini";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload size limit for base64 images
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // API: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API: Generate Image
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, aspectRatio, useOptimization, customApiKey } = req.body;
      const imageUrl = await generateImage(prompt, aspectRatio, useOptimization, customApiKey);
      res.json({ imageUrl });
    } catch (error: any) {
      console.error("Server API generate-image error:", error);
      res.status(500).json({ error: error?.message || "Image generation failed." });
    }
  });

  // API: Generate Voxel (Stream thoughts and final result)
  app.post("/api/generate-voxel-stream", async (req, res) => {
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
      console.error("Server API generate-voxel-stream error:", error);
      res.write(`data: ${JSON.stringify({ type: 'error', text: error?.message || "Voxel generation failed." })}\n\n`);
      res.end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
