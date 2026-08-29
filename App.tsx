/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useRef, useEffect } from 'react';
import { generateImage, generateVoxelScene, IMAGE_SYSTEM_PROMPT, VOXEL_PROMPT, getActiveApiKey } from './services/gemini';
import { extractHtmlFromText, hideBodyText, zoomCamera } from './utils/html';
import { ApiKeyModal } from './components/ApiKeyModal';
import { CodeModal } from './components/CodeModal';

type AppStatus = 'idle' | 'generating_image' | 'generating_voxels' | 'error';

// Available aspect ratios
const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "16:9", "9:16"];

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif'
];

const SAMPLE_PROMPTS = [
    "A tree house under the sea",
    "A cyberpunk street food stall", 
    "An ancient temple floating in the sky",
    "A cozy winter cabin with smoke",
    "A futuristic mars rover",
    "A dragon guarding gold"
];

interface Example {
  img: string;
  html: string;
}

const EXAMPLES: Example[] = [
  { img: 'https://www.gstatic.com/aistudio/starter-apps/image_to_voxel/example1.png', html: '/examples/example1.html' },
  { img: 'https://www.gstatic.com/aistudio/starter-apps/image_to_voxel/example2.png', html: '/examples/example2.html' },
  { img: 'https://www.gstatic.com/aistudio/starter-apps/image_to_voxel/example3.png', html: '/examples/example3.html' },
];

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  
  // Main View State
  const [imageData, setImageData] = useState<string | null>(null);
  const [voxelCode, setVoxelCode] = useState<string | null>(null);
  
  // User Content Persistence (Stores the user's work separately from examples)
  const [userContent, setUserContent] = useState<{
      image: string;
      voxel: string | null;
      prompt: string;
  } | null>(null);

  // Navigation State
  const [selectedTile, setSelectedTile] = useState<number | 'user' | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  const [status, setStatus] = useState<AppStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [useOptimization, setUseOptimization] = useState(true);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [viewMode, setViewMode] = useState<'image' | 'voxel'>('image');
  
  // Custom API Key State
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return typeof window !== 'undefined' ? (localStorage.getItem('custom_gemini_api_key') || '') : '';
  });

  // Code Viewer Modal State
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Streaming Thoughts State
  const [thinkingText, setThinkingText] = useState<string | null>(null);
  
  const [loadedThumbnails, setLoadedThumbnails] = useState<Record<string, string>>({});

  // New UI States
  const [isDragging, setIsDragging] = useState(false);
  const [isViewerVisible, setIsViewerVisible] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rotate placeholders
  useEffect(() => {
    const interval = setInterval(() => {
        setPlaceholderIndex((prev) => (prev + 1) % SAMPLE_PROMPTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Load thumbnails via fetch to bypass potential img tag static serving issues
  useEffect(() => {
    const createdUrls: string[] = [];
    const loadThumbnails = async () => {
      const loaded: Record<string, string> = {};
      await Promise.all(EXAMPLES.map(async (ex) => {
        try {
          const response = await fetch(ex.img);
          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            loaded[ex.img] = url;
          }
        } catch (e) {
          console.error("Failed to load thumbnail:", ex.img, e);
        }
      }));
      setLoadedThumbnails(loaded);
    };
    loadThumbnails();

    return () => {
        // Cleanup object URLs to avoid memory leaks
        createdUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleError = (err: any) => {
    setStatus('error');
    let message = err?.message || 'An unexpected error occurred.';
    if (typeof message === 'string' && (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota'))) {
      message = 'API Quota Exceeded (429). Your API key has reached its rate limit or free tier quota. Please wait a moment or click "Custom API Key" at the top to use your own Gemini API key.';
    } else if (typeof message === 'string' && (message.includes('403') || message.includes('PERMISSION_DENIED') || message.includes('permission'))) {
      message = 'Permission denied (403). Please verify your Gemini API key has proper permissions in the API Key settings, or upload an image directly to generate 3D voxels.';
    }
    setErrorMsg(message);
    console.error(err);
  };

  const handleImageGenerate = async () => {
    if (!prompt.trim()) return;
    
    // Ensure we are effectively on the user tile logic
    setStatus('generating_image');
    setErrorMsg('');
    setImageData(null);
    setVoxelCode(null);
    setThinkingText(null);
    setViewMode('image');
    
    // Reveal viewer when generation starts
    setIsViewerVisible(true);

    try {
      // Pass the optimization flag directly to the generation service along with custom API key
      const imageUrl = await generateImage(prompt, aspectRatio, useOptimization, customApiKey);
      
      // Update User Content
      const newUserContent = {
          image: imageUrl,
          voxel: null,
          prompt: prompt
      };
      setUserContent(newUserContent);
      
      // Update View
      setImageData(imageUrl);
      setVoxelCode(null);
      setSelectedTile('user');
      
      setStatus('idle');
      setShowGenerator(false); // Close generator on success
    } catch (err) {
      handleError(err);
    }
  };

  const processFile = (file: File) => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      handleError(new Error("Invalid file type. Please upload PNG, JPEG, WEBP, HEIC, or HEIF."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      
      // Update User Content
      const newUserContent = {
          image: result,
          voxel: null,
          prompt: ''
      };
      setUserContent(newUserContent);

      // Update View
      setImageData(result);
      setVoxelCode(null);
      setViewMode('image');
      setStatus('idle');
      setErrorMsg('');
      setSelectedTile('user');
      setShowGenerator(false);
      
      // Reveal viewer on upload
      setIsViewerVisible(true);
    };
    reader.onerror = () => handleError(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
        processFile(file);
    }
  };

  const handleExampleClick = async (example: Example, index: number) => {
    if (status !== 'idle' && status !== 'error') return;
    
    setSelectedTile(index);
    setShowGenerator(false);
    setErrorMsg('');
    setThinkingText(null);
    setIsViewerVisible(true);
    
    try {
      // 1. Fetch Image
      const imgResponse = await fetch(example.img);
      if (!imgResponse.ok) throw new Error(`Failed to load example image: ${imgResponse.statusText}`);
      const imgBlob = await imgResponse.blob();
      
      const base64Img = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imgBlob);
      });

      // 2. Fetch HTML
      let htmlText = '';
      try {
        const htmlResponse = await fetch(example.html);
        if (htmlResponse.ok) {
            const rawText = await htmlResponse.text();
            // Extract, clean, and zoom
            htmlText = zoomCamera(hideBodyText(extractHtmlFromText(rawText)));
        } else {
            console.warn("HTML file not found, using placeholder");
            htmlText = `<html><body><p>${example.html} not found.</p></body></html>`;
        }
      } catch (e) {
          console.warn("Failed to fetch HTML", e);
          htmlText = "<html><body>Error loading example scene.</body></html>";
      }

      setImageData(base64Img);
      setVoxelCode(htmlText);
      setViewMode('voxel'); // Switch directly to voxel view for examples
      setStatus('idle');

    } catch (err) {
      handleError(err);
    }
  };

  const handleUserTileClick = () => {
      if (status !== 'idle' && status !== 'error') return;

      if (selectedTile === 'user') {
          // Already selected? Toggle generator to allow editing/regenerating
          const willShow = !showGenerator;
          setShowGenerator(willShow);
          
          if (willShow) {
            // If opening generator, hide viewer until action taken
            setIsViewerVisible(false);
          } else {
            // If closing generator, if we have content, show it. 
            // If no content, show placeholder (and deselect tile to reset state).
            setIsViewerVisible(true);
            
            if (!userContent) {
              setSelectedTile(null);
            }
          }
      } else {
          // Switch to user content or initialize it
          setSelectedTile('user');
          setShowGenerator(true); 
          
          // Hide viewer when initializing create mode
          setIsViewerVisible(false);

          if (userContent) {
              setImageData(userContent.image);
              setVoxelCode(userContent.voxel);
              setPrompt(userContent.prompt); // Restore prompt
              setViewMode(userContent.voxel ? 'voxel' : 'image');
          } else {
              // If no content yet, clear the view to show default placeholder
              setImageData(null);
              setVoxelCode(null);
              setViewMode('image');
          }
      }
  };

  const handleVoxelize = async () => {
    if (!imageData) return;
    setStatus('generating_voxels');
    setErrorMsg('');
    setThinkingText(null);
    // Ensure visible during processing
    setIsViewerVisible(true);
    
    let thoughtBuffer = "";

    try {
      const codeRaw = await generateVoxelScene(
        imageData, 
        (thoughtFragment) => {
          thoughtBuffer += thoughtFragment;
          
          const matches = thoughtBuffer.match(/\*\*([^*]+)\*\*/g);
          
          if (matches && matches.length > 0) {
              const lastMatch = matches[matches.length - 1];
              const header = lastMatch.replace(/\*\*/g, '').trim();
              setThinkingText(prev => prev === header ? prev : header);
          }
        },
        customApiKey
      );
      
      // Clean and Zoom
      const code = zoomCamera(hideBodyText(codeRaw));
      setVoxelCode(code);
      
      // Update persisted user content if we are working on the user tile
      if (selectedTile === 'user') {
          setUserContent(prev => prev ? ({...prev, voxel: code}) : null);
      }
      
      setViewMode('voxel');
      setStatus('idle');
      setThinkingText(null);
    } catch (err) {
      handleError(err);
    }
  };

  const handleCopyCode = async () => {
    if (!voxelCode) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(voxelCode);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = voxelCode;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.error('Failed to copy code:', e);
    }
  };

  const handleDownload = () => {
    if (viewMode === 'image' && imageData) {
      const a = document.createElement('a');
      a.href = imageData;
      const ext = imageData.includes('image/jpeg') ? 'jpg' : 'png';
      a.download = `voxelize-image-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (viewMode === 'voxel' && voxelCode) {
      const a = document.createElement('a');
      a.href = `data:text/html;charset=utf-8,${encodeURIComponent(voxelCode)}`;
      a.download = `voxel-scene-${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const isLoading = status !== 'idle' && status !== 'error';

  // Construct the display prompt for loading screen
  const getDisplayPrompt = () => {
    if (status === 'generating_image') {
      return useOptimization ? `${IMAGE_SYSTEM_PROMPT}\n\nSubject: ${prompt}` : prompt;
    }
    if (status === 'generating_voxels') {
      return VOXEL_PROMPT;
    }
    return '';
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans bg-white">
      <style>
        {`
          .loading-dots::after {
            content: '';
            animation: dots 2s steps(4, end) infinite;
          }
          @keyframes dots {
            0%, 20% { content: ''; }
            40% { content: '.'; }
            60% { content: '..'; }
            80% { content: '...'; }
          }
        `}
      </style>
      <div className="w-full max-w-2xl space-y-8">
        
        {/* Header with Profile and API Settings */}
        <div className="border-b-2 border-black pb-6 space-y-4">
          <div className="flex items-center justify-between">
            {/* User Profile Avatar Link */}
            <a
              href="https://alex-james.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center space-x-2.5 p-1 pr-3 bg-white hover:bg-neutral-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              title="Visit Alex James Profile"
            >
              <img
                src="https://github.com/user-attachments/assets/39d57249-29e6-447a-8da9-3d9ad92cb796"
                alt="Profile"
                className="w-7 h-7 rounded-full object-cover border border-black group-hover:scale-105 transition-transform"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  // Fallback if image fails to load
                  (e.currentTarget as HTMLImageElement).src = "https://alex-james.vercel.app/favicon.ico";
                }}
              />
              <div className="flex items-center space-x-1">
                <span className="text-xs font-black uppercase tracking-wider text-black">Alex James</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-gray-500 group-hover:text-black transition-colors">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </div>
            </a>

            {/* API Key Button */}
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="inline-flex items-center space-x-2 px-3 py-1.5 bg-white hover:bg-gray-50 border-2 border-black font-bold uppercase text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none cursor-pointer transition-all"
              title="Configure your Gemini API key"
            >
              <span className={`w-2.5 h-2.5 rounded-full border border-black ${customApiKey ? 'bg-emerald-500' : (process.env.GEMINI_API_KEY || process.env.API_KEY ? 'bg-blue-500' : 'bg-amber-400')}`} />
              <span>{customApiKey ? 'Custom API Key' : 'API Key Settings'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
              </svg>
            </button>
          </div>

          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-black leading-[0.9] tracking-tight">IMAGE TO VOXEL ART</h1>
            <p className="mt-2 text-lg text-gray-600 font-semibold">Create voxel art scenes inspired by any image.</p>
          </div>
        </div>

        {/* Example Tiles & User Tile */}
        <div className="grid grid-cols-4 gap-4 w-full">
            {EXAMPLES.map((ex, idx) => (
                <button
                    key={idx}
                    type="button"
                    onClick={() => handleExampleClick(ex, idx)}
                    disabled={isLoading}
                    aria-label={`Load Example ${idx + 1}`}
                    className={`aspect-square relative overflow-hidden group focus:outline-none disabled:opacity-50 cursor-pointer bg-gray-100 transition-all duration-200
                        border-2 border-black
                        active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-100
                        ${selectedTile === idx 
                            ? 'scale-[1.02] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -translate-y-1' 
                            : 'hover:border-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'}
                    `}
                    title="Click to view example scene"
                >
                     {loadedThumbnails[ex.img] ? (
                        <img 
                            src={loadedThumbnails[ex.img]} 
                            alt={`Example ${idx + 1}`} 
                            className="w-full h-full object-cover"
                        />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400 text-xs uppercase font-bold animate-pulse">
                            Loading...
                        </div>
                     )}
                     {selectedTile !== idx && <div className="absolute inset-0 bg-white bg-opacity-40 group-hover:bg-opacity-0 transition-all duration-200"></div>}
                </button>
            ))}
            
             {/* User Generate / Generated Tile */}
             <button
                type="button"
                onClick={handleUserTileClick}
                disabled={isLoading}
                aria-label="Generate new scene"
                className={`aspect-square flex flex-col items-center justify-center transition-all duration-200 focus:outline-none disabled:opacity-50 group overflow-hidden relative border-2 border-black
                    active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-100
                    ${selectedTile === 'user' ? 'scale-[1.02] -translate-y-1' : 'hover:border-gray-600 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'}
                    ${!userContent && !showGenerator ? 'bg-white text-black hover:bg-gray-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}
                    ${showGenerator && selectedTile === 'user' 
                        ? 'bg-black text-white shadow-[4px_4px_0px_0px_#888]' 
                        : (selectedTile === 'user' ? 'shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]' : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]')}
                `}
                title={userContent ? "View Generated Image" : "Generate New Image"}
             >
                 {userContent ? (
                     <>
                        <img src={userContent.image} alt="My Generation" className="w-full h-full object-cover" />
                        
                        {/* Overlay when deselected */}
                        {selectedTile !== 'user' && (
                             <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center group-hover:bg-opacity-50 transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-12 h-12 text-white drop-shadow-md">
                                    <path strokeLinecap="square" strokeLinejoin="miter" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                             </div>
                        )}

                        {/* Overlay when editing */}
                        {selectedTile === 'user' && showGenerator && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                <span className="text-white font-bold uppercase text-sm">Editing</span>
                            </div>
                        )}
                     </>
                 ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-10 h-10 transition-transform duration-300 ${showGenerator ? 'rotate-45' : 'group-hover:scale-110'}`}>
                            <path strokeLinecap="square" strokeLinejoin="miter" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span className="text-xs font-bold uppercase mt-2">{showGenerator ? 'Close' : 'Generate'}</span>
                    </>
                 )}
             </button>
        </div>

        {/* Generator Input Section (Collapsible) */}
        {showGenerator && (
            <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-300 border-2 border-black p-6 bg-gray-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative z-10">
            
            {/* Upload Section */}
            <div className="w-full">
                <label className="block text-sm font-bold mb-2 uppercase">
                    Upload Image
                </label>
                <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                        w-full h-64 border-2 border-dashed border-black flex flex-col items-center justify-center cursor-pointer transition-colors
                        ${isDragging ? 'bg-gray-200' : 'bg-white hover:bg-gray-50'}
                    `}
                >
                    <input
                        type="file"
                        accept={ALLOWED_MIME_TYPES.join(',')}
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <p className="font-bold uppercase text-sm text-gray-600">Drag and drop or click to upload image</p>
                </div>
            </div>
            
            <div className="relative flex items-center justify-center w-full">
                 <div className="border-t-2 border-gray-200 w-full absolute"></div>
                 <span className="bg-gray-50 px-3 text-xs font-bold text-gray-400 uppercase relative z-10">OR</span>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-grow w-full">
                <label htmlFor="prompt" className="block text-sm font-bold mb-2 uppercase">
                    Generate Image Prompt
                </label>
                <input
                    id="prompt"
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={SAMPLE_PROMPTS[placeholderIndex]}
                    aria-label="Image prompt description"
                    className="w-full px-3 border-2 border-black focus:outline-none focus:ring-0 rounded-none text-lg placeholder-gray-400 bg-white h-12"
                    disabled={isLoading}
                />
                </div>
                <div className="w-full sm:w-40 flex-shrink-0">
                    <label htmlFor="aspect" className="block text-sm font-bold mb-2 uppercase">
                    Aspect ratio
                    </label>
                    <select
                        id="aspect"
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        disabled={isLoading}
                        aria-label="Select aspect ratio"
                        className="w-full px-3 border-2 border-black focus:outline-none rounded-none bg-white h-12"
                    >
                        {ASPECT_RATIOS.map(ratio => (
                            <option key={ratio} value={ratio}>{ratio}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end items-center gap-6 mt-2">
                <label 
                    className="flex items-center cursor-pointer select-none"
                    title={`Add instruction: ${IMAGE_SYSTEM_PROMPT}`}
                >
                    <div className="relative">
                    <input
                        type="checkbox"
                        className="sr-only"
                        checked={useOptimization}
                        onChange={(e) => setUseOptimization(e.target.checked)}
                        disabled={isLoading}
                        aria-label="Toggle scene prompt optimization"
                    />
                    <div className={`block w-10 h-6 border-2 border-black ${useOptimization ? 'bg-black' : 'bg-gray-500'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 transition-transform ${useOptimization ? 'translate-x-4' : ''}`}></div>
                    </div>
                    <div className="ml-3 text-sm font-bold uppercase">Optimise Scene</div>
                </label>

                <button
                    type="button"
                    onClick={handleImageGenerate}
                    disabled={isLoading || !prompt.trim()}
                    title="Generate a new image based on your prompt"
                    aria-label="Generate image"
                    className="w-full sm:w-40 h-12 bg-black text-white border-2 border-black font-bold uppercase hover:bg-gray-900 disabled:opacity-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.5)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] text-sm whitespace-nowrap"
                >
                    {status === 'generating_image' ? 'Generating...' : 'Generate'}
                </button>
            </div>
            </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="p-4 border-2 border-red-500 bg-red-50 text-red-700 text-sm font-bold animate-in fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(239,68,68,1)]" role="alert">
            <div className="flex items-start space-x-2">
              <span className="uppercase font-black tracking-wide">Error:</span>
              <span className="font-medium">{errorMsg}</span>
            </div>
            {(errorMsg.toLowerCase().includes('api key') || errorMsg.toLowerCase().includes('missing') || errorMsg.toLowerCase().includes('403') || errorMsg.toLowerCase().includes('401') || errorMsg.toLowerCase().includes('permission') || errorMsg.toLowerCase().includes('unauthenticated')) && (
              <button
                type="button"
                onClick={() => setIsApiKeyModalOpen(true)}
                className="px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 border-2 border-black font-bold text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none shrink-0 cursor-pointer"
              >
                Set API Key
              </button>
            )}
          </div>
        )}

        {/* Viewer & Buttons Wrapper */}
        <div className="space-y-2">
            {/* Viewer Section */}
            {isViewerVisible && (
            <div className="w-full aspect-square border-2 border-black relative bg-gray-50 flex items-center justify-center overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" role="region" aria-label="Content Viewer">
            
            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-white z-20 flex flex-col items-start justify-center p-8 sm:p-12 overflow-hidden" aria-live="polite">
                    {/* Model Status */}
                    <div className="w-full max-w-3xl mb-10 text-xl font-bold tracking-tight">
                        {status === 'generating_image' 
                            ? 'Generating Image...' 
                            : 'Generating Three.js Scene...'}
                    </div>

                    {/* Prompt Display */}
                    <div className="w-full max-w-3xl mb-8 opacity-70 font-mono text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed border-l-2 border-gray-300 pl-4 max-h-[40%] overflow-y-auto">
                        {status === 'generating_voxels' && imageData && (
                            <img 
                                src={imageData} 
                                alt="Source" 
                                className="inline-block h-[1.5em] w-auto mr-2 align-middle border border-gray-300" 
                            />
                        )}
                        <span className="align-middle">{getDisplayPrompt()}</span>
                    </div>

                    {/* Thinking Text */}
                    <div className="w-full max-w-3xl opacity-70 font-mono text-xs sm:text-sm whitespace-pre-wrap break-words max-h-[40%] overflow-y-auto">
                        {thinkingText ? (
                            <span>
                                {thinkingText}
                                <span className="loading-dots"></span>
                            </span>
                        ) : (
                            <span className="loading-dots">Thinking</span>
                        )}
                    </div>
                </div>
            )}

            {!imageData && !isLoading && status !== 'error' && (
                <div className="text-gray-400 text-center px-6 pointer-events-none">
                <p className="text-lg">Select an example, or generate your own!</p>
                </div>
            )}

            {imageData && viewMode === 'image' && (
                <img src={imageData} alt="Generated or Uploaded" className="w-full h-full object-contain" />
            )}

            {voxelCode && viewMode === 'voxel' && (
                <iframe
                title="Voxel Scene"
                srcDoc={voxelCode}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-popups"
                />
            )}
            </div>
            )}

            {/* Action Buttons  */}
            {isViewerVisible && (
            <div className="flex flex-wrap gap-3 pt-4">
            {imageData && voxelCode && (
                <button
                type="button"
                onClick={() => setViewMode(viewMode === 'image' ? 'voxel' : 'image')}
                disabled={isLoading}
                title={viewMode === 'image' ? 'Switch to voxel scene view' : 'Switch to source image view'}
                aria-label={viewMode === 'image' ? 'Switch to voxel view' : 'Switch to image view'}
                className="flex-1 min-w-[130px] py-3.5 border-2 border-black bg-white font-bold uppercase text-xs sm:text-sm transition-all duration-200 disabled:opacity-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                {viewMode === 'image' ? 'View Scene' : 'View Image'}
                </button>
            )}

            {voxelCode && (
                <button
                  type="button"
                  onClick={() => setIsCodeModalOpen(true)}
                  disabled={isLoading}
                  title="Inspect and view the complete Three.js source code"
                  aria-label="View source code"
                  className="flex-1 min-w-[130px] py-3.5 border-2 border-black bg-white font-bold uppercase text-xs sm:text-sm transition-all duration-200 disabled:opacity-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                  </svg>
                  <span>View Code</span>
                </button>
            )}

            {viewMode === 'image' && imageData && (
                <button
                type="button"
                onClick={handleDownload}
                disabled={isLoading}
                title="Download the generated image"
                aria-label="Download image"
                className="flex-1 min-w-[130px] py-3.5 border-2 border-black bg-white font-bold uppercase text-xs sm:text-sm transition-all duration-200 disabled:opacity-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                Download Image
                </button>
            )}
            
            {imageData && (
                <button
                type="button"
                onClick={handleVoxelize}
                disabled={isLoading}
                title="Generate 3D voxel art from this image using Gemini 3 Pro"
                aria-label="Generate voxel art"
                className="flex-1 min-w-[150px] py-3.5 bg-black text-white border-2 border-black font-bold uppercase text-xs sm:text-sm disabled:opacity-50 transition-all duration-200 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)] hover:bg-gray-900 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,0.5)] active:translate-y-0 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)] cursor-pointer"
                >
                {voxelCode ? 'Regenerate voxels' : 'Generate voxels'}
                </button>
            )}
            </div>
            )}
        </div>

      </div>

      {/* API Key Settings Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeySaved={(key) => {
          setCustomApiKey(key);
          setErrorMsg('');
        }}
      />

      {/* Code Viewer Modal */}
      <CodeModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        code={voxelCode || ''}
      />
    </div>
  );
};

export default App;
