import type { ReactNode } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/** Standard page title block: h1 plus an optional muted description. */
export default function PageHeader({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
      {description && <Typography color="text.secondary">{description}</Typography>}
    </Stack>
  );
}
