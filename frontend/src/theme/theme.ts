import { createTheme } from '@mui/material/styles';

// M0 design tokens. Severity/sport meaning is always paired with text or an
// icon, never color alone (PRD 8.3). Dark-first per PRD 8.3 dark-mode theme.
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#7dd3fc' },
    secondary: { main: '#f0abfc' },
    error: { main: '#fda4af' },
    warning: { main: '#fcd34d' },
    success: { main: '#86efac' },
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
});
