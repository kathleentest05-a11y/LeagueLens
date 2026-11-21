import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

export default function DashboardSkeleton() {
  return (
    <Stack spacing={2} aria-label="Loading your teams" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardContent>
            <Stack spacing={1.25}>
              <Skeleton variant="rounded" width={140} height={24} />
              <Skeleton variant="text" width="55%" sx={{ fontSize: '1.5rem' }} />
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="rounded" height={48} />
              <Skeleton variant="text" width="40%" />
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
