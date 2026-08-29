# Image to Voxel Art (3D Voxel Scene Generator)

An interactive web application that transforms reference photographs and generated concept art into animated 3D Three.js voxel art scenes.

---

## 🌟 Features

- **Image to 3D Voxel Conversion**: Upload any image (PNG, JPG, WEBP, HEIC) to generate an interactive 3D voxel art diorama.
- **AI Image Generation**: Generate custom scenes and subjects directly using text prompts.
- **Pure 3D Voxel Viewer**:
  - Full 360° OrbitControls (drag to rotate, scroll to zoom, right-click to pan).
  - High-performance instanced mesh rendering.
  - Realistic lighting, soft shadows, atmospheric fog, and particle effects.
- **Instant Code Inspection & Export**: Inspect the complete standalone Three.js HTML code, copy it to your clipboard, or export it for your own 3D web games or applications.
- **Curated Example Gallery**: Explore pre-built 3D voxel dioramas with one click.
- **API Key Management**: Seamless API key integration with custom key support stored securely in browser local storage.

---

## 🛠️ Tech Stack

- **Frontend**: React 18+, TypeScript, Vite, Tailwind CSS
- **3D Graphics Engine**: Three.js (WebGL, InstancedMesh, Soft Shadows, OrbitControls)
- **AI & Vision Engine**: Google Gen AI SDK (`@google/genai`)
  - Image generation: Imagen / Gemini Flash Image models
  - Voxel code generation: Gemini Multimodal models

---

## 🚀 Getting Started

### 1. Installation

Install all required dependencies:

```bash
npm install
```

### 2. Environment Setup

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Add your Gemini API key in `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

*(You can also configure your API key directly in the app UI via the API Key button).*

### 3. Development Server

Start the local development server on port 3000:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### 4. Production Build

```bash
npm run build
npm start
```

---

## 🎮 How to Use

1. **Upload or Generate**:
   - Drag & drop or upload any photo/drawing.
   - Or click **+ GENERATE** and type a text prompt (e.g., *"A cozy Japanese tea house surrounded by cherry blossom trees"*).
2. **View Voxel Scene**:
   - Once generation completes, click **VIEW SCENE** to interact with the 3D voxel world.
   - Drag with your mouse or finger to rotate the camera.
   - Scroll or pinch to zoom in/out.
3. **Inspect & Export Code**:
   - Click **</> VIEW CODE** to view the full HTML/Three.js source code.
   - Copy or download the standalone HTML file to run locally or embed in your projects.

---

## 📄 License

MIT License. Feel free to use and customize for your own creative 3D projects!
