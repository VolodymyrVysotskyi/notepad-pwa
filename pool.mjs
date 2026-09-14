// AI voice copy, split out from index.html so the same POOL is exercised by
// both the runtime (AI.refresh) and the test suite (lib.test.mjs).
//
// Voice: short and sharp as a pocket knife of a ninja-gangster. Quiet menace,
// dry confidence. Every line is a cut. Roasts the blank page, never the writer.
//
// Each entry is { tags, line }. tags is a list matched against aiContext()
// output (time-of-day + day-of-week). pickByContext()/poolByContext() prefer
// tagged matches and fall back to untagged defaults — so every category needs
// at least one untagged entry, otherwise an unlock at a non-matching context
// will throw. tests/lib.test.mjs pins this invariant.

export const POOL = {
  intros: [
    { tags: [], line: "One phrase locks everything. Forget it, the words go with it." },
    { tags: ['late-night'], line: "It's late. One phrase locks the page. Forget it, the night takes the words." },
    { tags: ['early-morning'], line: "Up early. One phrase locks it. Forget it, the day starts clean without you." },
    { tags: ['morning'], line: "Morning. One phrase locks the page. Forget it, the day starts clean." },
    { tags: ['evening'], line: "Evening. One phrase locks it. Forget it, the page goes dark." },
    { tags: ['night'], line: "Late again. One phrase locks the page. Forget it, the words sleep with you." },
    { tags: ['monday'], line: "Monday already. One phrase locks the week down. Forget it, the week stays yours." },
    { tags: ['friday'], line: "Friday. One phrase locks the page. Forget it tonight, it stays gone." },
    { tags: ['weekend'], line: "Weekend. One phrase locks the page. Forget it, no one remembers." },
  ],
  firstPrompts: [
    { tags: [], line: "What's it gonna be?" },
    { tags: ['late-night'], line: "What's keeping you up?" },
    { tags: ['early-morning'], line: "First thought. Go." },
    { tags: ['morning'], line: "Morning. What's first?" },
    { tags: ['afternoon'], line: "Afternoon. Out with it." },
    { tags: ['evening'], line: "Evening. What's loud?" },
    { tags: ['night'], line: "Night. Talk to me." },
    { tags: ['monday'], line: "Monday. What's the move?" },
    { tags: ['friday'], line: "Friday. What's left to say?" },
    { tags: ['weekend'], line: "Weekend. What's on your mind?" },
  ],
  rowPlaceholders: [
    { tags: [], line: "Words. Now." },
    { tags: [], line: "Make it count." },
    { tags: [], line: "Plot twist?" },
    { tags: [], line: "Stop thinking. Type." },
    { tags: [], line: "Surprise me." },
    { tags: [], line: "Less staring, more typing." },
    { tags: ['late-night'], line: "Late writes hit different." },
    { tags: ['late-night'], line: "Insomnia? Spill it." },
    { tags: ['late-night'], line: "Past midnight. Speak." },
    { tags: ['early-morning'], line: "Coffee and consequences." },
    { tags: ['early-morning'], line: "First thought. Go." },
    { tags: ['morning'], line: "Morning, killer." },
    { tags: ['morning'], line: "Day's edge. Write." },
    { tags: ['afternoon'], line: "Lunch over. Type." },
    { tags: ['afternoon'], line: "Mid-day, mid-thought." },
    { tags: ['evening'], line: "Evening light. Type slow." },
    { tags: ['evening'], line: "Day's almost gone." },
    { tags: ['night'], line: "Last call. Speak." },
    { tags: ['monday'], line: "Monday already?" },
    { tags: ['monday'], line: "Week's first cut." },
    { tags: ['friday'], line: "Friday. End it loud." },
    { tags: ['friday'], line: "One more day. Write." },
    { tags: ['weekend'], line: "No deadlines. Spill." },
    { tags: ['weekend'], line: "Weekend brain. Use it." },
  ],
};
