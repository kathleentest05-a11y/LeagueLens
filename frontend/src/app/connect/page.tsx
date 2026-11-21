'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PageHeader from '@/components/PageHeader';
import SectionCard from '@/components/SectionCard';
import { useConnections } from '@/lib/ConnectionContext';
import { connectSleeper } from '@/lib/stub-api';
import { ApiStubError } from '@/lib/types';

interface ConnectErrorState {
  message: string;
  suggestCsv: boolean;
}

function toConnectError(err: unknown): ConnectErrorState {
  if (err instanceof ApiStubError) {
    return { message: err.message, suggestCsv: err.code === 'SLEEPER_NO_LEAGUES' };
  }
  return {
    message: 'Something went wrong connecting to Sleeper. Try again in a moment.',
    suggestCsv: false,
  };
}

function AlreadyConnectedNotice() {
  return (
    <Alert severity="info">
      Sleeper is already connected. Reconnecting updates the handle; manage or disconnect it in{' '}
      <Link href="/settings">Settings</Link>.
    </Alert>
  );
}

function ConnectProgress({ step }: { step: string | null }) {
  return (
    <Stack spacing={1} role="status" aria-live="polite">
      <LinearProgress aria-label="Importing your leagues" />
      <Typography variant="body2" color="text.secondary">
        {step ?? 'Working…'}
      </Typography>
    </Stack>
  );
}

function ConnectError({ error }: { error: ConnectErrorState }) {
  return (
    <Alert severity="error" role="alert">
      {error.message}
      {error.suggestCsv && (
        <>
          {' '}
          Or <Link href="/import">import a league from CSV</Link> instead.
        </>
      )}
    </Alert>
  );
}

function SleeperConnectForm() {
  const router = useRouter();
  const { addConnection } = useConnections();
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progressStep, setProgressStep] = useState<string | null>(null);
  const [error, setError] = useState<ConnectErrorState | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setProgressStep('Looking up your Sleeper account…');
    try {
      const connection = await connectSleeper(username, setProgressStep);
      addConnection(connection);
      setProgressStep('Done — opening your dashboard…');
      router.push('/');
    } catch (err) {
      setError(toConnectError(err));
      setProgressStep(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <Stack component="form" onSubmit={handleSubmit} spacing={2}>
          <TextField
            label="Sleeper username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            autoFocus
            fullWidth
            disabled={submitting}
            helperText="Demo: any username works. Try “notfound” or “noleagues” to preview error states."
          />

          {submitting && <ConnectProgress step={progressStep} />}
          {error && <ConnectError error={error} />}

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button
              type="submit"
              variant="contained"
              disabled={submitting || username.trim().length === 0}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {submitting ? 'Connecting…' : 'Connect and import leagues'}
            </Button>
            <Button component={Link} href="/" variant="text">
              Back to dashboard
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Equal second path (FR-1.2) — CSV is never buried. */
function CsvPathCard() {
  return (
    <SectionCard heading="Import a league from CSV instead">
      <Typography variant="body2" color="text.secondary">
        Commissioner-run and offline leagues work here too. You’ll get the same dashboard, rosters,
        and standings — scores and injury updates just won’t be live.
      </Typography>
      <div>
        <Button component={Link} href="/import" variant="outlined">
          Go to CSV import
        </Button>
      </div>
    </SectionCard>
  );
}

export default function ConnectPage() {
  const { hasSleeper } = useConnections();

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Connect Sleeper"
        description="One connection surfaces every Sleeper league you own a team in this season, across sports. LeagueLens is read-only and never asks for your Sleeper password."
      />

      {hasSleeper && <AlreadyConnectedNotice />}

      <SleeperConnectForm />

      <Divider sx={{ '&::before, &::after': { borderColor: 'divider' } }}>
        <Typography variant="body2" color="text.secondary">
          No Sleeper account?
        </Typography>
      </Divider>

      <CsvPathCard />
    </Stack>
  );
}
