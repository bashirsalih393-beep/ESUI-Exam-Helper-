import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import Sidebar from './components/Sidebar';
import { ChatSession, Message } from './types';
import { chatStream } from './services/gemini';
import { GraduationCap, LogIn, Sun, Moon, Loader2 } from 'lucide-react';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  serverTimestamp, 
  deleteDoc,
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

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null); // ESUI might want phone later
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'gpa' | 'cgpa' | 'media' | 'summarizer'>('chat');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Sync user profile
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        try {
          const profileData = {
            email: firebaseUser.email,
            lastLogin: new Date().toISOString(),
          };

          await setDoc(userRef, profileData, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
        }
      } else {
        setSessions([]);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);


  useEffect(() => {
    if (!user) return;

    const sessionsQuery = query(
      collection(db, 'users', user.uid, 'sessions'),
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
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/sessions`));

    return () => unsubscribeSessions();
  }, [user]);

  // Fetch messages for active session
  useEffect(() => {
    if (!user || !activeSessionId) return;

    const messagesQuery = query(
      collection(db, 'users', user.uid, 'sessions', activeSessionId, 'messages'),
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
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/sessions/${activeSessionId}/messages`));

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
      const sessionsRef = collection(db, 'users', user.uid, 'sessions');
      const newSessionDoc = await addDoc(sessionsRef, {
        title: "New Study Session",
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      setActiveSessionId(newSessionDoc.id);
      setView('chat');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/sessions`);
    }
  }, [user]);

  const handleSendMessage = useCallback(async (content: string, attachments?: string[]) => {
    if (!user) return;

    let sessionId = activeSessionId;

    if (!sessionId) {
      const sessionsRef = collection(db, 'users', user.uid, 'sessions');
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
      const messagesRef = collection(db, 'users', user.uid, 'sessions', sessionId, 'messages');
      const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
      
      // Background: Sync user message with Firestore
      addDoc(messagesRef, {
        role: userMsg.role,
        content: userMsg.content,
        timestamp: userMsg.timestamp,
        attachments: userMsg.attachments
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/sessions/${sessionId}`));
      
      updateDoc(sessionRef, { 
        updatedAt: Date.now(),
        // Only update title if it's the first real message in the DB (checked via activeSession messages)
        title: (activeSession?.messages.length || 0) === 0 ? content.slice(0, 30) : activeSession?.title
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/sessions/${sessionId}`));

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
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/sessions/${sessionId}`);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  const deleteSession = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const sessionRef = doc(db, 'users', user.uid, 'sessions', id);
      // Delete subcollection messages first (small scale, but millions of users need batch or function)
      const messagesRef = collection(db, 'users', user.uid, 'sessions', id, 'messages');
      const batch = writeBatch(db);
      const snapshot = await getDocs(messagesRef);
      snapshot.forEach(d => batch.delete(d.ref));
      batch.delete(sessionRef);
      await batch.commit();
      
      if (activeSessionId === id) setActiveSessionId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/sessions/${id}`);
    }
  }, [activeSessionId, user]);

  const handleLogout = useCallback(() => {
    logout();
    setActiveSessionId(null);
    setView('chat');
    setAuthError(null);
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Login failed:", err);
      if (err.code === 'auth/network-request-failed') {
        setAuthError("Network error. Please check your internet connection and try again.");
      } else if (err.code === 'auth/popup-blocked') {
        setAuthError("Login popup was blocked. Please enable popups for this site.");
      } else {
        setAuthError("Failed to sign in. Please try again.");
      }
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
      <Login 
        onLogin={handleLogin} 
        isDarkMode={isDarkMode} 
        onToggleDarkMode={toggleDarkMode} 
        error={authError}
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
        activeView={view}
        onViewChange={setView}
        onLogout={handleLogout}
        userEmail={user?.email || null}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />
      <main className="flex-1 h-full lg:ml-72 relative transition-colors duration-200 bg-white dark:bg-zinc-950 overflow-hidden">
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
          {view === 'gpa' && <GPACalculator isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} userId={user.uid} />}
          {view === 'cgpa' && <CGPACalculator isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} userId={user.uid} />}
          {view === 'media' && <MediaLab isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />}
          {view === 'summarizer' && <StudySummarizer isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />}
        </Suspense>
      </main>
    </div>
  );
}

interface LoginProps {
  onLogin: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  error: string | null;
}

function Login({ onLogin, isDarkMode, onToggleDarkMode, error }: LoginProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-6 relative">
      <button 
        onClick={onToggleDarkMode}
        className="absolute top-6 right-6 p-3 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 rounded-2xl border border-slate-200 dark:border-zinc-800 transition-all hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-sm"
        title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
      >
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/10 border border-slate-200 dark:border-zinc-800"
      >
        <div className="flex flex-col items-center mb-10">
           <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center p-2 mb-8 shadow-2xl shadow-indigo-500/20 border-4 border-indigo-50">
            <img 
              src="https://upload.wikimedia.org/wikipedia/en/thumb/4/4b/Edo_State_University_Iyamho_logo.png/220px-Edo_State_University_Iyamho_logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('placehold.co')) {
                  target.src = "https://your-image-link.com/edo-state-university-logo.png";
                }
              }}
            />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">ESUI Portal</h1>
          <p className="text-slate-500 dark:text-zinc-400 text-center mt-2 text-sm leading-relaxed font-medium">Verified Academic AI Assistant</p>
        </div>

        <div className="space-y-6">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold text-center"
            >
              {error}
            </motion.div>
          )}
          <button 
            onClick={onLogin}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-[0.98] text-sm uppercase tracking-widest flex items-center justify-center gap-3"
          >
            <LogIn size={20} />
            Access with Google Account
          </button>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 dark:border-zinc-800 text-center">
          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold font-mono">
            Edo State University Iyamho
          </p>
          <p className="text-[8px] text-slate-400 mt-1 italic">
            Created by Salih Bashir, a Cybersecurity student
          </p>
        </div>
      </motion.div>
    </div>
  );
}

