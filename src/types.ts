export type ImageSize = '1K' | '2K' | '4K';

export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export type ChatModelId =
  | 'gemini-4-hydrogen'
  | 'gemini-4-carbon'
  | 'gemini-4-argon'
  | 'gemini-3.1-flash-lite';

export interface StoryPage {
  id: string;
  pageNumber: number;
  heading: string;
  text: string;
  illustrationPrompt: string;
  wonderQuestion: string;
  imageUrl?: string;
  imageHistory?: Array<{
    url: string;
    size: ImageSize;
    style: string;
    createdAt: number;
  }>;
}

export interface StoryBook {
  id: string;
  title: string;
  subtitle: string;
  ageBand: string;
  artStyle: string;
  readingMinutes: number;
  createdAt: number;
  isCustom?: boolean;
  pages: StoryPage[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  model?: ChatModelId;
  roleLabel?: string;
  timestamp: number;
}

export const ART_STYLES = [
  'Warm Watercolor & Gouache',
  'Cut-Paper Collage',
  'Pen & Ink Storybook Wash',
  'Soft Colored Pencil & Chalk',
] as const;

export const VOICE_OPTIONS: Array<{
  id: VoiceName;
  label: string;
  stylePrompt: string;
}> = [
  {
    id: 'Kore',
    label: 'Warm Storyteller',
    stylePrompt:
      'Warm, gentle, expressive children’s storybook narrator with clear cheerful pacing and soft pauses',
  },
  {
    id: 'Puck',
    label: 'Playful Sprite',
    stylePrompt:
      'Playful, bright, animated children’s storyteller full of curiosity and smiling energy',
  },
  {
    id: 'Charon',
    label: 'Gentle Grandpa Owl',
    stylePrompt:
      'Calm, cozy, wise grandfatherly bedtime storyteller with unhurried comforting cadence',
  },
  {
    id: 'Zephyr',
    label: 'Breezy Dreamer',
    stylePrompt:
      'Soft, melodic, soothing bedtime narrator reading gently under starlight',
  },
  {
    id: 'Fenrir',
    label: 'Bold Explorer',
    stylePrompt:
      'Lively, adventurous, theatrical storyteller with vivid expression for grand discoveries',
  },
];

export const BUDDY_ROLES: Array<{
  model: ChatModelId;
  title: string;
  subtitle: string;
  starterPrompts: string[];
}> = [
  {
    model: 'gemini-4-hydrogen',
    title: 'Story Companion',
    subtitle: 'Friendly everyday chat about characters and feelings',
    starterPrompts: [
      'What is the main character feeling right now?',
      'Tell me a fun detail hidden in this scene.',
      'Who is your favorite character in this book?',
    ],
  },
  {
    model: 'gemini-4-carbon',
    title: 'Deep Wonder Guide',
    subtitle: 'Thoughtful explanations for big "why" questions',
    starterPrompts: [
      'Why does nature work like it does in this story?',
      'What big lesson can we learn from this page?',
      'How would things change if the hero made a different choice?',
    ],
  },
  {
    model: 'gemini-4-argon',
    title: 'Adventure Architect',
    subtitle: 'Interactive choose-your-path twists and story puzzles',
    starterPrompts: [
      'Give me two wild twists for what happens next!',
      'Play a 3-clue riddle game about this page.',
      'Let us pretend I step right into this picture!',
    ],
  },
  {
    model: 'gemini-3.1-flash-lite',
    title: 'Quick Word Helper',
    subtitle: 'Instant kid-friendly word meanings and rhymes',
    starterPrompts: [
      'Pick a tricky word on this page and explain it simply.',
      'Give me 4 playful rhymes for a word in this story.',
      'Help me sound out the longest word here.',
    ],
  },
];
