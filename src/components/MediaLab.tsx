import React, { useState, useEffect, memo } from 'react';
import { Image as ImageIcon, Video, Sparkles, Download, Loader2, AlertCircle, Key, Trash2, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateImage, generateVideo } from '../services/gemini';

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  timestamp: Date;
}

interface MediaLabProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export default memo(function MediaLab({ isDarkMode, onToggleDarkMode }: MediaLabProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [history, setHistory] = useState<MediaItem[]>(() => {
    const saved = localStorage.getItem('esui_media_history');
    return saved ? JSON.parse(saved).map((item: any) => ({ ...item, timestamp: new Date(item.timestamp) })) : [];
  });

  useEffect(() => {
    localStorage.setItem('esui_media_history', JSON.stringify(history));
  }, [history]);

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear your media history?')) {
      setHistory([]);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setStatus('Analyzing prompt...');
    
    try {
      if (activeTab === 'image') {
        setStatus('Generating image...');
        const url = await generateImage(prompt);
        const newItem: MediaItem = {
          id: crypto.randomUUID(),
          type: 'image',
          url,
          prompt,
          timestamp: new Date()
        };
        setHistory([newItem, ...history]);
      } else {
        const url = await generateVideo(prompt, (msg) => setStatus(msg));
        const newItem: MediaItem = {
          id: crypto.randomUUID(),
          type: 'video',
          url,
          prompt,
          timestamp: new Date()
        };
        setHistory([newItem, ...history]);
      }
      setPrompt('');
    } catch (error) {
      console.error(error);
      alert('Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
      setStatus('');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white dark:bg-zinc-950 transition-colors duration-200">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
              <Sparkles size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Media Lab</h1>
              <p className="text-slate-500 font-medium text-sm">AI-Powered Image & Video Generation</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={onToggleDarkMode}
              className="p-3 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 rounded-2xl border border-slate-200 dark:border-zinc-800 transition-all hover:bg-slate-50 dark:hover:bg-zinc-800"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="flex p-1 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 transition-colors">
              <button
                onClick={() => setActiveTab('image')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'image' ? 'bg-white dark:bg-zinc-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
              >
                <ImageIcon size={18} />
                Image
              </button>
              <button
                onClick={() => setActiveTab('video')}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'video' ? 'bg-white dark:bg-zinc-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
              >
                <Video size={18} />
                Video
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-6 block">Generation Prompt</h2>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={activeTab === 'image' ? "Describe the image you want... e.g. A futuristic university campus in Nigeria, digital art" : "Describe the video... e.g. A sunset over a calm ocean, cinematic 4k"}
                className="w-full h-40 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white transition-all resize-none mb-4"
                disabled={isGenerating}
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generate {activeTab === 'image' ? 'Image' : 'Video'}
                  </>
                )}
              </button>
              
              {isGenerating && status && (
                <p className="mt-4 text-center text-xs font-medium text-slate-500 flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
                  {status}
                </p>
              )}
            </div>

            <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={16} className="text-indigo-600" />
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-widest">Usage Tips</h4>
              </div>
              <ul className="text-xs text-indigo-800 dark:text-indigo-200 space-y-2 opacity-80 list-disc pl-4">
                <li>Be descriptive: Mention lighting, style, and camera angle.</li>
                <li>Image generation is nearly instant.</li>
                <li>Video generation can take up to 5 minutes.</li>
                <li>All media is saved locally in this browser.</li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                Recently Generated
                <span className="text-xs font-normal text-slate-400">({history.length} items)</span>
              </h3>
              {history.length > 0 && (
                <button onClick={clearHistory} className="text-xs font-bold text-red-500 hover:text-red-600 flex items-center gap-1.5 transition-colors">
                  <Trash2 size={14} />
                  Clear History
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl min-h-[500px] flex flex-col items-center justify-center text-center p-8 opacity-40">
                <div className="p-6 bg-white dark:bg-zinc-800 rounded-full mb-6 border border-slate-100 dark:border-zinc-700 shadow-inner">
                  <Sparkles size={48} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium">Your generated media will appear here.</p>
                <p className="text-xs mt-2">Try describing something unique!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                <AnimatePresence initial={false}>
                  {history.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      layout
                      className="group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all h-fit"
                    >
                      <div className="relative aspect-video bg-slate-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                        {item.type === 'image' ? (
                          <img 
                            src={item.url} 
                            alt={item.prompt} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <video 
                            src={item.url} 
                            controls 
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute top-3 right-3 flex gap-2">
                          <a 
                            href={item.url} 
                            download={`esui-${item.type}-${item.id}`}
                            className="p-2 bg-white/90 dark:bg-zinc-900/90 text-slate-700 dark:text-zinc-300 rounded-lg shadow-sm hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                          >
                            <Download size={16} />
                          </a>
                        </div>
                        <div className="absolute top-3 left-3">
                          <span className="px-2 py-1 bg-indigo-600/90 text-white text-[10px] font-black uppercase tracking-widest rounded-md backdrop-blur-sm">
                            {item.type}
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-xs font-medium text-slate-700 dark:text-zinc-300 line-clamp-2 italic">"{item.prompt}"</p>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {item.timestamp.toLocaleDateString()} at {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
});
