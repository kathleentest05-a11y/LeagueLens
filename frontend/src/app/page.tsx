'use client';

import { useQuery } from '@apollo/client';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Sport } from '@leaguelens/shared';
import { HELLO_QUERY } from '@/lib/queries';

interface HelloData {
  hello: string;
  health: { status: string; service: string; version: string };
}

// M0 scaffold landing: proves Next.js + MUI + Apollo + shared types are wired.
// The dashboard from PRD Section 8 replaces this in M1.
export default function HomePage() {
  const { data, loading, error } = useQuery<HelloData>(HELLO_QUERY);

  return (
    <Container maxWidth="sm" className="py-10">
      <Stack spacing={3}>
        <Box>
          <Typography variant="h3" component="h1">
            LeagueLens
          </Typography>
          <Typography color="text.secondary">
            View your fantasy rosters across sports + providers in one hub.
          </Typography>
        </Box>

        <Card>
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              API connection
            </Typography>
            {loading && <Skeleton variant="text" width="80%" />}
            {error && (
              <Alert severity="warning">
                Could not reach the LeagueLens API. Start the backend (npm run dev) and refresh.
                Details: {error.message}
              </Alert>
            )}
            {data && (
              <Stack spacing={1}>
                <Typography>{data.hello}</Typography>
                <Typography color="text.secondary" variant="body2">
                  API health: {data.health.status} ({data.health.service} v{data.health.version})
                </Typography>
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Supported sports (shared types)
            </Typography>
            <Stack direction="row" spacing={1}>
              {Object.values(Sport).map((sport) => (
                <Chip key={sport} label={sport.toUpperCase()} />
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
