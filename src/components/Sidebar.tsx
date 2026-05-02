import React, { useState, memo } from 'react';
import { Plus, Settings, History, Calculator, BookOpen, LogOut, Menu, X, Trash2, Sun, Moon, User, GraduationCap, Sparkles, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionSelect: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  activeView: 'chat' | 'gpa' | 'cgpa' | 'media' | 'summarizer';
  onViewChange: (view: 'chat' | 'gpa' | 'cgpa' | 'media' | 'summarizer') => void;
  onLogout: () => void;
  userEmail: string | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export default memo(function Sidebar({
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewChat,
  onDeleteSession,
  activeView,
  onViewChange,
  onLogout,
  userEmail,
  isDarkMode,
  onToggleDarkMode
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 bg-white dark:bg-zinc-900 rounded-lg shadow-md lg:hidden"
        id="sidebar-toggle"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.aside
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            className="fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 flex flex-col shrink-0 transition-colors duration-200"
          >
            {/* Header / Logo */}
              <div className="p-6 flex items-center gap-3 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="relative">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-inner border border-slate-100 overflow-hidden shrink-0">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/en/thumb/4/4b/Edo_State_University_Iyamho_logo.png/220px-Edo_State_University_Iyamho_logo.png" 
                    alt="ESUI" 
                    className="w-10 h-10 object-contain"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center shadow-sm">
                  <Sparkles size={8} className="text-white fill-white" />
                </div>
              </div>
              <div className="leading-tight">
                <h1 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight flex items-center gap-1">
                  ESUI Helper
                </h1>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Academic AI
                </p>
              </div>
            </div>

            <div className="flex-1 p-4 flex flex-col overflow-hidden">
              {/* New Chat Button */}
              <button
                onClick={onNewChat}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-sm mb-6 dark:text-white"
                id="new-chat-btn"
              >
                <Plus size={16} />
                New Study Session
              </button>

              {/* Tools Section */}
              <div className="mb-8">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">Academic Tools</p>
                <div className="space-y-1">
                  <button
                    onClick={() => onViewChange('chat')}
                    className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'chat' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'}`}
                  >
                    <BookOpen size={16} />
                    <span>Learning Assistant</span>
                  </button>
                  <button
                    onClick={() => onViewChange('summarizer')}
                    className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'summarizer' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'}`}
                  >
                    <FileText size={16} />
                    <span>Study Summarizer</span>
                  </button>
                  <button
                    onClick={() => onViewChange('gpa')}
                    className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'gpa' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'}`}
                  >
                    <Calculator size={16} />
                    <span>GPA Calculator</span>
                  </button>
                  <button
                    onClick={() => onViewChange('cgpa')}
                    className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'cgpa' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'}`}
                  >
                    <GraduationCap size={16} />
                    <span>CGPA Tracker</span>
                  </button>
                  <button
                    onClick={() => onViewChange('media')}
                    className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'media' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'}`}
                  >
                    <Sparkles size={16} />
                    <span>Media Lab</span>
                  </button>
                </div>
              </div>

              {/* History Section */}
              <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">Study History</p>
                <div className="space-y-1">
                  {sessions.map((session) => (
                    <div key={session.id} className="group relative list-item-render">
                      <button
                        onClick={() => onSessionSelect(session.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm transition-colors truncate pr-8 ${activeSessionId === session.id ? 'bg-slate-200/50 dark:bg-zinc-800 text-slate-900 dark:text-white font-medium' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900'}`}
                      >
                        <History size={14} className="opacity-50 shrink-0" />
                        <span className="truncate">{session.title || "New session"}</span>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 mt-auto border-t border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
              <button 
                onClick={onToggleDarkMode}
                className="flex items-center gap-3 w-full p-2 mb-4 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-xs font-medium"
              >
                {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
              
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-200 dark:border-zinc-700 overflow-hidden p-1">
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/en/thumb/4/4b/Edo_State_University_Iyamho_logo.png/220px-Edo_State_University_Iyamho_logo.png" 
                    alt="Logo"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold truncate text-slate-700 dark:text-zinc-300">
                    {userEmail?.split('@')[0] || 'Student'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    {userEmail || 'University Email/Email'}
                  </p>
                </div>
                <button 
                  onClick={onLogout}
                  className="ml-auto p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center opacity-70">
                Edo State University Iyamho
              </p>
              <p className="text-[8px] text-slate-400 text-center mt-1 italic">
                Created by Salih Bashir, a Cybersecurity student
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
        />
      )}
    </>
  );
});
