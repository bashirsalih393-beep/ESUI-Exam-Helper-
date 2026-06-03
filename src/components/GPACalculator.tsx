import React, { useState, memo, useEffect } from 'react';
import { Plus, Calculator, Trash2, GraduationCap, Info, ChevronRight, FolderPlus, Sun, Moon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Semester } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

interface GPACalculatorProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  userId: string;
}

export default memo(function GPACalculator({ isDarkMode, onToggleDarkMode, userId }: GPACalculatorProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [units, setUnits] = useState('3');
  const [score, setScore] = useState('70');

  useEffect(() => {
    const recordRef = doc(db, 'users', userId, 'academic', 'gpa_record');
    const unsubscribe = onSnapshot(recordRef, (snapshot) => {
      if (snapshot.exists()) {
        setCourses(snapshot.data().courses || []);
      }
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${userId}/academic/gpa_record`));

    return () => unsubscribe();
  }, [userId]);

  const saveToFirebase = (newCourses: Course[]) => {
    const recordRef = doc(db, 'users', userId, 'academic', 'gpa_record');
    setDoc(recordRef, { courses: newCourses, updatedAt: Date.now() }, { merge: true })
      .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${userId}/academic/gpa_record`));
  };

  const getGradeInfo = (score: number) => {
    if (score >= 70) return { grade: 'A', point: 5 };
    if (score >= 60) return { grade: 'B', point: 4 };
    if (score >= 50) return { grade: 'C', point: 3 };
    if (score >= 45) return { grade: 'D', point: 2 };
    if (score >= 40) return { grade: 'E', point: 1 };
    return { grade: 'F', point: 0 };
  };

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

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
    
    // Optimistic Update
    const newCourses = [...courses, newCourse];
    setCourses(newCourses);
    
    // Background Sync
    saveToFirebase(newCourses);
    setName('');
  };

  const handleBulkAdd = () => {
    const lines = bulkText.split(/[\n,;]/);
    const newEntries: Course[] = [];
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const cName = parts[0].toUpperCase();
        const cScore = Number(parts[1]);
        const cUnits = parts[2] ? Number(parts[2]) : 3;
        
        if (!isNaN(cScore)) {
          const { grade, point } = getGradeInfo(cScore);
          newEntries.push({
            id: crypto.randomUUID(),
            name: cName,
            creditUnits: cUnits,
            score: cScore,
            grade,
            gradePoint: point
          });
        }
      }
    });

    if (newEntries.length > 0) {
      // Optimistic Update
      const updated = [...courses, ...newEntries];
      setCourses(updated);
      
      // Background Sync
      saveToFirebase(updated);
      setBulkText('');
      setBulkMode(false);
    }
  };

  const deleteCourse = (id: string) => {
    // Optimistic Update
    const newCourses = courses.filter(c => c.id !== id);
    setCourses(newCourses);
    
    // Background Sync
    saveToFirebase(newCourses);
  };

  const updateCourse = (id: string, updates: Partial<Course>) => {
    // Optimistic Update
    const newCourses = courses.map(c => {
      if (c.id === id) {
        const updated = { ...c, ...updates };
        if (updates.score !== undefined) {
          const { grade, point } = getGradeInfo(updated.score);
          updated.grade = grade;
          updated.gradePoint = point;
        }
        return updated;
      }
      return c;
    });
    setCourses(newCourses);
    saveToFirebase(newCourses);
  };

  const { totalUnits, totalPoints, totalMarks, gpa } = React.useMemo(() => {
    const units = courses.reduce((acc, c) => acc + c.creditUnits, 0);
    const points = courses.reduce((acc, c) => acc + (c.creditUnits * c.gradePoint), 0);
    const marks = courses.reduce((acc, c) => acc + c.score, 0);
    const calculatedGpa = units === 0 ? 0 : points / units;
    return { totalUnits: units, totalPoints: points, totalMarks: marks, gpa: calculatedGpa };
  }, [courses]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-950">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white dark:bg-zinc-950 transition-colors duration-200 custom-scrollbar">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6 py-6 mb-10 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-500/20 flex items-center justify-center shrink-0">
              <Calculator size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">GPA Calculator</h1>
              <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mt-1">Calculate your semester result</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button 
                onClick={onToggleDarkMode}
                className="p-3 bg-white dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 rounded-2xl border border-slate-200 dark:border-zinc-800 transition-all hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-sm"
                title={isDarkMode ? 'Lunar Mode' : 'Solar Mode'}
             >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             <div className="flex flex-col items-end px-6 py-3 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Sessional GPA</span>
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums tracking-tighter">{gpa.toFixed(2)}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <Plus size={16} className="text-indigo-600" />
                  {bulkMode ? 'Bulk Add Scores' : 'Add New Course'}
                </h2>
                <button 
                  onClick={() => setBulkMode(!bulkMode)}
                  className="text-[9px] font-black bg-slate-100 dark:bg-zinc-800 text-slate-500 px-2 py-1 rounded-md uppercase tracking-wider hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100"
                >
                  {bulkMode ? 'Manual Mode' : 'Bulk Mode (Fast)'}
                </button>
              </div>
              
              {!bulkMode ? (
                <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Course Code</label>
                    <input 
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. MTH 101"
                      className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white transition-all uppercase"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] block">Load (Credit Units)</label>
                        <div className="group relative">
                          <Info size={12} className="text-slate-300 dark:text-zinc-600 cursor-help transition-colors hover:text-indigo-500" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-3 bg-slate-900 dark:bg-zinc-800 text-white text-[10px] rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 shadow-2xl border border-white/10 leading-relaxed font-medium">
                            The academic weight of this course. Higher units significantly influence your final GPA calculation.
                          </div>
                        </div>
                      </div>
                      <select 
                        value={units}
                        onChange={e => setUnits(e.target.value)}
                        className="w-full bg-[#F8FAFC] dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white cursor-pointer appearance-none"
                      >
                        {[1,2,3,4,5,6].map(u => <option key={u} value={u}>{u} UNIT{u>1?'S':''}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] block">Yield (Exam Score %)</label>
                        <div className="group relative">
                          <Info size={12} className="text-slate-300 dark:text-zinc-600 cursor-help transition-colors hover:text-indigo-500" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-3 bg-slate-900 dark:bg-zinc-800 text-white text-[10px] rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 shadow-2xl border border-white/10 leading-relaxed font-medium">
                            Enter your final percentage score (0-100). The system automatically maps this to its corresponding grade point.
                          </div>
                        </div>
                      </div>
                      <input 
                        type="text"
                        inputMode="numeric"
                        value={score}
                        onChange={e => setScore(e.target.value)}
                        className="w-full bg-[#F8FAFC] dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl px-5 py-4 text-sm font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all dark:text-white shadow-sm hover:border-slate-300 dark:hover:border-zinc-600"
                        placeholder="E.G. 75"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={addCourse}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                  >
                    Add Course
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block italic">Format: Code Score Units (e.g. MTH101 70 3)</label>
                    <textarea 
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                      placeholder="MTH101 75 3&#10;ENG102 60 2&#10;CHM101 80 4"
                      className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white transition-all min-h-[150px] font-mono leading-relaxed"
                    />
                  </div>
                  <button 
                    onClick={handleBulkAdd}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-100 dark:shadow-none uppercase tracking-widest text-xs"
                  >
                    Add All Subjects
                  </button>
                  <p className="text-[9px] text-slate-400 font-bold text-center">Tip: Paste your entire result list here to add all scores instantly!</p>
                </div>
              )}
            </div>

            <div className="p-8 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700"></div>
              <div className="flex items-center gap-2 mb-6 opacity-80">
                <GraduationCap size={20} />
                <span className="font-bold text-xs uppercase tracking-widest">GPA Summary</span>
              </div>
              <div className="space-y-5 relative z-10">
                <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="opacity-80">Total Marks</span>
                    <div className="group/tip relative">
                       <Info size={10} className="opacity-40" />
                       <div className="absolute bottom-full left-0 mb-2 w-32 p-2 bg-slate-800 text-white text-[8px] rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none">
                         Sum of all percentage scores
                       </div>
                    </div>
                  </div>
                  <span className="font-bold">{totalMarks}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="opacity-80">Total Points</span>
                    <div className="group/tip relative">
                       <Info size={10} className="opacity-40" />
                       <div className="absolute bottom-full left-0 mb-2 w-32 p-2 bg-slate-800 text-white text-[8px] rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none">
                         Units × Grade Points (5.0 scale)
                       </div>
                    </div>
                  </div>
                  <span className="font-bold">{totalPoints}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="opacity-80">Total Units</span>
                  <span className="font-bold">{totalUnits}</span>
                </div>
                <div className="pt-6 border-t border-white/20">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Sessional GPA</span>
                  <div className="flex items-baseline gap-1">
                    <div className="text-6xl font-black tracking-tighter">
                      {gpa.toFixed(2)}
                    </div>
                    <span className="text-sm font-bold opacity-40 uppercase">/ 5.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/30 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Registered Courses</h3>
                <span className="text-[10px] font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 rounded-md">
                   {courses.length} RECORD{courses.length === 1 ? '' : 'S'}
                </span>
              </div>
              
              {courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-8 opacity-40">
                  <Info size={48} className="mb-4 text-slate-400" />
                  <p className="text-sm font-medium italic">No courses added yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-800">
                        <th className="px-6 py-5">Course</th>
                        <th className="px-6 py-5 text-center">Units</th>
                        <th className="px-6 py-5 text-center">Score</th>
                        <th className="px-6 py-5 text-center">Grade</th>
                        <th className="px-6 py-5 text-right"></th>
                      </tr>
                    </thead>
      <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
        {courses.map(course => (
          <CourseRow key={course.id} course={course} onDelete={deleteCourse} onUpdate={(updates) => updateCourse(course.id, updates)} />
        ))}
      </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

const CourseRow = memo(({ course, onDelete, onUpdate }: { course: Course; onDelete: (id: string) => void; onUpdate: (updates: Partial<Course>) => void }) => (
  <tr className="text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors list-item-render group">
    <td className="px-6 py-5">
      <div className="flex flex-col">
        <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider">{course.name}</span>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Verified Record</span>
      </div>
    </td>
    <td className="px-6 py-5 text-center">
      <input 
        type="number"
        value={course.creditUnits}
        onChange={(e) => onUpdate({ creditUnits: Number(e.target.value) })}
        className="w-12 bg-white dark:bg-zinc-800 text-center font-black border border-slate-200 dark:border-zinc-700 rounded-lg py-1 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
      />
    </td>
    <td className="px-6 py-5 text-center px-8">
      <div className="flex items-center justify-center gap-1">
        <input 
          type="number"
          value={course.score}
          onChange={(e) => onUpdate({ score: Number(e.target.value) })}
          className="w-16 bg-white dark:bg-zinc-800 text-center font-black border border-slate-200 dark:border-zinc-700 rounded-lg py-1 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
        />
        <span className="text-[10px] font-black text-slate-400 opacity-50">%</span>
      </div>
    </td>
    <td className="px-6 py-5 text-center">
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-xs ${
        course.grade === 'A' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
        course.grade === 'B' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' :
        course.grade === 'C' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
        course.grade === 'F' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 
        'bg-slate-500 text-white shadow-lg shadow-slate-500/20'
      }`}>
        {course.grade}
      </span>
    </td>
    <td className="px-6 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
      <button 
        onClick={() => onDelete(course.id)}
        className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
      >
        <Trash2 size={16} />
      </button>
    </td>
  </tr>
));

function BookOpen({ size, className }: { size: number; className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  );
}
