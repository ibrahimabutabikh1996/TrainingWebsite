import { useState } from "react";
import { Week, Exercise } from "@/types/admin";

export function useCourseBuilder() {
  const [courseName, setCourseName] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [selectedTrainee, setSelectedTrainee] = useState("");
  const [weeks, setWeeks] = useState<Week[]>([]);

  const addWeek = () => {
    setWeeks([...weeks, { id: Date.now().toString(), days: [] }]);
  };

  const addDay = (weekId: string) => {
    setWeeks(weeks.map(w => {
      if (w.id === weekId) {
        return { ...w, days: [...w.days, { id: Date.now().toString(), exercises: [] }] };
      }
      return w;
    }));
  };

  const deleteDay = (weekId: string, dayId: string) => {
    setWeeks(weeks.map(w => {
      if (w.id === weekId) {
        return { ...w, days: w.days.filter(d => d.id !== dayId) };
      }
      return w;
    }));
  };

  const deleteWeek = (weekId: string) => {
    setWeeks(weeks.filter(w => w.id !== weekId));
  };

  const addExerciseToDay = (weekId: string, dayId: string, ex: Exercise) => {
    setWeeks(weeks.map(w => {
      if (w.id === weekId) {
        return {
          ...w,
          days: w.days.map(d => {
            if (d.id === dayId) {
              return {
                ...d,
                exercises: [...d.exercises, { 
                  id: Date.now().toString(), 
                  refId: ex.id, 
                  name_ar: ex.name_ar, 
                  target_muscle: ex.target_muscle || "", 
                  sets: 3, 
                  reps: ["10", "10", "10"] 
                }]
              };
            }
            return d;
          })
        };
      }
      return w;
    }));
  };

  const updateSets = (weekId: string, dayId: string, exId: string, newSetsStr: string) => {
    let newSets = parseInt(newSetsStr) || 0;
    if (newSets < 0) newSets = 0;
    if (newSets > 10) newSets = 10;
    
    setWeeks(weeks.map(w => {
      if (w.id === weekId) {
        return {
          ...w,
          days: w.days.map(d => {
            if (d.id === dayId) {
              return {
                ...d,
                exercises: d.exercises.map(ex => {
                  if (ex.id === exId) {
                    let newReps = [...ex.reps];
                    if (newSets > ex.sets) {
                      for (let i = ex.sets; i < newSets; i++) {
                        newReps.push(newReps[newReps.length - 1] || "10");
                      }
                    } else if (newSets < ex.sets) {
                      newReps = newReps.slice(0, newSets);
                    }
                    return { ...ex, sets: newSets, reps: newReps };
                  }
                  return ex;
                })
              };
            }
            return d;
          })
        };
      }
      return w;
    }));
  };

  const updateRep = (weekId: string, dayId: string, exId: string, repIndex: number, newValue: string) => {
    setWeeks(weeks.map(w => {
      if (w.id === weekId) {
        return {
          ...w,
          days: w.days.map(d => {
            if (d.id === dayId) {
              return {
                ...d,
                exercises: d.exercises.map(ex => {
                  if (ex.id === exId) {
                    const newReps = [...ex.reps];
                    newReps[repIndex] = newValue;
                    return { ...ex, reps: newReps };
                  }
                  return ex;
                })
              };
            }
            return d;
          })
        };
      }
      return w;
    }));
  };

  const removeExercise = (weekId: string, dayId: string, exId: string) => {
    setWeeks(weeks.map(w => {
      if (w.id === weekId) {
        return {
          ...w,
          days: w.days.map(d => {
            if (d.id === dayId) {
              return { ...d, exercises: d.exercises.filter(ex => ex.id !== exId) };
            }
            return d;
          })
        };
      }
      return w;
    }));
  };

  return {
    courseName, setCourseName,
    courseDesc, setCourseDesc,
    selectedTrainee, setSelectedTrainee,
    weeks, setWeeks,
    addWeek, deleteWeek,
    addDay, deleteDay,
    addExerciseToDay, updateSets, updateRep, removeExercise
  };
}
