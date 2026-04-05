// Section 8.2 — complete whitelist of allowed interest tags
export const INTEREST_TAGS = [
  "soccer","basketball","baseball","football","tennis","swimming","gymnastics",
  "hockey","cycling","running","dogs","cats","horses","dinosaurs","sharks",
  "birds","insects","marine life","wildlife","farm animals","Minecraft","Roblox",
  "video games","board games","card games","puzzles","chess","drawing","painting",
  "music","dancing","reading","writing","cooking","baking","crafts","space",
  "robots","cars","trains","planes","ships","construction","Lego","superheroes",
  "mythology","history","geography","weather","volcanoes","oceans","rainforests",
] as const;

export type InterestTag = typeof INTEREST_TAGS[number];

// Grouped for the tag picker UI
export const INTEREST_TAG_GROUPS: { label: string; emoji: string; tags: InterestTag[] }[] = [
  {
    label: "Sports",
    emoji: "⚽",
    tags: ["soccer","basketball","baseball","football","tennis","swimming","gymnastics","hockey","cycling","running"],
  },
  {
    label: "Animals",
    emoji: "🐾",
    tags: ["dogs","cats","horses","dinosaurs","sharks","birds","insects","marine life","wildlife","farm animals"],
  },
  {
    label: "Gaming",
    emoji: "🎮",
    tags: ["Minecraft","Roblox","video games","board games","card games","puzzles","chess"],
  },
  {
    label: "Arts & Music",
    emoji: "🎨",
    tags: ["drawing","painting","music","dancing","reading","writing"],
  },
  {
    label: "Food & Crafts",
    emoji: "🍳",
    tags: ["cooking","baking","crafts"],
  },
  {
    label: "Science & Tech",
    emoji: "🚀",
    tags: ["space","robots","cars","trains","planes","ships","construction","Lego"],
  },
  {
    label: "Stories & World",
    emoji: "🌍",
    tags: ["superheroes","mythology","history","geography","weather","volcanoes","oceans","rainforests"],
  },
];
