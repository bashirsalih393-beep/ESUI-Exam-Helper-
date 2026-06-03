import React, { useState, memo, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Calculator, 
  Trash2, 
  GraduationCap, 
  Info, 
  ChevronRight, 
  Sun, 
  Moon, 
  Loader2, 
  TrendingUp, 
  Award, 
  Target,
  Search,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Semester } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface CGPACalculatorProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  userId: string;
}

export default memo(function CGPACalculator({ isDarkMode, onToggleDarkMode, userId }: CGPACalculatorProps) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [units, setUnits] = useState('3');
  const [score, setScore] = useState('70');

  useEffect(() => {
    const recordRef = doc(db, 'users', userId, 'academic', 'record');
    const unsubscribe = onSnapshot(recordRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const sems = data.semesters || [];
        setSemesters(sems);
        if (!activeSemesterId && sems.length > 0) {
          setActiveSemesterId(sems[0].id);
        }
      } else {
        const initial: Semester[] = [
          { id: crypto.randomUUID(), name: '1st Semester, 100 Level', level: 100, semesterType: 1, courses: [], isManual: false },
          { id: crypto.randomUUID(), name: '2nd Semester, 100 Level', level: 100, semesterType: 2, courses: [], isManual: false }
        ];
        setSemesters(initial);
        setActiveSemesterId(initial[0].id);
        setDoc(recordRef, { semesters: initial, updatedAt: Date.now() });
      }
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${userId}/academic/record`));

    return () => unsubscribe();
  }, [userId]);

  const saveToFirebase = (newSemesters: Semester[]) => {
    const recordRef = doc(db, 'users', userId, 'academic', 'record');
    setDoc(recordRef, { semesters: newSemesters, updatedAt: Date.now() }, { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${userId}/academic/record`));
  };

  const getGradeInfo = (score: number) => {
    if (score >= 70) return { grade: 'A', point: 5 };
    if (score >= 60) return { grade: 'B', point: 4 };
    if (score >= 50) return { grade: 'C', point: 3 };
    if (score >= 45) return { grade: 'D', point: 2 };
    if (score >= 40) return { grade: 'E', point: 1 };
    return { grade: 'F', point: 0 };
  };

  const addSemester = () => {
    const lastSem = semesters[semesters.length - 1];
    let nextLevel = 100;
    let nextType: 1 | 2 = 1;

    if (lastSem) {
      if (lastSem.semesterType === 1) {
        nextLevel = lastSem.level;
        nextType = 2;
      } else {
        nextLevel = (lastSem.level || 100) + 100;
        nextType = 1;
      }
    }

    if (nextLevel > 500) return;

    const newSem: Semester = {
      id: crypto.randomUUID(),
      name: `${nextType === 1 ? '1st' : '2nd'} Semester, ${nextLevel} Level`,
      level: nextLevel,
      semesterType: nextType,
      courses: [],
      isManual: false
    };

    const updated = [...semesters, newSem];
    setSemesters(updated);
    setActiveSemesterId(newSem.id);
    saveToFirebase(updated);
  };

  const addCourse = () => {
    if (!name.trim()) return;
    const { grade, point } = getGradeInfo(Number(score));
    
    const newCourse: Course = {
      id: crypto.randomUUID(),
      name: name.trim().toUpperCase(),
      creditUnits: Number(units),
      score: Number(score),
      grade,
      gradePoint: point,
    };
    
    const updated = semesters.map(s => {
      if (s.id === activeSemesterId) {
        return { ...s, courses: [...s.courses, newCourse] };
      }
      return s;
    });

    setSemesters(updated);
    saveToFirebase(updated);
    setName('');
  };

  const deleteCourse = (id: string) => {
    const updated = semesters.map(s => {
      if (s.id === activeSemesterId) {
        return { ...s, courses: s.courses.filter(c => c.id !== id) };
      }
      return s;
    });
    setSemesters(updated);
    saveToFirebase(updated);
  };

  const activeSemester = semesters.find(s => s.id === activeSemesterId);
  
  const analytics = useMemo(() => {
    let tUnits = 0;
    let tPoints = 0;

    const chartData = semesters.map((s, idx) => {
      let sUnits = 0;
      let sPoints = 0;
      s.courses.forEach(c => {
        sUnits += c.creditUnits;
        sPoints += (c.creditUnits * c.gradePoint);
      });
      
      const sGpa = sUnits === 0 ? 0 : sPoints / sUnits;
      
      tUnits += sUnits;
      tPoints += sPoints;
      const currentCgpa = tUnits === 0 ? 0 : tPoints / tUnits;

      return {
        name: `L${s.level}S${s.semesterType}`,
        gpa: parseFloat(sGpa.toFixed(2)),
        cgpa: parseFloat(currentCgpa.toFixed(2))
      };
    });

    const finalCgpa = tUnits === 0 ? 0 : tPoints / tUnits;

    return { totalUnits: tUnits, totalPoints: tPoints, cgpa: finalCgpa, chartData };
  }, [semesters]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-950">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#F8FAFC] dark:bg-zinc-950 transition-colors duration-200 custom-scrollbar">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-12 pb-24"
      >
        {/* Header Section */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/20">
              <GraduationCap size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">CGPA ENGINE</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Secure Academic Terminal</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="px-8 py-4 bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col items-center min-w-[140px]">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cumulative Index</span>
              <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{analytics.cgpa.toFixed(2)}</span>
            </div>
             <button 
                onClick={onToggleDarkMode}
                className="w-16 h-16 bg-white dark:bg-zinc-900 text-slate-400 hover:text-indigo-600 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-center transition-all hover:scale-105"
              >
                {isDarkMode ? <Sun size={24} className="text-amber-500" /> : <Moon size={24} className="text-indigo-600" />}
              </button>
          </div>
        </header>

        {/* Global Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <StatCard label="Academic Honor" value={analytics.cgpa >= 4.5 ? "First Class" : analytics.cgpa >= 3.5 ? "2nd Class Upper" : analytics.cgpa >= 2.4 ? "2nd Class Lower" : "Pass"} icon={<Award className="text-amber-500" />} />
           <StatCard label="Total Credits" value={analytics.totalUnits.toString()} icon={<Target className="text-indigo-500" />} />
           <StatCard label="Quality Points" value={analytics.totalPoints.toFixed(1)} icon={<TrendingUp className="text-emerald-500" />} />
           <StatCard label="Semesters Logged" value={semesters.length.toString()} icon={<BookOpen className="text-rose-500" />} />
        </div>

        {/* Analytics Visualization */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[3rem] p-10 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none transition-transform duration-1000 group-hover:scale-110">
            <TrendingUp size={240} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-12">
               <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Performance Trajectory</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Sessional Growth Analytics</p>
               </div>
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-indigo-500" />
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">GPA</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-emerald-500" />
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CGPA</span>
                  </div>
               </div>
            </div>
            
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.chartData}>
                  <defs>
                    <linearGradient id="gpaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="cgpaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#3f3f46' : '#f1f5f9'} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} dy={10} />
                  <YAxis domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)', fontWeight: '900', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="gpa" stroke="#6366f1" strokeWidth={4} fill="url(#gpaGrad)" />
                  <Area type="monotone" dataKey="cgpa" stroke="#10b981" strokeWidth={4} fill="url(#cgpaGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Level Management Grid */}
        <section className="space-y-8">
           <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Academic Records</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Verified Nodes (100L - 500L)</p>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    const level = prompt("Enter Level (100, 200, 300, 400, 500):");
                    const gpa = prompt("Enter GPA for this level:");
                    const units = prompt("Enter Total Units for this level:");
                    if (level && gpa && units) {
                      const l = parseInt(level);
                      const g = parseFloat(gpa);
                      const u = parseInt(units);
                      if (!isNaN(l) && !isNaN(g) && !isNaN(u)) {
                        const newSem: Semester = {
                          id: crypto.randomUUID(),
                          name: `Manual Entry - ${l}L`,
                          level: l,
                          semesterType: 1,
                          courses: [{
                            id: crypto.randomUUID(),
                            name: 'Bulk GPA Entry',
                            creditUnits: u,
                            score: 0,
                            grade: 'N/A',
                            gradePoint: g
                          }],
                          isManual: true
                        };
                        const updated = [...semesters, newSem];
                        setSemesters(updated);
                        saveToFirebase(updated);
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:border-indigo-500 transition-all active:scale-95"
                >
                  <Plus size={16} />
                  Manual Level Entry
                </button>
                <button 
                  onClick={addSemester}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  <Plus size={16} />
                  Deploy New Node
                </button>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {[100, 200, 300, 400, 500].map(level => {
               const levelSems = semesters.filter(s => s.level === level);
               if (levelSems.length === 0) return null;

               return (
                 <div key={level} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[3rem] p-8 shadow-sm group hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
                    <div className="flex items-center justify-between mb-8">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center font-black text-xs text-indigo-600 border border-slate-100 dark:border-zinc-700">
                            {level}
                          </div>
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Level Hub</span>
                       </div>
                    </div>

                    <div className="space-y-3">
                       {[1, 2].map(type => {
                         const s = levelSems.find(ls => ls.semesterType === type);
                         if (!s) return null;

                         let gpa = 0;
                         const u = s.courses.reduce((acc, c) => acc + c.creditUnits, 0);
                         const p = s.courses.reduce((acc, c) => acc + (c.creditUnits * c.gradePoint), 0);
                         gpa = u === 0 ? 0 : p / u;

                         return (
                           <button 
                             key={type}
                             onClick={() => setActiveSemesterId(s.id)}
                             className={`w-full flex items-center justify-between p-5 rounded-2xl transition-all group/btn ${activeSemesterId === s.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-indigo-500'}`}
                           >
                              <div className="flex flex-col items-start px-2">
                                 <span className="text-[10px] font-black uppercase tracking-widest opacity-60">S{type} Record</span>
                                 <span className="text-xs font-black">GPA {gpa.toFixed(2)}</span>
                              </div>
                              <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                           </button>
                         );
                       })}
                    </div>
                 </div>
               );
             })}
           </div>
        </section>

        {/* Selected Semester Editor */}
        {activeSemester && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
             <div className="lg:col-span-8 space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[3rem] overflow-hidden shadow-sm">
                   <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-[#F8FAFC]/50 dark:bg-zinc-950/30">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{activeSemester.name}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Course Matrix</p>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="text-right">
                           <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Sem Index</span>
                           <span className="text-2xl font-black text-indigo-600">
                             {(activeSemester.courses.reduce((acc, c) => acc + (c.creditUnits * c.gradePoint), 0) / (activeSemester.courses.reduce((acc, c) => acc + c.creditUnits, 0) || 1)).toFixed(2)}
                           </span>
                         </div>
                      </div>
                   </div>

                   <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                       <thead>
                         <tr className="border-b border-slate-100 dark:border-zinc-800">
                           <th className="px-8 py-6 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Course Code</th>
                           <th className="px-8 py-6 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] text-center">Units</th>
                           <th className="px-8 py-6 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] text-center">Score</th>
                           <th className="px-8 py-6 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] text-center">Grade</th>
                           <th className="px-8 py-6"></th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50 dark:divide-zinc-800/50">
                         {activeSemester.courses.length === 0 ? (
                            <tr>
                               <td colSpan={5} className="px-8 py-16 text-center">
                                  <div className="flex flex-col items-center gap-3 text-slate-400">
                                     <Search size={40} className="opacity-20" />
                                     <p className="text-xs font-black uppercase tracking-widest">No spectral records found</p>
                                  </div>
                               </td>
                            </tr>
                         ) : (
                           activeSemester.courses.map(course => (
                             <tr key={course.id} className="group hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors">
                                <td className="px-8 py-6 font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">{course.name}</td>
                                <td className="px-8 py-6 text-center font-black text-xs text-slate-500">{course.creditUnits}</td>
                                <td className="px-8 py-6 text-center font-black text-xs text-slate-500">{course.score}%</td>
                                <td className="px-8 py-6 text-center">
                                   <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl font-black text-xs ${
                                     course.grade === 'A' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                                     course.grade === 'B' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' :
                                     course.grade === 'C' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
                                     'bg-slate-500 text-white'
                                   }`}>
                                      {course.grade}
                                   </span>
                                </td>
                                <td className="px-8 py-6 text-right">
                                   <button 
                                     onClick={() => deleteCourse(course.id)}
                                     className="p-3 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                   >
                                      <Trash2 size={18} />
                                   </button>
                                </td>
                             </tr>
                           ))
                         )}
                       </tbody>
                     </table>
                   </div>
                </div>
             </div>

             <div className="lg:col-span-4 space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
                   {/* Quick Calculator Added */}
                   <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm mb-6">
                     <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-3">
                        <Calculator size={18} className="text-indigo-600" />
                        Quick CGPA Calc
                     </h3>

                     <div className="space-y-4">
                        <input 
                           id="gpa1"
                           type="number"
                           placeholder="1st Semester GPA"
                           onChange={(e) => {
                             const g1 = parseFloat(e.target.value);
                             const g2 = parseFloat((document.getElementById('gpa2') as HTMLInputElement).value || '0');
                             (document.getElementById('quick-result') as HTMLSpanElement).innerText = ((g1 + g2) / 2).toFixed(2);
                           }}
                           className="w-full bg-[#F8FAFC] dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white"
                        />
                        <input 
                           id="gpa2"
                           type="number"
                           placeholder="2nd Semester GPA"
                           onChange={(e) => {
                             const g1 = parseFloat((document.getElementById('gpa1') as HTMLInputElement)?.value || '0');
                             const g2 = parseFloat(e.target.value);
                             (document.getElementById('quick-result') as HTMLSpanElement).innerText = ((g1 + g2) / 2).toFixed(2);
                           }}
                           className="w-full bg-[#F8FAFC] dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white"
                        />
                        <div className="text-center font-black text-slate-900 dark:text-white">
                           Result: <span id="quick-result">0.00</span>
                        </div>
                     </div>
                   </div>

                   <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-3">
                      <Plus size={18} className="text-indigo-600" />
                      Ingest Data
                   </h3>

                   <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Node Identity (Code)</label>
                        <input 
                          type="text"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="e.g. CSC 101"
                          className="w-full bg-[#F8FAFC] dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-sm font-black uppercase focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Load (Units)</label>
                            <select 
                              value={units}
                              onChange={e => setUnits(e.target.value)}
                              className="w-full bg-[#F8FAFC] dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white"
                            >
                               {[1,2,3,4,5,6].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                         </div>
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Yield (Score %)</label>
                            <input 
                              type="number"
                              value={score}
                              onChange={e => setScore(e.target.value)}
                              className="w-full bg-[#F8FAFC] dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white"
                            />
                         </div>
                      </div>

                      <button 
                        onClick={addCourse}
                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-indigo-500/20 transition-all active:scale-[0.98]"
                      >
                        Commit to Matrix
                      </button>
                   </div>
                </div>

                <div className="p-8 bg-emerald-500 rounded-[2.5rem] text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 bg-white/20 rounded-full blur-2xl transition-transform duration-700 group-hover:scale-150" />
                   <div className="relative z-10">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                         <Target size={24} />
                      </div>
                      <h4 className="text-lg font-black uppercase tracking-tight mb-2">Academic Standing</h4>
                      <p className="text-[10px] text-emerald-50 text-emerald-100 font-bold uppercase tracking-widest leading-relaxed">
                        Currently tracking {activeSemester.courses.length} educational nodes in this semester.
                      </p>
                   </div>
                </div>
             </div>
          </section>
        )}
      </motion.div>
    </div>
  );
});

function StatCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col gap-6 group hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
       <div className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
          {icon}
       </div>
       <div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">{label}</span>
          <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{value}</span>
       </div>
    </div>
  );
}
