'use client';

import Link from 'next/link';
import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PageHeader from '@/components/PageHeader';
import SectionCard from '@/components/SectionCard';
import { useConnections } from '@/lib/ConnectionContext';
import type { ProviderConnection } from '@/lib/types';
import { PROVIDER_LABEL, relativeTime } from '@/lib/utils';

function EmptyConnections() {
  return (
    <Stack spacing={1.5}>
      <Typography color="text.secondary">
        Nothing connected yet. Connect Sleeper or import a CSV league to populate your dashboard.
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button component={Link} href="/connect" variant="contained" size="small">
          Connect Sleeper
        </Button>
        <Button component={Link} href="/import" variant="outlined" size="small">
          Import from CSV
        </Button>
      </Stack>
    </Stack>
  );
}

function lastSyncLabel(connection: ProviderConnection): string {
  return connection.provider === 'csv'
    ? `Last imported ${relativeTime(connection.lastSyncAt)}`
    : `Last synced ${relativeTime(connection.lastSyncAt)}`;
}

function ConnectionRow({
  connection,
  onDisconnectRequest,
}: {
  connection: ProviderConnection;
  onDisconnectRequest: (connection: ProviderConnection) => void;
}) {
  const isCsv = connection.provider === 'csv';
  return (
    <ListItem
      disablePadding
      sx={{ py: 1.5 }}
      secondaryAction={
        <Button
          color="error"
          variant="outlined"
          size="small"
          onClick={() => onDisconnectRequest(connection)}
          aria-label={`${isCsv ? 'Delete' : 'Disconnect'} ${PROVIDER_LABEL[connection.provider]} (${connection.handle})`}
        >
          {isCsv ? 'Delete' : 'Disconnect'}
        </Button>
      }
    >
      <ListItemText
        primary={
          <Box
            component="span"
            sx={{ display: 'inline-flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
          >
            {PROVIDER_LABEL[connection.provider]}
            <Chip size="small" label={connection.handle} variant="outlined" />
            <Chip size="small" color="success" label="Connected" />
          </Box>
        }
        secondary={lastSyncLabel(connection)}
      />
    </ListItem>
  );
}

function ConnectionList({
  connections,
  onDisconnectRequest,
}: {
  connections: ProviderConnection[];
  onDisconnectRequest: (connection: ProviderConnection) => void;
}) {
  return (
    <List disablePadding>
      {connections.map((connection, index) => (
        <div key={connection.id}>
          {index > 0 && <Divider component="li" />}
          <ConnectionRow connection={connection} onDisconnectRequest={onDisconnectRequest} />
        </div>
      ))}
    </List>
  );
}

function MoreProviders() {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1" component="h3">
        More providers
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Yahoo is planned after the Sleeper slice; ESPN has no official API and no scheduled
        milestone. We won’t promise dates — CSV import covers those leagues today.
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button variant="outlined" disabled aria-describedby="yahoo-soon">
          Yahoo — Coming soon
        </Button>
        <Button variant="outlined" disabled aria-describedby="espn-soon">
          ESPN — Coming soon
        </Button>
      </Stack>
      <Typography id="yahoo-soon" variant="caption" color="text.secondary">
        Yahoo: disabled until the post-M1 provider work lands.
      </Typography>
    </Stack>
  );
}

function ConnectionsCard({
  connections,
  onDisconnectRequest,
}: {
  connections: ProviderConnection[];
  onDisconnectRequest: (connection: ProviderConnection) => void;
}) {
  return (
    <SectionCard heading="Connections" headingId="connections-heading" section contentSpacing={2}>
      {connections.length === 0 ? (
        <EmptyConnections />
      ) : (
        <ConnectionList connections={connections} onDisconnectRequest={onDisconnectRequest} />
      )}
      <Divider />
      <MoreProviders />
    </SectionCard>
  );
}

function AccountCard() {
  return (
    <SectionCard heading="Account" headingId="account-heading" section>
      <Typography variant="body2" color="text.secondary">
        Sign-in and account deletion arrive with Firebase Auth in M1. This demo keeps your
        connection choice in this browser only.
      </Typography>
    </SectionCard>
  );
}

function DisconnectDialog({
  connection,
  busy,
  onCancel,
  onConfirm,
}: {
  connection: ProviderConnection | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isCsv = connection?.provider === 'csv';
  return (
    <Dialog
      open={connection !== null}
      onClose={() => !busy && onCancel()}
      aria-labelledby="disconnect-title"
    >
      <DialogTitle id="disconnect-title">
        {isCsv ? 'Delete imported leagues?' : 'Disconnect Sleeper?'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {isCsv
            ? 'This removes your imported leagues and their saved data from LeagueLens. You can re-import the CSV later.'
            : `This disconnects “${connection?.handle}” and removes its leagues and cached data from your dashboard. Nothing changes on Sleeper — you can reconnect anytime.`}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy} autoFocus>
          Cancel
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained" disabled={busy}>
          {busy ? 'Working…' : isCsv ? 'Delete' : 'Disconnect'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function SettingsPage() {
  const { connections, disconnect } = useConnections();
  const [pending, setPending] = useState<ProviderConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function confirmDisconnect() {
    if (!pending) return;
    setBusy(true);
    try {
      await disconnect(pending.id);
      setNotice(
        `${PROVIDER_LABEL[pending.provider]} disconnected. Its leagues and cached data were removed from your dashboard.`,
      );
      setPending(null);
    } catch {
      setNotice('Disconnect failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Settings"
        description="Manage connected providers and imported leagues. Disconnecting removes the associated cached data (FR-1.4)."
      />

      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)} role="status">
          {notice}
        </Alert>
      )}

      <ConnectionsCard connections={connections} onDisconnectRequest={setPending} />
      <AccountCard />

      <DisconnectDialog
        connection={pending}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmDisconnect()}
      />
    </Stack>
  );
}
