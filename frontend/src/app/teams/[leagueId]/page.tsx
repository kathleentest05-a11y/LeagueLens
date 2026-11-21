'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PageHeader from '@/components/PageHeader';
import SyncInfo from '@/components/SyncInfo';
import TableCard, { type TableCardColumn } from '@/components/TableCard';
import { fetchTeamDetail } from '@/lib/stub-api';
import {
  ApiStubError,
  type AlertItem,
  type League,
  type Matchup,
  type RosterSlot,
  type SlotType,
  type StandingRow,
  type TeamDetailData,
} from '@/lib/types';
import { formatScore, INJURY_LABEL, PROVIDER_LABEL, recordLabel, SPORT_LABEL } from '@/lib/utils';

const GROUPS: { key: SlotType; heading: string }[] = [
  { key: 'starter', heading: 'Starters' },
  { key: 'bench', heading: 'Bench' },
  { key: 'ir', heading: 'Injured reserve' },
];

const ROSTER_COLUMNS: TableCardColumn[] = [
  { label: 'Player' },
  { label: 'Slot' },
  { label: 'Position' },
  { label: 'Pro team' },
  { label: 'Bye week' },
  { label: 'Status' },
];

const STANDINGS_COLUMNS: TableCardColumn[] = [
  { label: 'Rank' },
  { label: 'Team' },
  { label: 'Owner' },
  { label: 'Record', align: 'right' },
  { label: 'Points for', align: 'right' },
];

function BackToDashboard({ small = false }: { small?: boolean }) {
  return (
    <Button
      component={Link}
      href="/"
      startIcon={<ArrowBackIcon />}
      sx={{ alignSelf: 'flex-start' }}
      size={small ? 'small' : 'medium'}
    >
      Back to dashboard
    </Button>
  );
}

function DetailSkeleton() {
  return (
    <Stack spacing={2} aria-busy="true" aria-label="Loading team detail">
      <Skeleton variant="text" width="45%" sx={{ fontSize: '2rem' }} />
      <Skeleton variant="text" width="65%" />
      <Skeleton variant="rounded" height={180} />
      <Skeleton variant="rounded" height={180} />
    </Stack>
  );
}

function DetailError({ message }: { message: string }) {
  return (
    <Stack spacing={2}>
      <BackToDashboard />
      <Alert severity="error">{message}</Alert>
    </Stack>
  );
}

function TeamHeader({ detail }: { detail: TeamDetailData }) {
  const { team, league, syncState } = detail;
  const meta = `${league.name} · ${SPORT_LABEL[league.sport]} · ${PROVIDER_LABEL[league.source]} · Record ${recordLabel(team)}${team.pointsFor > 0 ? ` · ${team.pointsFor.toFixed(1)} pts for` : ''}`;
  return (
    <Stack spacing={1}>
      <BackToDashboard small />
      <PageHeader title={team.teamName} description={meta} />
      <SyncInfo league={league} syncState={syncState} />
    </Stack>
  );
}

/** Read-only notice at the point of action (PRD 8.2 flow 3). */
function ReadOnlyNotice({ isCsv }: { isCsv: boolean }) {
  const action = isCsv ? (
    <Button component={Link} href="/import" color="inherit" size="small">
      Re-import
    </Button>
  ) : (
    <Button
      component="a"
      href="https://sleeper.com"
      target="_blank"
      rel="noreferrer"
      color="inherit"
      size="small"
      endIcon={<OpenInNewIcon fontSize="small" />}
    >
      Open Sleeper
    </Button>
  );

  return (
    <Alert severity="info" action={action}>
      {isCsv
        ? 'This is a manually imported league — it is not live. Update it by re-importing your CSV.'
        : 'LeagueLens is read-only. To fix a lineup, open Sleeper — your next sync here will pick up the change.'}
    </Alert>
  );
}

function TeamAlerts({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) return null;
  return (
    <Stack spacing={1} component="section" aria-labelledby="team-alerts-heading">
      <Typography id="team-alerts-heading" variant="h6" component="h2">
        Needs attention
      </Typography>
      {alerts.map((item) => (
        <Alert
          key={item.id}
          severity={item.severity === 'medium' || item.severity === 'low' ? 'warning' : 'error'}
        >
          {item.message} Open Sleeper to fix it.
        </Alert>
      ))}
    </Stack>
  );
}

type MatchupOutcome = 'Winning' | 'Losing' | 'Tied';

function matchupOutcome(matchup: Matchup): MatchupOutcome | null {
  const { home, away } = matchup;
  if (home.score === null || away.score === null) return null;
  if (home.score > away.score) return 'Winning';
  if (home.score < away.score) return 'Losing';
  return 'Tied';
}

function matchupStatusText(matchup: Matchup, isCsv: boolean): string {
  if (isCsv) return 'No live score for CSV leagues — scores come from your last import.';
  const stateLabel =
    matchup.state === 'live' ? 'Live' : matchup.state === 'final' ? 'Final' : 'Not started';
  const outcome = matchupOutcome(matchup);
  return `Status: ${stateLabel}${outcome ? ` — you are ${outcome.toLowerCase()}` : ''}.`;
}

function MatchupCard({ league, matchup }: { league: League; matchup: Matchup | null }) {
  return (
    <Card component="section" aria-labelledby="matchup-heading">
      <CardContent>
        <Stack spacing={1}>
          <Typography id="matchup-heading" variant="h6" component="h2">
            Week {league.currentWeek} matchup
          </Typography>
          {matchup ? (
            <>
              <Typography>
                {matchup.home.team.teamName} <strong>{formatScore(matchup.home.score)}</strong>
                {' vs '}
                {matchup.away.team.teamName} <strong>{formatScore(matchup.away.score)}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {matchupStatusText(matchup, league.source === 'csv')}
              </Typography>
            </>
          ) : (
            <Typography color="text.secondary">No matchup scheduled this week.</Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function InjuryChip({ slot }: { slot: RosterSlot }) {
  const status = slot.player.injuryStatus;
  if (status === 'healthy') {
    return <Chip size="small" variant="outlined" label="Healthy" />;
  }
  return (
    <Chip
      size="small"
      color={status === 'questionable' ? 'warning' : 'error'}
      label={INJURY_LABEL[status]}
    />
  );
}

function RosterRow({ slot }: { slot: RosterSlot }) {
  const { player } = slot;
  return (
    <TableRow hover>
      <TableCell scope="row">{player.fullName}</TableCell>
      <TableCell>{slot.slotPosition}</TableCell>
      <TableCell>{player.position}</TableCell>
      <TableCell>{player.proTeam}</TableCell>
      <TableCell>{player.byeWeek ?? '—'}</TableCell>
      <TableCell>
        <InjuryChip slot={slot} />
      </TableCell>
    </TableRow>
  );
}

function RosterSection({ roster }: { roster: RosterSlot[] }) {
  return (
    <Stack spacing={2} component="section" aria-labelledby="roster-heading">
      <Typography id="roster-heading" variant="h5" component="h2">
        Roster
      </Typography>
      {GROUPS.map((group) => {
        const slots = roster.filter((slot) => slot.slotType === group.key);
        return (
          <TableCard
            key={group.key}
            heading={`${group.heading} (${slots.length})`}
            headingId={`roster-${group.key}-heading`}
            headingLevel="h3"
            columns={ROSTER_COLUMNS}
            empty={slots.length === 0}
            emptyText="No players in this group."
          >
            {slots.map((slot) => (
              <RosterRow key={slot.id} slot={slot} />
            ))}
          </TableCard>
        );
      })}
    </Stack>
  );
}

function StandingsRow({ row }: { row: StandingRow }) {
  const { team } = row;
  return (
    <TableRow hover selected={team.isMine}>
      <TableCell>{row.rank}</TableCell>
      <TableCell scope="row">
        {team.teamName}
        {team.isMine ? ' (you)' : ''}
      </TableCell>
      <TableCell>{team.ownerName}</TableCell>
      <TableCell align="right">{recordLabel(team)}</TableCell>
      <TableCell align="right">{team.pointsFor > 0 ? team.pointsFor.toFixed(1) : '—'}</TableCell>
    </TableRow>
  );
}

function StandingsCard({ league, standings }: { league: League; standings: StandingRow[] }) {
  return (
    <TableCard
      heading={`Standings — ${league.name}`}
      headingId="standings-heading"
      section
      columns={STANDINGS_COLUMNS}
    >
      {standings.map((row) => (
        <StandingsRow key={row.team.id} row={row} />
      ))}
    </TableCard>
  );
}

export default function TeamDetailPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [detail, setDetail] = useState<TeamDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTeamDetail(leagueId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiStubError
            ? err.message
            : 'Could not load this team. Go back to the dashboard and try again.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  if (error) return <DetailError message={error} />;
  if (!detail) return <DetailSkeleton />;

  return (
    <Stack spacing={3}>
      <TeamHeader detail={detail} />
      <ReadOnlyNotice isCsv={detail.league.source === 'csv'} />
      <TeamAlerts alerts={detail.alerts} />
      <MatchupCard league={detail.league} matchup={detail.matchup} />
      <RosterSection roster={detail.roster} />
      <StandingsCard league={detail.league} standings={detail.standings} />
    </Stack>
  );
}
