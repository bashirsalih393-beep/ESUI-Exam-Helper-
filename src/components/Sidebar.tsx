import React, { useState, memo } from 'react';
import { Plus, Settings, History, Calculator, BookOpen, LogOut, Menu, X, Trash2, Sun, Moon, User, GraduationCap, Sparkles, FileText, Edit2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionSelect: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  activeView: 'chat' | 'gpa' | 'cgpa' | 'media' | 'summarizer' | 'settings';
  onViewChange: (view: 'chat' | 'gpa' | 'cgpa' | 'media' | 'summarizer' | 'settings') => void;
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
  onRenameSession,
  activeView,
  onViewChange,
  onLogout,
  userEmail,
  isDarkMode,
  onToggleDarkMode
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleStartEditing = (session: ChatSession) => {
    setEditingId(session.id);
    setEditingTitle(session.title || '');
  };

  const handleFinishEditing = () => {
    if (editingId && editingTitle.trim()) {
      onRenameSession(editingId, editingTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFinishEditing();
    if (e.key === 'Escape') setEditingId(null);
  };

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

            <div className="flex-1 p-6 flex flex-col overflow-y-auto custom-scrollbar space-y-8">
              {/* Tools Section */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] px-2">Academic Assets</p>
                <div className="grid grid-cols-1 gap-1.5">
                  <SidebarNavItem 
                    icon={<BookOpen size={18} />} 
                    label="AI Assistant" 
                    isActive={activeView === 'chat'} 
                    onClick={() => onViewChange('chat')} 
                  />
                   <SidebarNavItem 
                    icon={<FileText size={18} />} 
                    label="Summarizer" 
                    isActive={activeView === 'summarizer'} 
                    onClick={() => onViewChange('summarizer')} 
                  />
                  <SidebarNavItem 
                    icon={<Calculator size={18} />} 
                    label="GPA Calculator" 
                    isActive={activeView === 'gpa'} 
                    onClick={() => onViewChange('gpa')} 
                  />
                  <SidebarNavItem 
                    icon={<GraduationCap size={18} />} 
                    label="CGPA Tracker" 
                    isActive={activeView === 'cgpa'} 
                    onClick={() => onViewChange('cgpa')} 
                  />
                  <SidebarNavItem 
                    icon={<Sparkles size={18} />} 
                    label="Media Lab" 
                    isActive={activeView === 'media'} 
                    onClick={() => onViewChange('media')} 
                  />
                  <SidebarNavItem 
                    icon={<Settings size={18} />} 
                    label="Identity Settings" 
                    isActive={activeView === 'settings'} 
                    onClick={() => onViewChange('settings')} 
                  />
                </div>
              </div>

              {/* History Section */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Session Logs</p>
                    <button 
                      onClick={onNewChat}
                      className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                    >
                      <Plus size={14} />
                    </button>
                 </div>
                <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {sessions.length === 0 ? (
                    <div className="px-3 py-8 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 text-center">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No active logs</p>
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <div key={session.id} className="group relative">
                        {editingId === session.id ? (
                          <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900 rounded-xl shadow-sm">
                            <input
                              autoFocus
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={handleFinishEditing}
                              onKeyDown={handleKeyDown}
                              className="bg-transparent text-xs w-full outline-none text-slate-900 dark:text-white font-bold"
                            />
                            <button onClick={handleFinishEditing} className="text-emerald-500 hover:text-emerald-600">
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="relative group">
                            <button
                              onClick={() => onSessionSelect(session.id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold transition-all truncate group-hover:bg-slate-100 dark:group-hover:bg-zinc-900/50 ${activeSessionId === session.id ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-zinc-800' : 'text-slate-500 dark:text-zinc-500'}`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${activeSessionId === session.id ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-300 dark:bg-zinc-700'}`} />
                              <span className="truncate">{session.title || "New session"}</span>
                            </button>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 dark:bg-zinc-900/50 pl-2 rounded-lg">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditing(session);
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteSession(session.id);
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 mt-auto border-t border-slate-200 dark:border-zinc-800 bg-[#F8FAFC]/50 dark:bg-zinc-950/50">
              <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-center flex-shrink-0 font-black text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/20">
                  {userEmail?.charAt(0).toUpperCase() || 'S'}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-black truncate text-slate-900 dark:text-white">
                    {userEmail?.split('@')[0] || 'Student'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold truncate tracking-tight">
                    {userEmail || 'Academic Identity'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                 <button 
                  onClick={onToggleDarkMode}
                  className="flex items-center justify-center gap-2 p-2.5 bg-white dark:bg-zinc-900 text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-zinc-800 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95"
                >
                  {isDarkMode ? <Sun size={14} className="text-amber-500" /> : <Moon size={14} className="text-indigo-600" />}
                  {isDarkMode ? 'Light' : 'Dark'}
                </button>
                 <button 
                  onClick={onLogout}
                  className="flex items-center justify-center gap-2 p-2.5 bg-white dark:bg-zinc-900 text-slate-400 hover:text-red-500 border border-slate-200 dark:border-zinc-800 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95"
                >
                  <LogOut size={14} />
                  Exit
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 lg:hidden"
        />
      )}
    </>
  );
});

function SidebarNavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-3 rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all group ${
        isActive 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none translate-x-1' 
        : 'text-slate-500 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:translate-x-1'
      }`}
    >
      <div className={`${isActive ? 'text-white' : 'text-slate-400 dark:text-zinc-600 group-hover:text-indigo-500'} transition-colors`}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}
