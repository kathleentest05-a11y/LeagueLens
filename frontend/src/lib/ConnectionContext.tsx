'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { csvConnection, disconnectProvider } from './stub-api';
import type { ProviderConnection } from './types';

const STORAGE_KEY = 'leaguelens.connections.v1';

interface ConnectionContextValue {
  connections: ProviderConnection[];
  /** False until localStorage has been read (avoids SSR hydration flash). */
  ready: boolean;
  hasSleeper: boolean;
  addConnection: (connection: ProviderConnection) => void;
  disconnect: (connectionId: string) => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

function loadStored(): ProviderConnection[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProviderConnection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConnections(loadStored());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
    } catch {
      // Storage unavailable (private mode); state still works in-memory.
    }
  }, [connections, ready]);

  const addConnection = useCallback((connection: ProviderConnection) => {
    setConnections((prev) => {
      const without = prev.filter((c) => c.provider !== connection.provider);
      // Demo convenience: connecting Sleeper also surfaces the seeded CSV
      // league so the unified dashboard shows both sources (FR-3.1).
      const extras = connection.provider === 'sleeper' ? [csvConnection] : [];
      return [...without.filter((c) => c.provider !== 'csv'), connection, ...extras];
    });
  }, []);

  const disconnect = useCallback(async (connectionId: string) => {
    await disconnectProvider(connectionId);
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
  }, []);

  const value = useMemo<ConnectionContextValue>(
    () => ({
      connections,
      ready,
      hasSleeper: connections.some((c) => c.provider === 'sleeper'),
      addConnection,
      disconnect,
    }),
    [connections, ready, addConnection, disconnect],
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnections(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnections must be used inside ConnectionProvider');
  return ctx;
}
