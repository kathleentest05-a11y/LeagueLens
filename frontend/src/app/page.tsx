'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import PageHeader from '@/components/PageHeader';
import SectionCard from '@/components/SectionCard';
import TeamCard from '@/components/TeamCard';
import { useConnections } from '@/lib/ConnectionContext';
import { fetchDashboard } from '@/lib/stub-api';
import type { DashboardData, SportId, TeamCardData } from '@/lib/types';
import { relativeTime } from '@/lib/utils';

type SportFilter = SportId | 'all';

interface TeamFilters {
  sport: SportFilter;
  search: string;
  needsAttentionOnly: boolean;
}

const EMPTY_FILTERS: TeamFilters = { sport: 'all', search: '', needsAttentionOnly: false };

function matchesFilters(card: TeamCardData, filters: TeamFilters): boolean {
  if (filters.sport !== 'all' && card.league.sport !== filters.sport) return false;
  if (filters.needsAttentionOnly && card.alerts.length === 0) return false;
  const query = filters.search.trim().toLowerCase();
  if (query && !`${card.team.teamName} ${card.league.name}`.toLowerCase().includes(query)) {
    return false;
  }
  return true;
}

function DashboardTitle({ data, hasSleeper }: { data: DashboardData | null; hasSleeper: boolean }) {
  const syncSummary = data
    ? `${data.teams.length} teams · Last synced ${relativeTime(data.lastSyncedAt)}`
    : 'Loading…';
  return (
    <PageHeader
      title="Your teams"
      description={`${hasSleeper ? 'Sleeper and imported leagues together. ' : ''}${syncSummary}`}
    />
  );
}

/** Empty state: no leagues yet → two equal onboarding paths (FR-1.2, FR-3.5). */
function OnboardingEmptyState() {
  return (
    <Stack spacing={3}>
      <PageHeader
        title="All your teams, one screen"
        description="LeagueLens pulls every team you own into one dashboard with alerts before a missed lineup costs you the week. Pick either path to get started — you can add the other later."
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <SectionCard heading="Connect Sleeper" sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Enter your Sleeper username and we’ll import every league you own a team in this season.
            No password needed — Sleeper data is public and read-only.
          </Typography>
          <Button component={Link} href="/connect" variant="contained">
            Connect Sleeper
          </Button>
        </SectionCard>

        <SectionCard heading="Import a league from CSV" sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            For commissioner-run or offline leagues with no API. Download the template, fill in your
            rosters, and track that league beside your Sleeper teams.
          </Typography>
          <Button component={Link} href="/import" variant="contained" color="secondary">
            Import from CSV
          </Button>
        </SectionCard>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Just looking? Connect with any username to see the demo dashboard. Try “notfound” or
        “noleagues” on the connect screen to preview error states.
      </Typography>
    </Stack>
  );
}

function ProviderDownNotice() {
  return (
    <Alert severity="warning" role="status">
      Sleeper is unavailable right now. You’re seeing the last saved data — “last synced” times
      below show how old it is. We’ll keep retrying automatically.
    </Alert>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      {message}
    </Alert>
  );
}

function DashboardFilters({
  filters,
  onChange,
}: {
  filters: TeamFilters;
  onChange: (filters: TeamFilters) => void;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      useFlexGap
      flexWrap="wrap"
      alignItems="center"
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={filters.sport}
        onChange={(_, value: SportFilter | null) => value && onChange({ ...filters, sport: value })}
        aria-label="Filter by sport"
      >
        <ToggleButton value="all">All sports</ToggleButton>
        <ToggleButton value="nfl">NFL</ToggleButton>
        <ToggleButton value="nba">NBA</ToggleButton>
      </ToggleButtonGroup>
      <TextField
        size="small"
        label="Search league or team"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        sx={{ minWidth: 200, flexGrow: 1 }}
      />
      <FormControlLabel
        control={
          <Switch
            checked={filters.needsAttentionOnly}
            onChange={(e) => onChange({ ...filters, needsAttentionOnly: e.target.checked })}
          />
        }
        label="Needs attention only"
      />
    </Stack>
  );
}

function NoMatchingTeams({ onClear }: { onClear: () => void }) {
  return (
    <SectionCard heading="No teams match those filters" contentSpacing={1}>
      <Typography color="text.secondary" variant="body2">
        Try a different sport or search, or turn off “Needs attention only.”
      </Typography>
      <div>
        <Button size="small" variant="outlined" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    </SectionCard>
  );
}

function TeamList({ teams, onRefreshed }: { teams: TeamCardData[]; onRefreshed: () => void }) {
  return (
    <Stack spacing={2} component="section" aria-label="Team list">
      {teams.map((card) => (
        <TeamCard key={card.team.id} card={card} onRefreshed={onRefreshed} />
      ))}
    </Stack>
  );
}

/** Footer status: explicit all-clear or open-alert count (FR-3.5). */
function AlertSummary({ data, visibleCount }: { data: DashboardData; visibleCount: number }) {
  const { openAlertCount } = data;
  if (openAlertCount === 0 && visibleCount > 0) {
    return (
      <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />}>
        All clear — no open alerts across your teams. Nice work.
      </Alert>
    );
  }
  if (openAlertCount > 0) {
    return (
      <Typography variant="body2" color="text.secondary" role="status">
        {openAlertCount} open alert{openAlertCount === 1 ? '' : 's'} across your teams. Teams
        needing attention are listed first.
      </Typography>
    );
  }
  return null;
}

export default function DashboardPage() {
  const { ready, connections, hasSleeper } = useConnections();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TeamFilters>(EMPTY_FILTERS);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDashboard());
    } catch {
      setError('Could not load your teams. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && connections.length > 0) void load();
  }, [ready, connections.length, load]);

  const visibleTeams = useMemo(
    () => (data ? data.teams.filter((card) => matchesFilters(card, filters)) : []),
    [data, filters],
  );

  if (!ready) {
    return (
      <Stack spacing={2}>
        <PageHeader title="Your teams" />
        <DashboardSkeleton />
      </Stack>
    );
  }

  if (connections.length === 0) return <OnboardingEmptyState />;

  const anyProviderDown = data?.teams.some((c) => c.syncState.providerUnavailable) ?? false;

  return (
    <Stack spacing={2.5}>
      <DashboardTitle data={data} hasSleeper={hasSleeper} />

      {anyProviderDown && <ProviderDownNotice />}
      {error && <LoadError message={error} onRetry={() => void load()} />}

      <DashboardFilters filters={filters} onChange={setFilters} />

      {loading && !data ? (
        <DashboardSkeleton />
      ) : data && visibleTeams.length === 0 ? (
        <NoMatchingTeams onClear={() => setFilters(EMPTY_FILTERS)} />
      ) : (
        <TeamList teams={visibleTeams} onRefreshed={() => void load()} />
      )}

      {data && <AlertSummary data={data} visibleCount={visibleTeams.length} />}
    </Stack>
  );
}
