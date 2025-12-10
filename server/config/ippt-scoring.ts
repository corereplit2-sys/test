export const IPPT_SCORING = {
  situps: [
    { reps: 60, points: 25 },
    { reps: 55, points: 24 },
    { reps: 52, points: 23 },
    { reps: 49, points: 22 },
    { reps: 46, points: 21 },
    { reps: 43, points: 20 },
    { reps: 40, points: 18 },
    { reps: 37, points: 16 },
    { reps: 34, points: 14 },
    { reps: 31, points: 12 },
    { reps: 28, points: 10 },
    { reps: 25, points: 8 },
    { reps: 22, points: 6 },
    { reps: 19, points: 4 },
    { reps: 16, points: 2 },
    { reps: 0, points: 0 }
  ],
  pushups: [
    { reps: 60, points: 25 },
    { reps: 55, points: 24 },
    { reps: 52, points: 23 },
    { reps: 49, points: 22 },
    { reps: 46, points: 21 },
    { reps: 43, points: 20 },
    { reps: 40, points: 18 },
    { reps: 37, points: 16 },
    { reps: 34, points: 14 },
    { reps: 31, points: 12 },
    { reps: 28, points: 10 },
    { reps: 25, points: 8 },
    { reps: 22, points: 6 },
    { reps: 19, points: 4 },
    { reps: 16, points: 2 },
    { reps: 0, points: 0 }
  ],
  run: [
    { seconds: 540, points: 50 },  // 9:00
    { seconds: 545, points: 49 },  // 9:05
    { seconds: 550, points: 48 },  // 9:10
    { seconds: 555, points: 47 },  // 9:15
    { seconds: 560, points: 46 },  // 9:20
    { seconds: 565, points: 45 },  // 9:25
    { seconds: 570, points: 44 },  // 9:30
    { seconds: 575, points: 43 },  // 9:35
    { seconds: 580, points: 42 },  // 9:40
    { seconds: 585, points: 41 },  // 9:45
    { seconds: 590, points: 40 },  // 9:50
    { seconds: 595, points: 39 },  // 9:55
    { seconds: 600, points: 38 },  // 10:00
    { seconds: 605, points: 37 },  // 10:05
    { seconds: 610, points: 36 },  // 10:10
    { seconds: 615, points: 35 },  // 10:15
    { seconds: 620, points: 34 },  // 10:20
    { seconds: 625, points: 33 },  // 10:25
    { seconds: 630, points: 32 },  // 10:30
    { seconds: 635, points: 31 },  // 10:35
    { seconds: 640, points: 30 },  // 10:40
    { seconds: 645, points: 29 },  // 10:45
    { seconds: 650, points: 28 },  // 10:50
    { seconds: 655, points: 27 },  // 10:55
    { seconds: 660, points: 26 },  // 11:00
    { seconds: 665, points: 25 },  // 11:05
    { seconds: 670, points: 24 },  // 11:10
    { seconds: 675, points: 23 },  // 11:15
    { seconds: 680, points: 22 },  // 11:20
    { seconds: 685, points: 21 },  // 11:25
    { seconds: 690, points: 20 },  // 11:30
    { seconds: 695, points: 19 },  // 11:35
    { seconds: 700, points: 18 },  // 11:40
    { seconds: 705, points: 17 },  // 11:45
    { seconds: 710, points: 16 },  // 11:50
    { seconds: 715, points: 15 },  // 11:55
    { seconds: 720, points: 14 },  // 12:00
    { seconds: 725, points: 13 },  // 12:05
    { seconds: 730, points: 12 },  // 12:10
    { seconds: 735, points: 11 },  // 12:15
    { seconds: 740, points: 10 },  // 12:20
    { seconds: 745, points: 9 },   // 12:25
    { seconds: 750, points: 8 },   // 12:30
    { seconds: 755, points: 7 },   // 12:35
    { seconds: 760, points: 6 },   // 12:40
    { seconds: 765, points: 5 },   // 12:45
    { seconds: 770, points: 4 },   // 12:50
    { seconds: 775, points: 3 },   // 12:55
    { seconds: 780, points: 2 },   // 13:00
    { seconds: 785, points: 1 },   // 13:05
    { seconds: 999, points: 0 }    // >13:05
  ]
};

export const IPPT_AWARDS = {
  gold: { min: 85, max: 100 },
  silver: { min: 75, max: 84 },
  pass: { min: 51, max: 74 },
  fail: { min: 0, max: 50 }
};
