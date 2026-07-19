import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

interface NetworkContextValue {
  isOffline: boolean;
  isChecking: boolean;
  checkConnection: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  // Monitor connectivity reactively using NetInfo
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // state.isConnected can be null initially, we treat null as connected
      // to avoid flash of "No Internet" on application launch.
      const connected = state.isConnected ?? true;
      setIsOffline(!connected);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Manual verification ping helper (useful for retry clicks and force checks)
  const checkConnection = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      // Use a fast HEAD/GET check with a 4-second timeout to verify actual internet access.
      // We target f-droid.org since SHEEN depends on repository access,
      // or a generic reliable endpoint like gstatic generate_204.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const target = Platform.OS === 'web' 
        ? '/api/proxy?url=https%3A%2F%2Ff-droid.org' 
        : 'https://f-droid.org';

      const response = await fetch(target, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      }).catch(async () => {
        // Fallback to GET if HEAD isn't accepted or proxy fails
        const altController = new AbortController();
        const altTimeoutId = setTimeout(() => altController.abort(), 4000);
        const res = await fetch(target, {
          method: 'GET',
          signal: altController.signal,
          headers: { 'Cache-Control': 'no-cache' }
        });
        clearTimeout(altTimeoutId);
        return res;
      });

      clearTimeout(timeoutId);
      
      const ok = response.status >= 200 && response.status < 400;
      setIsOffline(!ok);
      return ok;
    } catch {
      setIsOffline(true);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  return (
    <NetworkContext.Provider value={{ isOffline, isChecking, checkConnection }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return ctx;
}
