import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { Send, Image as ImageIcon, Sparkles, User, Bot, Paperclip, Loader2, X, Sun, Moon, Mic, MicOff, BookOpen, FileText, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Virtuoso } from 'react-virtuoso';
import { Message } from '../types';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (content: string, attachments?: string[]) => void;
  isStreaming: boolean;
  streamingContent?: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

const TypingIndicator = memo(() => (
  <div className="flex gap-4 max-w-3xl mx-auto w-full px-6 py-4">
    <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
      <img 
        src="https://upload.wikimedia.org/wikipedia/en/thumb/4/4b/Edo_State_University_Iyamho_logo.png/220px-Edo_State_University_Iyamho_logo.png" 
        alt="ESUI"
        className="w-5 h-5 object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl rounded-tl-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
          className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
          className="w-1.5 h-1.5 bg-indigo-400 rounded-full"
        />
      </div>
    </div>
  </div>
));

const MessageItem = memo(({ msg, isOwn }: { msg: Message; isOwn: boolean }) => (
  <div
    className={`flex gap-4 max-w-3xl mx-auto w-full px-6 py-4 ${isOwn ? 'flex-row-reverse' : ''}`}
  >
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${isOwn ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 overflow-hidden'}`}>
      {isOwn ? <User size={14} /> : 
        <img 
          src="https://upload.wikimedia.org/wikipedia/en/thumb/4/4b/Edo_State_University_Iyamho_logo.png/220px-Edo_State_University_Iyamho_logo.png" 
          alt="ESUI"
          className="w-5 h-5 object-contain"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = "https://your-image-link.com/edo-state-university-logo.png";
          }}
        />
      }
    </div>
    <div className={`flex flex-col gap-2 ${isOwn ? 'items-end' : ''} max-w-[80%]`}>
      <div className={`px-5 py-3 rounded-2xl shadow-sm ${isOwn ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 rounded-tl-none'}`}>
        <div className="markdown-body">
          <Markdown>{msg.content}</Markdown>
        </div>
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {msg.attachments.map((at, idx) => (
              <img key={idx} src={at} alt="attachment" className="w-40 h-auto rounded-xl border border-white/20 shadow-md" loading="lazy" />
            ))}
          </div>
        )}
      </div>
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  </div>
));

export default memo(function ChatArea({ messages, onSendMessage, isStreaming, streamingContent, isDarkMode, onToggleDarkMode }: ChatAreaProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const virtuosoRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setInput(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        if (event.error === 'network') {
          setSpeechError('Network error: Unable to reach speech service.');
        } else if (event.error === 'not-allowed') {
          setSpeechError('Microphone access denied.');
        } else {
          setSpeechError(`Error: ${event.error}`);
        }
        
        // Auto-clear error after 3 seconds
        setTimeout(() => setSpeechError(null), 3000);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      setSpeechError('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setSpeechError(null);
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start recognition', err);
      }
    }
  }, [isListening]);

  useEffect(() => {
    if (virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: messages.length + (isStreaming ? 1 : 0),
        align: 'end',
        behavior: 'smooth'
      });
    }
  }, [messages, isStreaming, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachments.length > 0) && !isStreaming) {
      onSendMessage(input, attachments);
      setInput('');
      setAttachments([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachments(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Header */}
      <header className="h-16 px-6 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Study Session</span>
        </div>
        <button 
          onClick={onToggleDarkMode}
          className="p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-xl transition-all"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 bg-white dark:bg-zinc-950 min-h-0 relative">
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          initialTopMostItemIndex={messages.length - 1}
          totalCount={messages.length + (isStreaming ? 1 : 0)}
          className="custom-scrollbar"
          itemContent={(index, msg) => {
            if (index === messages.length && isStreaming) {
              return (
                <div className="flex gap-4 max-w-3xl mx-auto w-full px-6 py-4 mb-4">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/en/thumb/4/4b/Edo_State_University_Iyamho_logo.png/220px-Edo_State_University_Iyamho_logo.png" 
                      alt="ESUI"
                      className="w-5 h-5 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex flex-col gap-2 max-w-[80%]">
                    <div className="px-5 py-3 rounded-2xl shadow-sm bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 rounded-tl-none">
                      <div className="markdown-body">
                        {streamingContent ? (
                          <Markdown>{streamingContent}</Markdown>
                        ) : (
                          <div className="flex gap-1 py-1">
                            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            return <MessageItem msg={msg} isOwn={msg.role === 'user'} />;
          }}
          components={{
            Header: () => (
              messages.length === 0 ? (
                <div className="min-h-[400px] flex flex-col items-center justify-center text-center px-4 py-20">
                  <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-8 border border-slate-100 shadow-xl shadow-indigo-500/5">
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/en/thumb/4/4b/Edo_State_University_Iyamho_logo.png/220px-Edo_State_University_Iyamho_logo.png" 
                      alt="ESUI Emblem"
                      className="w-16 h-16 object-contain"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                         const target = e.target as HTMLImageElement;
                         target.src = "https://your-image-link.com/edo-state-university-logo.png";
                      }}
                    />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Edo State University Iyamho</h2>
                  <p className="text-slate-500 dark:text-zinc-400 max-w-sm mt-4 text-base leading-relaxed font-medium">
                    Official AI Learning Assistant. Tailored academic support for ESUI students.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-10 w-full max-w-lg">
                    {[
                      "Explain the Cybersecurity basics",
                      "Generate 5 MCQs on GST 101",
                      "Create a study plan for Exams",
                      "Analyze these study notes"
                    ].map((hint, i) => (
                      <button 
                        key={i}
                        onClick={() => setInput(hint)}
                        className="p-4 text-xs font-semibold text-slate-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-left shadow-sm"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              ) : <div className="h-4" />
            ),
            Footer: () => <div className="h-4" />
          }}
        />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-8 bg-white dark:bg-zinc-950 shrink-0">
        <form 
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto relative"
        >
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 mb-4 justify-center md:justify-start">
             {[
               { id: 'explain', label: 'Explain Topic', icon: <Sparkles size={12} /> },
               { id: 'quiz', label: 'Generate Quiz', icon: <BookOpen size={12} /> },
               { id: 'summarize', label: 'Summarize Notes', icon: <FileText size={12} /> },
               { id: 'exam', label: 'Exam Prep', icon: <Target size={12} /> }
             ].map(action => (
               <button
                 key={action.id}
                 type="button"
                 onClick={() => {
                   if (action.id === 'explain') setInput("Explain this topic in simple terms: ");
                   if (action.id === 'quiz') setInput("Generate 5 multiple choice questions with answers based on: ");
                   if (action.id === 'summarize') setInput("Summarize these notes into key points: ");
                   if (action.id === 'exam') setInput("Generate potential exam questions and model answers for: ");
                 }}
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm"
               >
                  {action.icon}
                  {action.label}
               </button>
             ))}
          </div>

          {attachments.length > 0 && (
            <div className="absolute bottom-full left-0 mb-3 flex gap-2 p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl z-20">
              {attachments.map((at, idx) => (
                <div key={idx} className="relative shrink-0 group/img">
                  <img src={at} alt="preview" className="w-16 h-16 object-cover rounded-lg" />
                  <button 
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover/img:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="relative flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-sm">
            {speechError && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -top-10 left-0 right-0 py-1.5 px-3 bg-red-500 text-white text-[10px] font-bold rounded-lg text-center z-30 shadow-lg"
              >
                {speechError}
              </motion.div>
            )}
            <div className="flex items-center">
              <div className="absolute left-4 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                title="Upload Photo"
              >
                <ImageIcon size={18} />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                title="Attach Document"
              >
                <Paperclip size={18} />
              </button>
            </div>

            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*"
              className="hidden"
            />
            
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Paste topic, upload notes, or ask a question..."
              className="w-full bg-transparent py-4 pl-24 pr-16 text-sm focus:outline-none dark:text-white resize-none"
              disabled={isStreaming}
            />

            <div className="absolute right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2 rounded-xl transition-all ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-indigo-600'
                }`}
                title={isListening ? 'Stop listening' : 'Start voice input'}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                type="submit"
                disabled={(!input.trim() && attachments.length === 0) || isStreaming}
                className={`p-2 rounded-xl transition-all shadow-lg ${
                  (input.trim() || attachments.length > 0) && !isStreaming
                    ? 'bg-indigo-600 text-white shadow-indigo-200 dark:shadow-none hover:bg-indigo-700'
                    : 'bg-slate-200 dark:bg-zinc-800 text-slate-400'
                }`}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-4 font-medium uppercase tracking-wider">
             ESUI Helper AI • Verified academic assistance
          </p>
        </form>
      </div>
    </div>
  );
});
