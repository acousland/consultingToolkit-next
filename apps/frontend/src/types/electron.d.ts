// Electron API types for renderer process
interface ElectronAPI {
  // App information
  getAppVersion(): Promise<string>;
  
  // File operations
  showSaveDialog(options: {
    filters?: { name: string; extensions: string[] }[];
    defaultPath?: string;
  }): Promise<{ canceled: boolean; filePath?: string }>;
  
  showOpenDialog(options: {
    properties?: string[];
    filters?: { name: string; extensions: string[] }[];
    defaultPath?: string;
  }): Promise<{ canceled: boolean; filePaths: string[] }>;
  
  // Settings/preferences
  getStoreValue(key: string): Promise<any>;
  setStoreValue(key: string, value: any): Promise<void>;
  
  // Backend management
  getBackendStatus(): Promise<{
    running: boolean;
    port: number;
    url: string;
  }>;
  restartBackend(): Promise<boolean>;
  
  // Event listeners
  onFileSelected(callback: (filePath: string) => void): void;
  onExportRequested(callback: (filePath: string) => void): void;
  removeAllListeners(channel: string): void;
}

interface Platform {
  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
}

interface Env {
  isDev: boolean;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    platform: Platform;
    env: Env;
  }
}

export {};
