const PLAN = {
  name: "8-Wochen Kraftzyklus – Freitag Open Gym",
  startDate: null,
  weeks: [
    {
      id: 1, label: "Woche 1",
      exercises: [
        { id: "sq1", name: "Kniebeuge", sets: 5, reps: 5, weight: 68, unit: "kg", rest: "3 Min" },
        { id: "bp1", name: "Bankdrücken", sets: 5, reps: 5, weight: 63, unit: "kg", rest: "3 Min" },
        { id: "pu1", name: "Weighted Strict Pull-up", sets: 4, reps: 3, weight: 6, unit: "kg", desc: "+5-7kg" },
        { id: "mu1", name: "Ring-MU Negative", sets: 3, reps: 3, desc: "2-3 pro Satz" },
        { id: "sp1", name: "Strict Press", sets: 3, reps: 5, weight: 39, unit: "kg", desc: "Top Set 5 @ RPE8 (~38-40kg) + 2 Backoffs @ 90%", isTopSet: true }
      ]
    },
    {
      id: 2, label: "Woche 2",
      exercises: [
        { id: "sq2", name: "Kniebeuge", sets: 5, reps: 5, weight: 70, unit: "kg", rest: "3 Min" },
        { id: "bp2", name: "Bankdrücken", sets: 5, reps: 5, weight: 63.5, unit: "kg", rest: "3 Min" },
        { id: "pu2", name: "Weighted Pull-up", sets: 4, reps: 3, weight: 8.5, unit: "kg", desc: "+7-10kg" },
        { id: "mu2", name: "Ring-MU Negative", sets: 3, reps: 3 },
        { id: "sp2", name: "Strict Press", sets: 3, reps: 5, weight: 39, unit: "kg", desc: "Top Set @ RPE8 + 2 Backoffs", isTopSet: true }
      ]
    },
    {
      id: 3, label: "Woche 3",
      exercises: [
        { id: "sq3", name: "Kniebeuge", sets: 5, reps: 4, weight: 73, unit: "kg", rest: "3 Min" },
        { id: "bp3", name: "Bankdrücken", sets: 5, reps: 4, weight: 64.5, unit: "kg", rest: "3 Min" },
        { id: "pu3", name: "Explosive Pull-up (max Speed)", sets: 5, reps: 3, weight: 0, unit: "kg", desc: "zur Brust" },
        { id: "mu3", name: "Banded MU-Transition", sets: 4, reps: 3 },
        { id: "sp3", name: "Strict Press", sets: 3, reps: 4, weight: 40, unit: "kg", desc: "Top Set @ RPE8 + 2 Backoffs", isTopSet: true }
      ]
    },
    {
      id: 4, label: "Woche 4",
      exercises: [
        { id: "sq4", name: "Kniebeuge", sets: 5, reps: 4, weight: 75, unit: "kg", rest: "3 Min" },
        { id: "bp4", name: "Bankdrücken", sets: 5, reps: 4, weight: 65, unit: "kg", rest: "3 Min" },
        { id: "pu4", name: "Explosive Pull-up", sets: 5, reps: 3, weight: 2, unit: "kg", desc: "leicht Zusatzgewicht" },
        { id: "mu4", name: "Banded MU-Transition", sets: 4, reps: 3 },
        { id: "sp4", name: "Strict Press", sets: 3, reps: 4, weight: 41, unit: "kg", desc: "Top Set @ RPE8 + 2 Backoffs", isTopSet: true }
      ]
    },
    {
      id: 5, label: "Woche 5",
      exercises: [
        { id: "sq5", name: "Kniebeuge", sets: 5, reps: 3, weight: 78, unit: "kg", rest: "3 Min" },
        { id: "bp5", name: "Bankdrücken", sets: 5, reps: 3, weight: 66, unit: "kg", rest: "3 Min" },
        { id: "pu5", name: "Explosive Weighted Pull-up", sets: 5, reps: 3, weight: 4, unit: "kg" },
        { id: "mu5", name: "False-Grip Hold/Transition", sets: 4, desc: "reps" },
        { id: "sp5", name: "Strict Press", sets: 3, reps: 3, weight: 42, unit: "kg", desc: "Top Set @ RPE8 + 2 Backoffs", isTopSet: true }
      ]
    },
    {
      id: 6, label: "Woche 6 (Deload)", isDeload: true,
      exercises: [
        { id: "sq6", name: "Kniebeuge", sets: 3, reps: 5, weight: 57, unit: "kg", rest: "2 Min" },
        { id: "bp6", name: "Bankdrücken", sets: 3, reps: 5, weight: 50, unit: "kg", rest: "2 Min" },
        { id: "pu6", name: "Strict Pull-up", sets: 3, reps: 5, weight: 0, unit: "kg", desc: "BW, kein MU-Drill" },
        { id: "sp6", name: "Strict Press", sets: 3, reps: 5, weight: 29, unit: "kg", desc: "~70% von W5 Top-Set, kein Test" }
      ]
    },
    {
      id: 7, label: "Woche 7",
      exercises: [
        { id: "sq7", name: "Kniebeuge", sets: 5, reps: 3, weight: 80, unit: "kg", rest: "3 Min" },
        { id: "bp7", name: "Bankdrücken", sets: 5, reps: 3, weight: 66.5, unit: "kg", rest: "3 Min" },
        { id: "pu7", name: "Muscle-up-Versuche", sets: 6, reps: 1, weight: 0, unit: "kg", desc: "5-8x, kipping oder strict" },
        { id: "pu7b", name: "Backup Explosive Pull-up", sets: 3, reps: 3, weight: 0, unit: "kg" },
        { id: "sp7", name: "Strict Press", sets: 3, reps: 3, weight: 43, unit: "kg", desc: "Top Set @ RPE8 + 2 Backoffs", isTopSet: true }
      ]
    },
    {
      id: 8, label: "Woche 8 (Test)", isTest: true,
      exercises: [
        { id: "sq8", name: "Kniebeuge – 5RM Test", sets: 1, reps: 5, weight: 84, unit: "kg", desc: "Ziel 83-85kg", rest: "3+ Min" },
        { id: "bp8", name: "Bankdrücken – 5RM Test", sets: 1, reps: 5, weight: 67, unit: "kg", desc: "Ziel 66-68kg", rest: "3+ Min" },
        { id: "pu8", name: "Muscle-up Test", sets: 1, desc: "max. saubere Versuche" },
        { id: "sp8", name: "Strict Press – 5RM Test", sets: 1, reps: 5, weight: 44, unit: "kg", desc: "neuer Top-Set Test" }
      ]
    }
  ]
};