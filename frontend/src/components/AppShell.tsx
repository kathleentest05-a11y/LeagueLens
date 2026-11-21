'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useConnections } from '@/lib/ConnectionContext';

const NAV = [
  { href: '/', label: 'Dashboard', icon: <DashboardIcon fontSize="small" /> },
  { href: '/import', label: 'Import', icon: <UploadFileIcon fontSize="small" /> },
  { href: '/settings', label: 'Settings', icon: <SettingsIcon fontSize="small" /> },
] as const;

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { hasSleeper } = useConnections();

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        color="default"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Typography
            variant="h6"
            component={Link}
            href="/"
            sx={{ color: 'inherit', textDecoration: 'none', fontWeight: 700, mr: 1 }}
          >
            LeagueLens
          </Typography>
          <Box
            component="nav"
            aria-label="Primary"
            sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}
          >
            {NAV.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/' || pathname.startsWith('/teams')
                  : pathname.startsWith(item.href);
              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  size="small"
                  startIcon={item.icon}
                  color={active ? 'primary' : 'inherit'}
                  variant={active ? 'outlined' : 'text'}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {!hasSleeper && (
            <Button component={Link} href="/connect" variant="contained" size="small">
              Connect Sleeper
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="md" sx={{ flexGrow: 1, py: 3, width: '100%' }}>
        {children}
      </Container>
      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: 2 }}>
        <Container maxWidth="md">
          <Typography variant="body2" color="text.secondary">
            LeagueLens is read-only — lineup changes happen in Sleeper. Demo data is stubbed until
            the M1 API lands.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
