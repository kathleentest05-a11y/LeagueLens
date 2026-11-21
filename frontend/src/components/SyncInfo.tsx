'use client';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import ScheduleIcon from '@mui/icons-material/Schedule';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { League, SyncState } from '@/lib/types';
import { absoluteTime, isStale, relativeTime } from '@/lib/utils';

/**
 * FR-2.4/2.5: lastSyncAt is always visible; stale and provider-down states
 * are badged with icon + text (never color alone, PRD 8.3).
 */
export default function SyncInfo({ league, syncState }: { league: League; syncState: SyncState }) {
  const stale = isStale(syncState);
  const isCsv = league.source === 'csv';

  return (
    <Stack spacing={0.75} aria-label={`Sync status for ${league.name}`}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        {isCsv ? (
          <Chip size="small" variant="outlined" label="Manually imported — not live" />
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
          >
            <ScheduleIcon fontSize="inherit" aria-hidden />
            Last synced {relativeTime(syncState.lastSyncAt)}
            {syncState.lastSyncAt ? ` (${absoluteTime(syncState.lastSyncAt)})` : ''}
          </Typography>
        )}
        {stale && (
          <Chip
            size="small"
            color="warning"
            icon={<WarningAmberIcon />}
            label="Stale — over 1 hour old"
          />
        )}
        {syncState.providerUnavailable && (
          <Chip
            size="small"
            color="error"
            variant="outlined"
            icon={<CloudOffIcon />}
            label="Provider unavailable — showing last saved data"
          />
        )}
      </Stack>
      {isCsv && (
        <Typography variant="body2" color="text.secondary">
          Imported {relativeTime(syncState.lastSyncAt)}. Re-import to update.
        </Typography>
      )}
    </Stack>
  );
}
