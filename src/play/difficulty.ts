// Display of a case's difficulty (1..5, measured by the playtest bot, stored in PLAY_CASES).
// Kept free of imports so the web bundle can use it without the bot.

export type Difficulty = 1 | 2 | 3 | 4 | 5;
export const DIFFICULTY_NAMES = { 1: "sehr leicht", 2: "leicht", 3: "mittel", 4: "schwer", 5: "sehr schwer" } as const satisfies Record<Difficulty, string>;

/** "●●●○○" */
export const difficultyDots = (d: Difficulty): string => "●".repeat(d) + "○".repeat(5 - d);

/** "●●●○○ mittel" */
export const difficultyText = (d: Difficulty): string => `${difficultyDots(d)} ${DIFFICULTY_NAMES[d]}`;
