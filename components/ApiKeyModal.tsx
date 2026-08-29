import React, { useState, useEffect } from 'react';
import { getActiveApiKey } from '../services/gemini';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeySaved }) => {
  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const hasEnvKey = !!(process.env.GEMINI_API_KEY || process.env.API_KEY);

  useEffect(() => {
    if (isOpen) {
      const stored = localStorage.getItem('custom_gemini_api_key') || '';
      setInputKey(stored);
      setHasStoredKey(!!stored.trim());
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputKey.trim();
    if (trimmed) {
      localStorage.setItem('custom_gemini_api_key', trimmed);
      setHasStoredKey(true);
      onKeySaved(trimmed);
    } else {
      localStorage.removeItem('custom_gemini_api_key');
      setHasStoredKey(false);
      onKeySaved('');
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleClear = () => {
    localStorage.removeItem('custom_gemini_api_key');
    setInputKey('');
    setHasStoredKey(false);
    onKeySaved('');
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white border-3 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 space-y-6 relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
            </svg>
            <h2 id="api-key-modal-title" className="text-xl font-black tracking-tight uppercase">
              Gemini API Key Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 hover:bg-gray-100 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none font-bold text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status Indicator */}
        <div className="p-3 bg-gray-50 border-2 border-black space-y-1">
          <div className="text-xs font-black uppercase text-gray-500">Current Key Status</div>
          <div className="flex items-center space-x-2">
            <span className={`w-3 h-3 rounded-full border border-black ${hasStoredKey ? 'bg-emerald-500' : hasEnvKey ? 'bg-blue-500' : 'bg-amber-400'}`} />
            <span className="text-sm font-bold">
              {hasStoredKey 
                ? 'Custom User API Key (Active)' 
                : hasEnvKey 
                  ? 'Default Environment Key (Active)' 
                  : 'No API Key Configured'}
            </span>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="gemini-api-key-input" className="block text-xs font-black uppercase tracking-wider mb-1.5">
              Enter Your Gemini API Key
            </label>
            <div className="relative">
              <input
                id="gemini-api-key-input"
                type={showKey ? "text" : "password"}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="AIzaSy..."
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2.5 bg-white border-2 border-black font-mono text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-0 focus:border-black pr-20"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-black uppercase"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Your API key is securely saved only in your browser's local storage and used directly for Google Gemini requests.
            </p>
          </div>

          {savedSuccess && (
            <div className="p-2.5 bg-emerald-100 border-2 border-black text-emerald-900 text-xs font-bold flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-emerald-700">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <span>API key configuration updated successfully!</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2">
              {hasStoredKey && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-2 text-xs font-black uppercase text-red-600 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-50 active:translate-y-0.5 active:shadow-none cursor-pointer"
                >
                  Clear Custom Key
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-black uppercase bg-gray-100 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-200 active:translate-y-0.5 active:shadow-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-black uppercase text-white bg-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.5)] hover:bg-neutral-800 active:translate-y-0.5 active:shadow-none cursor-pointer"
              >
                Save Key
              </button>
            </div>
          </div>
        </form>

        {/* Help Link */}
        <div className="pt-3 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
          <span>Need a free API Key?</span>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline text-black hover:text-blue-700 inline-flex items-center gap-1"
          >
            Get API Key on Google AI Studio
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};
