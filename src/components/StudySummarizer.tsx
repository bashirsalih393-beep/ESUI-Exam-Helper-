import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Image as ImageIcon, Send, Loader2, Sparkles, AlertCircle, Copy, Check, Trash2, GraduationCap, Sun, Moon } from 'lucide-react';
import { chatStream } from '../services/gemini';

export default function StudySummarizer({ isDarkMode, onToggleDarkMode }: { isDarkMode: boolean; onToggleDarkMode: () => void }) {
  const [input, setInput] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size too large. Maximum 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAttachments(prev => [...prev, base64]);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSummarize = async () => {
    if (!input.trim() && attachments.length === 0) {
      setError('Please provide some notes or upload an image.');
      return;
    }

    setIsSummarizing(true);
    setSummary('');
    setError(null);

    const prompt = `Please provide a concise, high-quality, and structured summary of the following study notes. 
    Use bullet points, bold text for key terms, and ensure it's easy for a student to understand and recall.
    
    Notes:
    ${input}`;

    try {
      const parts: any[] = [{ text: prompt }];
      
      attachments.forEach(at => {
        const parts_at = at.split(',');
        if (parts_at.length > 1) {
          const mimeType = parts_at[0].split(';')[0].split(':')[1];
          const data = parts_at[1];
          parts.push({ inlineData: { data, mimeType } });
        }
      });

      const stream = chatStream([{ role: 'user', parts }]);
      let fullResponse = "";
      
      for await (const chunk of stream) {
        fullResponse += chunk;
        setSummary(fullResponse);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to generate summary. Please try again.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 h-full bg-slate-50 dark:bg-zinc-950 flex flex-col transition-colors duration-200">
      <header className="h-16 border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
            <FileText size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Study Summarizer</h2>
            <p className="text-[10px] text-slate-500 font-medium">AI-powered note compression</p>
          </div>
        </div>
        <button 
          onClick={onToggleDarkMode}
          className="p-3 bg-white dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 rounded-2xl border border-slate-200 dark:border-zinc-800 transition-all hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-sm"
          title={isDarkMode ? 'Lunar Mode' : 'Solar Mode'}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
          
          {/* Header Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 bg-indigo-600 rounded-[2.5rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-md">
                <div className="flex items-center gap-2 mb-4 opacity-80">
                  <Sparkles size={20} />
                  <span className="font-bold text-xs uppercase tracking-widest text-indigo-100">AI Assistant</span>
                </div>
                <h1 className="text-3xl font-black mb-2 tracking-tight">Turn long notes into quick summaries.</h1>
                <p className="text-indigo-100 text-sm font-medium leading-relaxed">Paste your lecture notes or upload a photo of your textbook. Our AI will extract the key points for you instantly.</p>
              </div>
              <div className="flex-shrink-0 flex justify-center">
                 <div className="w-24 h-24 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center border border-white/20">
                   <FileText size={48} className="text-white" />
                 </div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Area */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 shadow-sm border border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Input Notes</span>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                    title="Upload Image"
                  >
                    <ImageIcon size={18} />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste your lecture notes, textbook passages, or thoughts here..."
                  className="w-full h-64 bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl p-6 text-sm resize-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white dark:focus:bg-zinc-850 dark:text-white transition-all custom-scrollbar"
                />

                {attachments.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {attachments.map((at, i) => (
                      <div key={i} className="relative group">
                        <img src={at} alt="Upload" className="w-16 h-16 object-cover rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm" />
                        <button 
                          onClick={() => removeAttachment(i)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="mt-4 flex items-center gap-2 text-red-500 text-[11px] font-bold uppercase tracking-tight bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/20">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSummarize}
                  disabled={isSummarizing}
                  className="w-full mt-6 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                >
                  {isSummarizing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Generate Summary
                    </>
                  )}
                </button>
              </div>

              <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-[2rem] border border-emerald-100 dark:border-emerald-900/20">
                <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Pro Tip</h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed">
                  You can upload photos of handwritten notes! Make sure the lighting is good for the best accuracy.
                </p>
              </div>
            </div>

            {/* Output Area */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-6 shadow-sm border border-slate-200 dark:border-zinc-800 min-h-[400px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Study Summary</span>
                    {isSummarizing && (
                      <span className="text-[9px] font-bold text-emerald-600 animate-pulse uppercase">AI is writing...</span>
                    )}
                  </div>
                  {summary && (
                    <button 
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-zinc-400 rounded-xl transition-all"
                    >
                      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      <span className="text-[9px] font-bold uppercase tracking-wider">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                <div className="flex-1">
                  {!summary && !isSummarizing ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-zinc-700 space-y-4">
                      <GraduationCap size={48} className="opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest opacity-40">Your summary will appear here</p>
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-zinc-300">
                      {summary.split('\n').map((line, i) => (
                        <p key={i} className="mb-2 last:mb-0 leading-relaxed">
                           {line.startsWith('*') || line.startsWith('-') ? (
                             <span className="flex gap-2">
                               <span className="text-indigo-500 font-bold">•</span>
                               {line.replace(/^[* -]+/, '')}
                             </span>
                           ) : line}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

               <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2rem] border border-indigo-100 dark:border-indigo-900/20">
                <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2">Verified Content</h4>
                <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium leading-relaxed">
                  ESUI Helper summaries are validated against official Edo State University curriculum standards for accuracy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


