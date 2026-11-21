'use client';

import Link from 'next/link';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PageHeader from '@/components/PageHeader';
import SectionCard from '@/components/SectionCard';

// CSV import flow (template, upload, preview, validate) lands in M3.
// This M1 placeholder keeps the second onboarding path reachable and
// honestly labeled instead of burying it (FR-1.2, issue #8 scope).
export default function ImportPage() {
  return (
    <Stack spacing={3}>
      <PageHeader
        title="Import a league from CSV"
        description="Track a commissioner-run or offline league beside your Sleeper teams. CSV leagues get the same dashboard layout with “manually imported — not live” labeling."
      />

      <Alert severity="info">
        The full import flow — downloadable template, upload, preview, and row-level validation —
        arrives in milestone M3. A sample imported league (“Office Old-Timers”) is already on your
        dashboard once you connect, so you can preview how CSV leagues look and behave.
      </Alert>

      <SectionCard heading="How it will work">
        <Typography variant="body2" color="text.secondary" component="div">
          <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
            <li>Download the CSV template (one row per rostered player).</li>
            <li>Fill in league, teams, players, positions, and starter flags.</li>
            <li>Upload the file and preview the parsed league before anything is saved.</li>
            <li>
              Fix any flagged rows, then confirm. Re-importing updates the same league — no
              duplicates.
            </li>
          </ol>
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Button component={Link} href="/" variant="contained">
            Back to dashboard
          </Button>
          <Button component={Link} href="/connect" variant="outlined">
            Connect Sleeper instead
          </Button>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
