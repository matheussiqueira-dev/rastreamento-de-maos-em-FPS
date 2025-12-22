
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';

interface VeoAnimatorProps {
  onClose: () => void;
}

const VeoAnimator: React.FC<VeoAnimatorProps> = ({ onClose }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startGeneration = async () => {
    if (!selectedImage) return;

    try {
      // API Key Check
      // @ts-ignore - window.aistudio is global
      if (!await window.aistudio.hasSelectedApiKey()) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        // Proceeding after triggering openSelectKey as per instructions
      }

      setIsGenerating(true);
      setGeneratedVideoUrl(null);
      setStatus('Initializing Cinematic Engine...');

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = selectedImage.split(',')[1];
      const mimeType = selectedImage.split(';')[0].split(':')[1];

      setStatus('Drafting Visual Narrative...');
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: 'A cinematic high-quality animation of this scene with subtle movement and atmosphere.',
        image: {
          imageBytes: base64Data,
          mimeType: mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: aspectRatio
        }
      });

      const loadingMessages = [
        'Calculating frame trajectories...',
        'Synthesizing temporal textures...',
        'Polishing atmospheric dynamics...',
        'Rendering final cinematic sequence...',
        'Finalizing masterpiece...'
      ];

      let msgIndex = 0;
      while (!operation.done) {
        setStatus(loadingMessages[msgIndex % loadingMessages.length]);
        msgIndex++;
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        setStatus('Sequence acquired.');
        const finalUrl = `${downloadLink}&key=${process.env.API_KEY}`;
        setGeneratedVideoUrl(finalUrl);
      } else {
        throw new Error('Generation failed - No video link returned.');
      }
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message || 'The sequence failed to render.'}`);
      // Handle race condition/stale key
      if (err.message?.includes("Requested entity was not found.")) {
         // @ts-ignore
         await window.aistudio.openSelectKey();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-neutral-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
          <div>
            <h2 className="text-2xl font-black text-cyan-400 tracking-tighter uppercase italic">Veo Cinematic Engine</h2>
            <p className="text-white/40 text-xs">Animate static captures into cinematic sequences using VEO-3.1-FAST</p>
          </div>
          <button 
            onClick={onClose}
            className="text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Upload/Config */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">1. Source Capture</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`relative aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${selectedImage ? 'border-cyan-500/50' : 'border-white/10 hover:border-cyan-400/30'}`}
              >
                {selectedImage ? (
                  <>
                    <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-bold uppercase">Change Image</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <svg className="w-10 h-10 text-white/20 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <p className="text-white/60 text-sm font-bold">Select Scene Frame</p>
                    <p className="text-white/20 text-[10px] mt-1 uppercase">JPG, PNG supported</p>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">2. Temporal Configuration</label>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setAspectRatio('16:9')}
                  className={`px-4 py-3 rounded-lg border font-bold text-xs uppercase transition-all ${aspectRatio === '16:9' ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                >
                  Landscape (16:9)
                </button>
                <button 
                  onClick={() => setAspectRatio('9:16')}
                  className={`px-4 py-3 rounded-lg border font-bold text-xs uppercase transition-all ${aspectRatio === '9:16' ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                >
                  Portrait (9:16)
                </button>
              </div>
            </div>

            <button
              onClick={startGeneration}
              disabled={!selectedImage || isGenerating}
              className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-[0.2em] transition-all transform active:scale-95 ${!selectedImage || isGenerating ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-white text-black hover:bg-cyan-400 hover:text-black shadow-[0_0_30px_rgba(255,255,255,0.2)]'}`}
            >
              {isGenerating ? 'Rendering...' : 'INITIATE GENERATION'}
            </button>
            
            <div className="text-[10px] text-white/20 flex gap-2 items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              Requires a <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-cyan-400 underline">Paid API Key</a> for Veo.
            </div>
          </div>

          {/* Right: Results / Loading */}
          <div className="bg-black/50 rounded-2xl border border-white/10 flex flex-col items-center justify-center min-h-[300px] overflow-hidden">
            {isGenerating ? (
              <div className="text-center p-8 space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-t-cyan-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-4 bg-cyan-500/10 rounded-full animate-pulse flex items-center justify-center">
                    <svg className="w-8 h-8 text-cyan-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line></svg>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-white font-black text-xl italic tracking-tight animate-pulse">{status}</p>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest">Long-polling Veo operations... (up to 3 mins)</p>
                </div>
              </div>
            ) : generatedVideoUrl ? (
              <div className="relative w-full h-full flex flex-col">
                 <div className="flex-1 bg-black flex items-center justify-center">
                    <video 
                      src={generatedVideoUrl} 
                      controls 
                      autoPlay 
                      loop 
                      className={`max-w-full max-h-full ${aspectRatio === '9:16' ? 'h-full w-auto' : 'w-full h-auto'}`}
                    />
                 </div>
                 <div className="p-4 bg-black/80 flex justify-between items-center border-t border-white/10">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase">Sequence Rendered Successfully</span>
                    <a 
                      href={generatedVideoUrl} 
                      download="cinematic_render.mp4"
                      className="text-xs text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg font-bold"
                    >
                      DOWNLOAD MP4
                    </a>
                 </div>
              </div>
            ) : (
              <div className="text-center p-8 text-white/20 space-y-2">
                <svg className="w-16 h-16 mx-auto opacity-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <p className="text-sm font-bold uppercase tracking-widest">Waiting for Input...</p>
                <p className="text-[10px]">Your generated sequence will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VeoAnimator;
