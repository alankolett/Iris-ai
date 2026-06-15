export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
  modified: string;
  ext: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  toolName?: string;
}

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  timestamp: number;
}

export interface NoteItem {
  title: string;
  preview: string;
  path: string;
  created: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WeatherInfo {
  city: string;
  temp: number;
  condition: string;
  humidity: number;
  wind: number;
}

export interface AppSettings {
  activeProvider: 'gemini' | 'groq' | 'ollama';
  geminiApiKey: string;
  groqApiKey: string;
  groqModel: string;
  tavilyApiKey: string;
  ollamaEnabled: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  theme: "neon" | "minimal";
}

export interface IpcChannels {
  // SYSTEM
  "open-app": { payload: { appName: string }; returns: { success: boolean; error?: string } };
  "close-app": { payload: { appName: string }; returns: { success: boolean } };
  "open-file": { payload: { path: string }; returns: { success: boolean } };
  "lock-screen": { payload: Record<string, never>; returns: { success: boolean } };

  // FILES
  "read-directory": { payload: { path: string }; returns: { files: FileEntry[] } };
  "create-folder": { payload: { path: string; name: string }; returns: { success: boolean } };
  "read-file": { payload: { path: string }; returns: { content: string; error?: string } };
  "write-file": { payload: { path: string; content: string }; returns: { success: boolean } };
  "delete-file": { payload: { path: string }; returns: { success: boolean } };
  "copy-file": { payload: { src: string; dest: string }; returns: { success: boolean } };

  // TERMINAL
  "run-command": { payload: { command: string; cwd?: string }; returns: { output: string; error?: string } };
  "open-in-vscode": { payload: { path: string }; returns: { success: boolean } };

  // AUTOMATION
  "click-screen": { payload: { x: number; y: number }; returns: { success: boolean } };
  "scroll-screen": { payload: { direction: "up" | "down"; amount: number }; returns: { success: boolean } };
  "press-keys": { payload: { keys: string[] }; returns: { success: boolean } };
  "type-text": { payload: { text: string }; returns: { success: boolean } };
  "take-screenshot": { payload: { savePath?: string }; returns: { base64: string; error?: string } };
  "read-screen-text": { payload: { region?: { x: number; y: number; w: number; h: number } }; returns: { text: string } };
  "move-window": { payload: { appName: string; x: number; y: number; w?: number; h?: number }; returns: { success: boolean } };
  "set-volume": { payload: { level: number }; returns: { success: boolean } };

  // WIDGETS
  "create-widget": { payload: { type: string; data: Record<string, unknown>; x: number; y: number }; returns: { id: string } };
  "close-all-widgets": { payload: Record<string, never>; returns: { success: boolean } };

  // AI
  "ai-chat": { payload: { message: string; history: ChatMessage[]; streamId: string }; returns: { done: boolean } };
  "ai-clear": { payload: Record<string, never>; returns: { success: boolean } };

  // MEMORY
  "save-memory": { payload: { key: string; value: string }; returns: { success: boolean } };
  "get-memory": { payload: { query?: string }; returns: { items: MemoryItem[] } };
  "save-note": { payload: { title: string; content: string }; returns: { path: string } };
  "get-notes": { payload: Record<string, never>; returns: { notes: NoteItem[] } };
  "index-folder": { payload: { path: string }; returns: { indexed: number } };
  "ask-oracle": { payload: { question: string }; returns: { answer: string; sources: string[] } };

  // WEB
  "web-search": { payload: { query: string }; returns: { results: SearchResult[] } };
  "get-weather": { payload: { city: string }; returns: { weather: WeatherInfo } };
  "get-stock": { payload: { ticker: string }; returns: { price: number; change: number; name: string } };
  "deep-research": { payload: { topic: string }; returns: { report: string; sources: string[] } };
  "open-url": { payload: { url: string }; returns: { success: boolean } };

  // SETTINGS
  "get-settings": { payload: Record<string, never>; returns: { settings: AppSettings } };
  "save-settings": { payload: { settings: Partial<AppSettings> }; returns: { success: boolean } };
  "dialog-open-folder": { payload: Record<string, never>; returns: { path: string | null } };

  // WINDOW CONTROLS (Required for frameless window mapping)
  "window-minimize": { payload: Record<string, never>; returns: void };
  "window-maximize": { payload: Record<string, never>; returns: void };
  "window-close": { payload: Record<string, never>; returns: void };
}
