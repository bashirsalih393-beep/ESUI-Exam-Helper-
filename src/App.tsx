import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import Sidebar from './components/Sidebar';
import { ChatSession, Message } from './types';
import { chatStream } from './services/gemini';
import { GraduationCap, LogIn, Sun, Moon, Loader2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  serverTimestamp, 
  updateDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';                

// Lazy load heavy components
const ChatArea = lazy(() => import('./components/ChatArea'));
const GPACalculator = lazy(() => import('./components/GPACalculator'));
const CGPACalculator = lazy(() => import('./components/CGPACalculator'));
const MediaLab = lazy(() => import('./components/MediaLab'));
const StudySummarizer = lazy(() => import('./components/StudySummarizer'));

const LOGO_URL = "/input_file_0.png";

export default function App() {
  const [user, setUser] = useState<{email: string} | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [userPhone, setUserPhone] = useState<string | null>(null); // ESUI might want phone later
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'gpa' | 'cgpa' | 'media' | 'summarizer' | 'settings'>('chat');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Auth View State
  const [authView, setAuthView] = useState<'login' | 'register'>('login');


  useEffect(() => {
    if (!user) return;

    const sessionsQuery = query(
      collection(db, 'users', user.email, 'sessions'),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const sessionsData: ChatSession[] = [];
      snapshot.forEach((sessionDoc) => {
        const data = sessionDoc.data();
        sessionsData.push({
          id: sessionDoc.id,
          title: data.title,
          updatedAt: data.updatedAt,
          messages: [] // Messages will be fetched separately for active session or cached
        } as ChatSession);
      });
      setSessions(sessionsData);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.email}/sessions`));

    return () => unsubscribeSessions();
  }, [user]);

  // Fetch messages for active session
  useEffect(() => {
    if (!user || !activeSessionId) return;

    const messagesQuery = query(
      collection(db, 'users', user.email, 'sessions', activeSessionId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData: Message[] = [];
      snapshot.forEach((msgDoc) => {
        messagesData.push({ id: msgDoc.id, ...msgDoc.data() } as Message);
      });
      
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: messagesData } : s
      ));
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.email}/sessions/${activeSessionId}/messages`));

    return () => unsubscribeMessages();
  }, [user, activeSessionId]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);

  const startNewChat = useCallback(async () => {
    if (!user) return;
    try {
      const sessionsRef = collection(db, 'users', user.email, 'sessions');
      const newSessionDoc = await addDoc(sessionsRef, {
        title: "New Study Session",
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      setActiveSessionId(newSessionDoc.id);
      setView('chat');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.email}/sessions`);
    }
  }, [user]);

  const handleSendMessage = useCallback(async (content: string, attachments?: string[]) => {
    if (!user) return;

    let sessionId = activeSessionId;

    if (!sessionId) {
      const sessionsRef = collection(db, 'users', user.email, 'sessions');
      const newSessionDoc = await addDoc(sessionsRef, {
        title: content.slice(0, 30) + (content.length > 30 ? "..." : ""),
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      sessionId = newSessionDoc.id;
      setActiveSessionId(sessionId);
    }

    processChat(sessionId, content, attachments);
  }, [activeSessionId, user]);

  const processChat = async (sessionId: string, content: string, attachments?: string[]) => {
    if (!user) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachments
    };

    // Optimistic Update: Add user message to UI immediately
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, messages: [...(s.messages || []), userMsg], updatedAt: Date.now() } 
        : s
    ));

    try {
      const messagesRef = collection(db, 'users', user.email, 'sessions', sessionId, 'messages');
      const sessionRef = doc(db, 'users', user.email, 'sessions', sessionId);
      
      // Background: Sync user message with Firestore
      addDoc(messagesRef, {
        role: userMsg.role,
        content: userMsg.content,
        timestamp: userMsg.timestamp,
        attachments: userMsg.attachments
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.email}/sessions/${sessionId}`));
      
      updateDoc(sessionRef, { 
        updatedAt: Date.now(),
        // Only update title if it's the first real message in the DB (checked via activeSession messages)
        title: (activeSession?.messages.length || 0) === 0 ? content.slice(0, 30) : activeSession?.title
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.email}/sessions/${sessionId}`));

      setStreamingContent('');
      setIsStreaming(true);
      
      const currentSession = sessions.find(s => s.id === sessionId);
      const history = currentSession 
        ? [...(currentSession.messages || []), userMsg] 
        : [userMsg];
      
      const geminiMsgs = history.map(m => {
        const parts: any[] = [{ text: m.content || " " }];
        if (m.attachments) {
          m.attachments.forEach(at => {
            const parts_at = at.split(',');
            if (parts_at.length > 1) {
              const mimeType = parts_at[0].split(';')[0].split(':')[1];
              const data = parts_at[1];
              parts.push({ inlineData: { data, mimeType } });
            }
          });
        }
        return { role: m.role as string, parts };
      });

      const stream = chatStream(geminiMsgs);
      let fullResponse = "";
      
      for await (const chunk of stream) {
        fullResponse += chunk;
        setStreamingContent(fullResponse);
      }

      // Final: Sync complete assistant message with Firestore
      await addDoc(messagesRef, {
        role: 'model',
        content: fullResponse,
        timestamp: Date.now()
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.email}/sessions/${sessionId}`);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  const deleteSession = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const sessionRef = doc(db, 'users', user.email, 'sessions', id);
      // Delete subcollection messages first (small scale, but millions of users need batch or function)
      const messagesRef = collection(db, 'users', user.email, 'sessions', id, 'messages');
      const batch = writeBatch(db);
      const snapshot = await getDocs(messagesRef);
      snapshot.forEach(d => batch.delete(d.ref));
      batch.delete(sessionRef);
      await batch.commit();
      
      if (activeSessionId === id) setActiveSessionId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.email}/sessions/${id}`);
    }
  }, [activeSessionId, user]);

  const renameSession = useCallback(async (id: string, newTitle: string) => {
    if (!user) return;
    try {
      const sessionRef = doc(db, 'users', user.email, 'sessions', id);
      await updateDoc(sessionRef, { 
        title: newTitle,
        updatedAt: Date.now() 
      });
      // Update local state if needed (onSnapshot usually handles it, but let's be sure for speed)
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.email}/sessions/${id}`);
    }
  }, [user]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('user');
    setUser(null);
    setActiveSessionId(null);
    setView('chat');
    setAuthError(null);
  }, []);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (email?: string) => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      if (email) {
        const newUser = { email };
        localStorage.setItem('user', JSON.stringify(newUser));
        setUser(newUser);
      } else {
        setAuthError("Please enter an email.");
      }
    } catch (err: any) {
      setAuthError("Login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async (email: string) => {
    setAuthError("Password reset is not required for email-only authentication.");
  };

  const handleRegister = async (email: string) => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const newUser = { email };
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
    } catch (err: any) {
      setAuthError("Registration failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPortal 
        onLogin={handleLogin} 
        onRegister={handleRegister}
        onForgotPassword={handleForgotPassword}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode} 
        error={authError}
        isLoggingIn={isLoggingIn}
        view={authView}
        onViewChange={setAuthView}
      />
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 overflow-hidden transition-colors duration-200">
      <Sidebar 
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSessionSelect={setActiveSessionId}
        onNewChat={startNewChat}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        activeView={view}
        onViewChange={setView}
        onLogout={handleLogout}
        userEmail={user?.email || null}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />
      <main className="flex-1 h-full lg:ml-72 relative transition-colors duration-200 bg-white dark:bg-zinc-950 overflow-hidden flex flex-col">
        <Suspense fallback={
          <div className="flex-1 h-full flex items-center justify-center bg-white dark:bg-zinc-950 transition-colors duration-200">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-indigo-600" size={40} />
              <p className="text-sm font-medium text-slate-500 animate-pulse uppercase tracking-widest">Loading tools...</p>
            </div>
          </div>
        }>
          {view === 'chat' && (
            <ChatArea 
              messages={activeSession?.messages || []}
              onSendMessage={handleSendMessage}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
            />
          )}
          {view === 'gpa' && <GPACalculator isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} userId={user.email} />}
          {view === 'cgpa' && <CGPACalculator isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} userId={user.email} />}
          {view === 'media' && <MediaLab isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />}
          {view === 'summarizer' && <StudySummarizer isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />}
          {view === 'settings' && <SettingsView userEmail={user.email} onLogout={handleLogout} isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />}
        </Suspense>
      </main>
    </div>
  );
}

function SettingsView({ userEmail, onLogout, isDarkMode, onToggleDarkMode }: { userEmail: string | null, onLogout: () => void, isDarkMode: boolean, onToggleDarkMode: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-12 bg-white dark:bg-zinc-950 transition-colors duration-200">
       <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="max-w-2xl mx-auto space-y-12"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-2">
             <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Identity</h2>
             <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Academic Profile Management</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onToggleDarkMode}
              className="p-4 bg-slate-50 dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 rounded-3xl border border-slate-100 dark:border-zinc-800 transition-all hover:text-indigo-600 shadow-sm"
            >
              {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-800 p-2 border border-slate-100 dark:border-zinc-800 shadow-xl overflow-hidden group">
               <img src={LOGO_URL} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
            </div>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-zinc-900/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 space-y-8">
           <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Connected Email</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">{userEmail}</span>
           </div>
           
           <div className="pt-8 border-t border-slate-200 dark:border-zinc-800 space-y-1">
              <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Edo State University Iyamho</p>
              <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">ESUI EXAM HELPER AI — 1.0.0</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide pt-2">Created by Salih Bashir, a Cybersecurity student</p>
           </div>

           <button 
             onClick={onLogout}
             className="w-full mt-8 py-4 bg-red-500 hover:bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-red-500/20 transition-all active:scale-[0.98]"
           >
             Terminate Session
           </button>
        </div>

        <div className="p-8 bg-indigo-600 rounded-[2.5rem] text-white shadow-xl shadow-indigo-500/20">
           <h3 className="text-sm font-black uppercase tracking-widest mb-4">ESUI Helper v2.0</h3>
           <p className="text-xs opacity-80 leading-relaxed font-bold italic">
             "Equipping Edo State University students with world-class AI learning tools for academic excellence."
           </p>
        </div>
      </motion.div>
    </div>
  )
}

interface AuthPortalProps {
  onLogin: (email?: string, pass?: string) => void;
  onRegister: (email: string, pass: string) => void;
  onForgotPassword: (email: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  error: string | null;
  isLoggingIn: boolean;
  view: 'login' | 'register';
  onViewChange: (view: 'login' | 'register') => void;
}

function AuthPortal({ onLogin, onRegister, onForgotPassword, isDarkMode, onToggleDarkMode, error, isLoggingIn, view, onViewChange }: AuthPortalProps) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const DUMMY_PASSWORD = 'password123'; // Hardcoded password to fulfill email-only requirement
    if (view === 'register') {
      onRegister(email, DUMMY_PASSWORD);
    } else {
      onLogin(email, DUMMY_PASSWORD);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
      {/* Cinematic Cover Photo Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 via-transparent to-emerald-500/5 dark:from-indigo-900/20 dark:to-emerald-900/10 z-10" />
        <motion.img 
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.04 }}
          transition={{ duration: 2 }}
          src={LOGO_URL} 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] grayscale blur-sm"
          alt=""
        />
      </div>

      <button 
        onClick={onToggleDarkMode}
        className="absolute top-8 right-8 p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-slate-400 dark:text-zinc-500 rounded-[2rem] border border-slate-200/50 dark:border-zinc-800 shadow-2xl z-20 hover:scale-110 transition-all active:scale-95"
        title={isDarkMode ? 'Solar Activation' : 'Lunar Activation'}
      >
        {isDarkMode ? <Sun size={24} className="text-amber-500" /> : <Moon size={24} className="text-indigo-600" />}
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        className="max-w-md w-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-3xl p-10 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-white dark:border-zinc-800 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-44 h-44 rounded-[2.5rem] bg-white flex items-center justify-center p-6 mb-6 shadow-2xl shadow-indigo-500/20 border border-slate-100 dark:border-zinc-800 relative z-10 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-50/50 to-emerald-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            <img 
              src={LOGO_URL} 
              alt="Edo State University Iyamho Logo" 
              className="w-full h-full object-contain relative z-20 transition-transform duration-700 group-hover:scale-110"
              referrerPolicy="no-referrer"
              loading="eager"
            />
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-1">ESUI PORTAL</h1>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-slate-400 dark:text-zinc-500 text-center text-[10px] uppercase font-black tracking-[0.2em] leading-relaxed">Secured Academic AI Terminal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold text-center"
            >
              {error}
            </motion.div>
          )}

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Email Address</label>
            <input 
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email or University Email"
              className="w-full bg-[#F8FAFC] dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white"
            />
          </div>

          <button 
            type="submit"
            disabled={isLoggingIn}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98] text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3"
          >
            {isLoggingIn ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Synchronizing...
              </>
            ) : (
              <>
                <LogIn size={16} />
                {view === 'login' ? 'Authenticate' : 'Establish Identity'}
              </>
            )}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-4">
           <button 
             onClick={() => onViewChange(view === 'login' ? 'register' : 'login')}
             className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors"
           >
             {view === 'login' ? 'Create New Academic Profile' : 'Existing Profile? Authenticate'}
           </button>

           <div className="w-full flex items-center gap-4 py-4">
              <div className="h-[1px] flex-1 bg-slate-100 dark:bg-zinc-800" />
              <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Secure Backup</span>
              <div className="h-[1px] flex-1 bg-slate-100 dark:bg-zinc-800" />
           </div>

           <button 
             onClick={() => onLogin()}
             disabled={isLoggingIn}
             className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 font-black py-4 rounded-2xl transition-all shadow-sm active:scale-[0.98] text-[9px] uppercase tracking-widest flex items-center justify-center gap-3"
           >
             {isLoggingIn ? <Loader2 size={14} className="animate-spin" /> : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" />}
             Google Workspace Authentication
           </button>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 dark:border-zinc-800 text-center space-y-1">
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
            Edo State University Iyamho
          </p>
          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-black tracking-tight uppercase">
            ESUI EXAM HELPER AI — 1.0.0
          </p>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider pt-2">
            Created by Salih Bashir, a Cybersecurity student
          </p>
        </div>
      </motion.div>
    </div>
  );
}

