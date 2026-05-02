import React, { useState, memo, useEffect } from 'react';
import { Plus, Calculator, Trash2, GraduationCap, Info, ChevronRight, FolderPlus, Sun, Moon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Semester } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

interface CGPACalculatorProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  userId: string;
}

export default memo(function CGPACalculator({ isDarkMode, onToggleDarkMode, userId }: CGPACalculatorProps) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [units, setUnits] = useState('3');
  const [score, setScore] = useState('70');
  const [manualGpa, setManualGpa] = useState('0.00');
  const [manualUnits, setManualUnits] = useState('20');

  useEffect(() => {
    const recordRef = doc(db, 'users', userId, 'academic', 'record');
    const unsubscribe = onSnapshot(recordRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        let sems = data.semesters || [];
        
        // Migrate old data if necessary
        const migratedSems = sems.map((s: any, idx: number) => {
          if (s.level === undefined) {
             const derivedLevel = Math.ceil((idx + 1) / 2) * 100;
             const derivedType = (idx % 2 === 0) ? 1 : 2;
             return { ...s, level: derivedLevel, semesterType: derivedType };
          }
          return s;
        });

        setSemesters(migratedSems);
        if (!activeSemesterId && migratedSems.length > 0) {
          setActiveSemesterId(migratedSems[0].id);
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

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

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

    if (nextLevel > 600) return; // Limit to 600L as requested

    const newName = `${nextType === 1 ? '1st' : '2nd'} Semester, ${nextLevel} Level`;
    
    const newSem: Semester = {
      id: crypto.randomUUID(),
      name: newName,
      level: nextLevel,
      semesterType: nextType,
      courses: [],
      isManual: false
    };

    // Optimistic Update
    const updated = [...semesters, newSem];
    setSemesters(updated);
    setActiveSemesterId(newSem.id);

    // Background Sync
    saveToFirebase(updated);
  };

  const deleteSemester = (id: string) => {
    if (semesters.length <= 1) return;
    
    // Optimistic Update
    const updated = semesters.filter(s => s.id !== id);
    setSemesters(updated);
    if (activeSemesterId === id) setActiveSemesterId(updated[0].id);

    // Background Sync
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
    
    // Optimistic Update
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
      const updated = semesters.map(s => {
        if (s.id === activeSemesterId) {
          return { ...s, courses: [...s.courses, ...newEntries] };
        }
        return s;
      });

      setSemesters(updated);
      saveToFirebase(updated);
      setBulkText('');
      setBulkMode(false);
    }
  };

  const deleteCourse = (id: string) => {
    // Optimistic Update
    const updated = semesters.map(s => {
      if (s.id === activeSemesterId) {
        return { ...s, courses: s.courses.filter(c => c.id !== id) };
      }
      return s;
    });

    setSemesters(updated);
    saveToFirebase(updated);
  };

  const toggleManualMode = (semesterId: string) => {
    // Optimistic Update
    const updated = semesters.map(s => {
      if (s.id === semesterId) {
        const isNowManual = !s.isManual;
        return { 
          ...s, 
          isManual: isNowManual,
          manualGpa: isNowManual ? (s.manualGpa || 0) : undefined,
          manualUnits: isNowManual ? (s.manualUnits || 0) : undefined
        };
      }
      return s;
    });
    setSemesters(updated);
    saveToFirebase(updated);
  };

  const updateManualData = (semesterId: string, gpa: number, units: number) => {
    // Optimistic Update
    const updated = semesters.map(s => {
      if (s.id === semesterId) {
        return { ...s, manualGpa: gpa, manualUnits: units };
      }
      return s;
    });
    setSemesters(updated);
    saveToFirebase(updated);
  };

  const updateCourse = (semesterId: string, courseId: string, updates: Partial<Course>) => {
    // Optimistic Update
    const updated = semesters.map(s => {
      if (s.id === semesterId) {
        return {
          ...s,
          courses: s.courses.map(c => {
            if (c.id === courseId) {
              const newCourse = { ...c, ...updates };
              if (updates.score !== undefined) {
                const { grade, point } = getGradeInfo(newCourse.score);
                newCourse.grade = grade;
                newCourse.gradePoint = point;
              }
              return newCourse;
            }
            return c;
          })
        };
      }
      return s;
    });
    setSemesters(updated);
    saveToFirebase(updated);
  };

  // Derived values and calculations MUST be unconditional
  const activeSemester = semesters.find(s => s.id === activeSemesterId);
  
  const { semUnits, semPoints, semMarks, semGpa, totalUnits, totalPoints, cgpa } = React.useMemo(() => {
    // Semester calculations
    let sUnits = 0;
    let sPoints = 0;
    let sMarks = 0;

    if (activeSemester) {
      if (activeSemester.isManual) {
        sUnits = activeSemester.manualUnits || 0;
        sPoints = (activeSemester.manualGpa || 0) * sUnits;
      } else {
        activeSemester.courses.forEach(c => {
          sUnits += c.creditUnits;
          sPoints += (c.creditUnits * c.gradePoint);
          sMarks += c.score;
        });
      }
    }
    const sGpa = sUnits === 0 ? 0 : sPoints / sUnits;

    // CGPA calculations
    let tUnits = 0;
    let tPoints = 0;

    semesters.forEach(s => {
      if (s.isManual) {
        const u = s.manualUnits || 0;
        tUnits += u;
        tPoints += (s.manualGpa || 0) * u;
      } else {
        s.courses.forEach(c => {
          tUnits += c.creditUnits;
          tPoints += (c.creditUnits * c.gradePoint);
        });
      }
    });

    const calculatedCgpa = tUnits === 0 ? 0 : tPoints / tUnits;

    return { 
      semUnits: sUnits, 
      semPoints: sPoints, 
      semMarks: sMarks, 
      semGpa: sGpa, 
      totalUnits: tUnits, 
      totalPoints: tPoints, 
      cgpa: calculatedCgpa 
    };
  }, [activeSemester, semesters]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-zinc-950">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!activeSemester) return null;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white dark:bg-zinc-950 transition-colors duration-200 custom-scrollbar">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <div className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6 py-6 mb-10 border-b border-transparent">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none">
              <Calculator size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">CGPA Tracker</h1>
              <p className="text-slate-500 font-medium text-sm">Monitor your academic journey</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button 
               onClick={onToggleDarkMode}
               className="p-3 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 rounded-2xl border border-slate-200 dark:border-zinc-800 transition-all hover:bg-slate-50 dark:hover:bg-zinc-800"
             >
               {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             <div className="flex flex-col items-center bg-indigo-600 px-6 py-2 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
                <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Cumulative GPA</span>
                <span className="text-2xl font-black text-white">{cgpa.toFixed(2)}</span>
             </div>
             <button 
               onClick={addSemester}
               className="hidden md:flex items-center gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-white px-5 py-3 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
             >
                <FolderPlus size={18} className="text-indigo-600" />
                New Sem
             </button>
          </div>
        </div>

        {/* Levels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
          {[100, 200, 300, 400, 500, 600].map(levelNum => {
            const levelSems = semesters.filter(s => s.level === levelNum);
            const sem1 = levelSems.find(s => s.semesterType === 1);
            const sem2 = levelSems.find(s => s.semesterType === 2);
            
            // Calculate Level GPA
            let lvlUnits = 0;
            let lvlPoints = 0;
            levelSems.forEach(s => {
              if (s.isManual) {
                const u = s.manualUnits || 0;
                lvlUnits += u;
                lvlPoints += (s.manualGpa || 0) * u;
              } else {
                s.courses.forEach(c => {
                  lvlUnits += c.creditUnits;
                  lvlPoints += (c.creditUnits * c.gradePoint);
                });
              }
            });
            const lvlGpa = lvlUnits === 0 ? 0 : lvlPoints / lvlUnits;

            return (
              <div key={levelNum} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/30 flex items-center justify-between">
                   <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">{levelNum} Level</h3>
                   <div className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-lg">
                      GPA: {lvlGpa.toFixed(2)}
                   </div>
                </div>
                
                <div className="p-5 space-y-6 flex-1">
                  {/* Semester 1 */}
                  <div className={`p-4 rounded-2xl transition-all border ${activeSemesterId === sem1?.id ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-900/30' : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800'}`}>
                    <div className="flex items-center justify-between mb-3">
                       <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">1st Semester</span>
                       {sem1 && (
                         <button 
                           onClick={() => setActiveSemesterId(sem1.id)}
                           className={`text-[9px] font-black px-2 py-1 rounded-md transition-all ${activeSemesterId === sem1.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}
                         >
                           {activeSemesterId === sem1.id ? 'Active' : 'Edit'}
                         </button>
                       )}
                    </div>
                    {sem1 ? (
                      <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase">GPA</label>
                            <input 
                              type="number"
                              step="0.01"
                              value={sem1.isManual ? sem1.manualGpa : (sem1.courses.reduce((acc, c) => acc + (c.creditUnits * c.gradePoint), 0) / (sem1.courses.reduce((acc, c) => acc + c.creditUnits, 0) || 1)).toFixed(2)}
                              readOnly={!sem1.isManual}
                              onChange={e => sem1.isManual && updateManualData(sem1.id, Number(e.target.value), sem1.manualUnits || 0)}
                              className={`w-full text-xs font-bold p-2 rounded-lg border ${sem1.isManual ? 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700' : 'bg-slate-50 dark:bg-zinc-900 border-transparent text-slate-400'}`}
                            />
                         </div>
                         <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase">Units</label>
                            <input 
                              type="number"
                              value={sem1.isManual ? sem1.manualUnits : sem1.courses.reduce((acc, c) => acc + c.creditUnits, 0)}
                              readOnly={!sem1.isManual}
                              onChange={e => sem1.isManual && updateManualData(sem1.id, sem1.manualGpa || 0, Number(e.target.value))}
                              className={`w-full text-xs font-bold p-2 rounded-lg border ${sem1.isManual ? 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700' : 'bg-slate-50 dark:bg-zinc-900 border-transparent text-slate-400'}`}
                            />
                         </div>
                      </div>
                    ) : (
                      <div className="h-12 flex items-center justify-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                         <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Empty</span>
                      </div>
                    )}
                  </div>

                  {/* Semester 2 */}
                  <div className={`p-4 rounded-2xl transition-all border ${activeSemesterId === sem2?.id ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-900/30' : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800'}`}>
                    <div className="flex items-center justify-between mb-3">
                       <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">2nd Semester</span>
                       {sem2 && (
                         <button 
                           onClick={() => setActiveSemesterId(sem2.id)}
                           className={`text-[9px] font-black px-2 py-1 rounded-md transition-all ${activeSemesterId === sem2.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'}`}
                         >
                           {activeSemesterId === sem2.id ? 'Active' : 'Edit'}
                         </button>
                       )}
                    </div>
                    {sem2 ? (
                      <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase">GPA</label>
                            <input 
                              type="number"
                              step="0.01"
                              value={sem2.isManual ? sem2.manualGpa : (sem2.courses.reduce((acc, c) => acc + (c.creditUnits * c.gradePoint), 0) / (sem2.courses.reduce((acc, c) => acc + c.creditUnits, 0) || 1)).toFixed(2)}
                              readOnly={!sem2.isManual}
                              onChange={e => sem2.isManual && updateManualData(sem2.id, Number(e.target.value), sem2.manualUnits || 0)}
                              className={`w-full text-xs font-bold p-2 rounded-lg border ${sem2.isManual ? 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700' : 'bg-slate-50 dark:bg-zinc-900 border-transparent text-slate-400'}`}
                            />
                         </div>
                         <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-1 uppercase">Units</label>
                            <input 
                              type="number"
                              value={sem2.isManual ? sem2.manualUnits : sem2.courses.reduce((acc, c) => acc + c.creditUnits, 0)}
                              readOnly={!sem2.isManual}
                              onChange={e => sem2.isManual && updateManualData(sem2.id, sem2.manualGpa || 0, Number(e.target.value))}
                              className={`w-full text-xs font-bold p-2 rounded-lg border ${sem2.isManual ? 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700' : 'bg-slate-50 dark:bg-zinc-900 border-transparent text-slate-400'}`}
                            />
                         </div>
                      </div>
                    ) : (
                      <div className="h-12 flex items-center justify-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                         <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Empty</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {((sem1 && !sem2) || (!sem1 && (levelNum === 100 || semesters.some(s => s.level === levelNum - 100 && s.semesterType === 2)))) && (
                   <button 
                     onClick={addSemester}
                     className="m-5 mt-0 p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl border border-transparent text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                   >
                     Add {!sem1 ? '1st' : '2nd'} Semester
                   </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls & Summary */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <Plus size={16} className="text-indigo-600" />
                  {bulkMode ? 'Bulk Add Courses' : `Add Course to ${activeSemester.name.split(',')[0]}`}
                </h2>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                        toggleManualMode(activeSemester.id);
                        if (!activeSemester.isManual) {
                            setManualGpa(String(activeSemester.manualGpa || 0));
                            setManualUnits(String(activeSemester.manualUnits || 0));
                        }
                    }}
                    className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all border shadow-sm ${
                        activeSemester.isManual 
                        ? 'bg-amber-500 text-white border-amber-600 shadow-amber-200' 
                        : 'bg-white dark:bg-zinc-800 text-indigo-600 border-indigo-200 dark:border-indigo-900 shadow-indigo-50'
                    }`}
                  >
                    {activeSemester.isManual ? 'Switch to Course List' : 'Enter GPA Manually'}
                  </button>
                  <button 
                    onClick={() => setBulkMode(!bulkMode)}
                    className="text-[9px] font-black bg-slate-100 dark:bg-zinc-800 text-slate-500 px-2 py-1 rounded-md uppercase tracking-wider hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                  >
                    {bulkMode ? 'Manual' : 'Bulk (Fast)'}
                  </button>
                  {semesters.length > 1 && (
                    <button onClick={() => deleteSemester(activeSemesterId)} className="text-red-500 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {!activeSemester.isManual ? (
                  !bulkMode ? (
                    <div className="space-y-5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Course Code</label>
                        <input 
                          type="text"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          placeholder="e.g. CSC 101"
                          className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white transition-all uppercase"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Credit Units</label>
                        <div className="group relative">
                          <Info size={10} className="text-slate-300 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                            The weight of this course in your semester load.
                          </div>
                        </div>
                      </div>
                      <select 
                        value={units}
                        onChange={e => setUnits(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:text-white transition-all cursor-pointer"
                      >
                        {[1,2,3,4,5,6].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Exam Score (%)</label>
                        <div className="group relative">
                          <Info size={10} className="text-slate-300 cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                            Your final percentage score. ESUI uses a 5.0 grade point scale.
                          </div>
                        </div>
                      </div>
                      <input 
                        type="number"
                        value={score}
                        onChange={e => setScore(e.target.value)}
                        min="0"
                        max="100"
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:text-white transition-all shadow-sm hover:border-slate-300 dark:hover:border-zinc-600"
                        placeholder="0-100"
                      />
                    </div>
                      </div>
                      <button 
                        onClick={addCourse}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                      >
                        Save to Record
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
                        Bulk Add to {activeSemester.name.split(',')[0]}
                      </button>
                      <p className="text-[9px] text-slate-400 font-bold text-center">Rapidly add all subjects for this semester!</p>
                    </div>
                  )
              ) : (
                <div className="space-y-5">
                   <p className="text-[10px] text-slate-500 italic">Enter the summary GPA and Units for this semester directly.</p>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Semester GPA</label>
                      <input 
                        type="number"
                        step="0.01"
                        min="0"
                        max="5"
                        value={activeSemester.manualGpa}
                        onChange={e => updateManualData(activeSemester.id, Number(e.target.value), activeSemester.manualUnits || 0)}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white font-bold"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Total Credit Units</label>
                      <input 
                        type="number"
                        min="0"
                        value={activeSemester.manualUnits}
                        onChange={e => updateManualData(activeSemester.id, activeSemester.manualGpa || 0, Number(e.target.value))}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white font-bold"
                      />
                   </div>
                   <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                      <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-medium">This semester will be treated as a single block for CGPA calculation.</p>
                   </div>
                </div>
              )}
            </div>

            <div className="p-8 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700"></div>
              <div className="flex items-center gap-2 mb-6 opacity-80">
                <GraduationCap size={20} />
                <span className="font-bold text-xs uppercase tracking-widest">Semester Performance</span>
              </div>
              <div className="space-y-5 relative z-10">
                <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                  <span className="opacity-80">Total Marks %</span>
                  <span className="font-bold">{semMarks}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                  <div className="flex items-center gap-1">
                    <span className="opacity-80">Quality Points</span>
                    <div className="group/tip relative">
                       <Info size={10} className="text-white/40 cursor-help" />
                       <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[8px] rounded-lg opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
                         Sum of (Course Units × Grade Points) for this semester.
                       </div>
                    </div>
                  </div>
                  <span className="font-bold">{semPoints}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="opacity-80">Credit Units</span>
                  <span className="font-bold">{semUnits}</span>
                </div>
                <div className="pt-6 border-t border-white/20">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Calculated Semester GPA</span>
                  <div className="flex items-baseline gap-1">
                    <div className="text-6xl font-black tracking-tighter">
                      {semGpa.toFixed(2)}
                    </div>
                    <span className="text-sm font-bold opacity-40 uppercase">/ 5.0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden min-h-[500px]">
              <div className="p-6 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/30 flex justify-between items-center">
                <div className="flex items-center gap-2">
                   <h3 className="font-bold text-slate-800 dark:text-white text-sm">Course Statistics</h3>
                   <ChevronRight size={14} className="text-slate-400" />
                   <span className="text-xs font-medium text-slate-500">{activeSemester.name}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 rounded-md">
                   {activeSemester.courses.length} RECORD{activeSemester.courses.length === 1 ? '' : 'S'}
                </span>
              </div>
              
              {activeSemester.isManual ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
                  <Calculator size={48} className="mb-4 text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Manual Semester Entry</h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto italic">
                    You have chosen to enter the GPA for this semester manually. Courses are hidden in this mode.
                    CGPA calculation will use the GPA ({activeSemester.manualGpa}) and Credit Units ({activeSemester.manualUnits}) you provided.
                  </p>
                  <button 
                    onClick={() => toggleManualMode(activeSemester.id)}
                    className="mt-6 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Switch to Course Entry
                  </button>
                </div>
              ) : activeSemester.courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 opacity-40">
                  <Info size={48} className="mb-4 text-slate-400" />
                  <p className="text-sm font-medium italic">No courses recorded for this semester yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-800">
                        <th className="px-6 py-5">Course Code</th>
                        <th className="px-6 py-5 text-center">Units</th>
                        <th className="px-6 py-5 text-center">Score</th>
                        <th className="px-6 py-5 text-center">Grade</th>
                        <th className="px-6 py-5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-zinc-800">
                      {activeSemester.courses.map(course => (
                        <CourseRow 
                          key={course.id} 
                          course={course} 
                          onDelete={deleteCourse}
                          onUpdate={(updates) => updateCourse(activeSemester.id, course.id, updates)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="mt-8 p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
               <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-4">CGPA Calculation Methodology</h4>
               <p className="text-xs text-slate-500 leading-relaxed">
                  Your Cumulative Grade Point Average (CGPA) is calculated by dividing the total Quality Points earned in all semesters by the total Credit Units attempted. 
                  This tool follows the ESUI 5.0 scale where A=5, B=4, C=3, D=2, E=1, and F=0.
               </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

const CourseRow = memo(({ course, onDelete, onUpdate }: { course: Course; onDelete: (id: string) => void; onUpdate: (updates: Partial<Course>) => void }) => (
  <tr className="text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors list-item-render group">
    <td className="px-6 py-5 font-bold uppercase">{course.name}</td>
    <td className="px-6 py-5 text-center">
      <input 
        type="number"
        value={course.creditUnits}
        onChange={(e) => onUpdate({ creditUnits: Number(e.target.value) })}
        className="w-12 bg-transparent text-center font-medium border border-transparent hover:border-slate-200 dark:hover:border-zinc-700 rounded-lg transition-all focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
      />
    </td>
    <td className="px-6 py-5 text-center">
       <input 
        type="number"
        value={course.score}
        onChange={(e) => onUpdate({ score: Number(e.target.value) })}
        className="w-16 bg-transparent text-center border border-transparent hover:border-slate-200 dark:hover:border-zinc-700 rounded-lg transition-all focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
      />
       <span className="text-[10px] text-slate-400 ml-0.5">%</span>
    </td>
    <td className="px-6 py-5 text-center">
      <span className={`px-2 py-1 rounded-md font-bold text-[10px] ${
        course.grade === 'A' ? 'bg-green-100 text-green-700' :
        course.grade === 'B' ? 'bg-blue-100 text-blue-700' :
        course.grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
        course.grade === 'F' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
      }`}>
        {course.grade}
      </span>
    </td>
    <td className="px-6 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
      <button 
        onClick={() => onDelete(course.id)}
        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </td>
  </tr>
));
