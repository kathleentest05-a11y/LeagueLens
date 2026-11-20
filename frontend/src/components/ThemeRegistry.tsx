'use client';

import { useState, type ReactNode } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@/theme/theme';

// Emotion cache provider for the App Router so SSR styles match the client
// (TDD 1.1). CssBaseline is the single CSS reset; Tailwind ships utilities only.
export default function ThemeRegistry({ children }: { children: ReactNode }) {
  const [cache] = useState(() => {
    const emotionCache = createCache({ key: 'mui', prepend: true });
    emotionCache.compat = true;
    return emotionCache;
  });

  useServerInsertedHTML(() => {
    const inserted = Object.entries(cache.inserted);
    if (inserted.length === 0) return null;
    return (
      <style
        data-emotion={`${cache.key} ${inserted.map(([id]) => id).join(' ')}`}
        dangerouslySetInnerHTML={{ __html: inserted.map(([, css]) => css).join(' ') }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
