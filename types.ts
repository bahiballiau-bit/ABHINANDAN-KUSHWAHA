export interface SolutionData {
  solutionMarkdown: string;
  visualPrompt: string; // The prompt suggested by the solver for the video generator
  confidence: 'High' | 'Medium' | 'Low';
}

export interface VideoState {
  status: 'idle' | 'generating' | 'completed' | 'error';
  videoUri?: string;
  progress?: number; // Simulated progress or status message
}

export interface SearchResult {
  text: string;
  webSources: { uri: string; title: string }[];
  verification?: string; // Verification text from the advanced model
}

export interface TranslationCache {
  [language: string]: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SOLVED = 'SOLVED',
  ERROR = 'ERROR',
  SEARCHING = 'SEARCHING' // Added state for search
}

// Augment window for the AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}