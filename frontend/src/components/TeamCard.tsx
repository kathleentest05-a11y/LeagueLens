'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import SyncInfo from '@/components/SyncInfo';
import { refreshLeague } from '@/lib/stub-api';
import { ApiStubError, type TeamCardData } from '@/lib/types';
import { cooldownLabel, formatScore, PROVIDER_LABEL, recordLabel, SPORT_LABEL } from '@/lib/utils';

const SEVERITY_LABEL = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
} as const;

export default function TeamCard({
  card,
  onRefreshed,
}: {
  card: TeamCardData;
  onRefreshed: () => void;
}) {
  const { team, league, matchup, alerts, syncState } = card;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const cooldown = cooldownLabel(syncState.refreshAvailableAt, now);

  useEffect(() => {
    if (!cooldown) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      await refreshLeague(league.id);
      setRefreshMsg('Refreshed just now.');
      setNow(Date.now());
      onRefreshed();
    } catch (err) {
      if (err instanceof ApiStubError && err.code === 'REFRESH_COOLDOWN') {
        setRefreshMsg(err.message);
        setNow(Date.now());
        onRefreshed();
      } else {
        setRefreshMsg('Refresh failed. Your last saved data is still shown below.');
      }
    } finally {
      setRefreshing(false);
    }
  }

  const matchupLabel = matchup
    ? league.source === 'csv'
      ? `Week ${matchup.week} vs ${matchup.away.team.teamName} — no live score for CSV leagues`
      : `Week ${matchup.week}: ${team.teamName} ${formatScore(matchup.home.score)} vs ${matchup.away.team.teamName} ${formatScore(matchup.away.score)} (${matchup.state})`
    : 'No matchup this week';

  return (
    <Card component="article" aria-label={`${team.teamName}, ${league.name}`}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
            <Chip size="small" label={SPORT_LABEL[league.sport]} variant="outlined" />
            <Chip size="small" label={PROVIDER_LABEL[league.source]} variant="outlined" />
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Record {recordLabel(team)}
            </Typography>
          </Stack>

          <CardActionArea
            component={Link}
            href={`/teams/${league.id}`}
            aria-label={`View ${team.teamName} roster, standings, and matchup`}
            sx={{ borderRadius: 1, mx: -1, px: 1 }}
          >
            <Typography variant="h6" component="h3">
              {team.teamName}
            </Typography>
            <Typography color="text.secondary">
              {league.name} · {league.season}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {matchupLabel}
            </Typography>
          </CardActionArea>

          {alerts.length > 0 ? (
            <Stack
              spacing={0.75}
              component="ul"
              sx={{ listStyle: 'none', m: 0, p: 0 }}
              aria-label="Alerts for this team"
            >
              {alerts.map((item) => (
                <li key={item.id}>
                  <Alert
                    severity={
                      item.severity === 'critical' || item.severity === 'high' ? 'error' : 'warning'
                    }
                    icon={
                      item.severity === 'critical' ? (
                        <ErrorIcon fontSize="inherit" />
                      ) : (
                        <WarningIcon fontSize="inherit" />
                      )
                    }
                    sx={{ py: 0.25 }}
                  >
                    <strong>{SEVERITY_LABEL[item.severity]}:</strong> {item.message}{' '}
                    <Link href={`/teams/${league.id}`}>View roster</Link>
                  </Alert>
                </li>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              ✓ No alerts for this team.
            </Typography>
          )}

          <SyncInfo league={league} syncState={syncState} />

          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            {league.source === 'csv' ? (
              <Button component={Link} href="/import" size="small" variant="outlined">
                Update via re-import
              </Button>
            ) : (
              <Button
                size="small"
                variant="outlined"
                startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
                onClick={handleRefresh}
                disabled={refreshing || cooldown !== null}
                aria-describedby={refreshMsg ? `refresh-msg-${league.id}` : undefined}
              >
                {cooldown ? `Refresh in ${cooldown}` : refreshing ? 'Refreshing…' : 'Refresh'}
              </Button>
            )}
            <Button component={Link} href={`/teams/${league.id}`} size="small">
              Team details
            </Button>
          </Stack>
          {refreshMsg && (
            <Typography
              id={`refresh-msg-${league.id}`}
              variant="body2"
              color="text.secondary"
              role="status"
            >
              {refreshMsg}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
