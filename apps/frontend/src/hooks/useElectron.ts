import { useEffect, useState } from 'react';

export const useElectron = () => {
  const [isElectron, setIsElectron] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{
    running: boolean;
    port: number;
    url: string;
  } | null>(null);

  useEffect(() => {
    // Check if we're running in Electron
    setIsElectron(typeof window !== 'undefined' && !!window.electronAPI);
  }, []);

  const getBackendStatus = async () => {
    if (window.electronAPI) {
      try {
        const status = await window.electronAPI.getBackendStatus();
        setBackendStatus(status);
        return status;
      } catch (error) {
        console.error('Failed to get backend status:', error);
        return null;
      }
    }
    return null;
  };

  const restartBackend = async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.restartBackend();
        if (result) {
          // Wait a moment then refresh status
          setTimeout(getBackendStatus, 2000);
        }
        return result;
      } catch (error) {
        console.error('Failed to restart backend:', error);
        return false;
      }
    }
    return false;
  };

  const showSaveDialog = async (filters?: { name: string; extensions: string[] }[]) => {
    if (window.electronAPI) {
      return window.electronAPI.showSaveDialog({ filters });
    }
    return { canceled: true };
  };

  const showOpenDialog = async (
    properties: string[] = ['openFile'],
    filters?: { name: string; extensions: string[] }[]
  ) => {
    if (window.electronAPI) {
      return window.electronAPI.showOpenDialog({ properties, filters });
    }
    return { canceled: true, filePaths: [] };
  };

  const getStoreValue = async (key: string) => {
    if (window.electronAPI) {
      return window.electronAPI.getStoreValue(key);
    }
    return null;
  };

  const setStoreValue = async (key: string, value: any) => {
    if (window.electronAPI) {
      return window.electronAPI.setStoreValue(key, value);
    }
  };

  // Initialize backend status on mount
  useEffect(() => {
    if (isElectron) {
      getBackendStatus();
    }
  }, [isElectron]);

  return {
    isElectron,
    backendStatus,
    getBackendStatus,
    restartBackend,
    showSaveDialog,
    showOpenDialog,
    getStoreValue,
    setStoreValue,
    platform: typeof window !== 'undefined' ? window.platform : null,
    env: typeof window !== 'undefined' ? window.env : null
  };
};
