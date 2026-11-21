import type { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';

interface SectionCardProps {
  heading: ReactNode;
  /** Required when `section` is set; the heading becomes the section's accessible name. */
  headingId?: string;
  headingLevel?: 'h2' | 'h3';
  /** Render as a <section> landmark labelled by its heading. */
  section?: boolean;
  /** Spacing between the heading and body content. */
  contentSpacing?: number;
  sx?: SxProps<Theme>;
  children: ReactNode;
}

/**
 * Padded card with a heading. The flush, table-bearing sibling is
 * TableCard; both take their accessible name from the visible heading via
 * aria-labelledby instead of duplicating it in aria-label.
 */
export default function SectionCard({
  heading,
  headingId,
  headingLevel = 'h2',
  section = false,
  contentSpacing = 1.5,
  sx,
  children,
}: SectionCardProps) {
  return (
    <Card
      component={section ? 'section' : 'div'}
      aria-labelledby={section ? headingId : undefined}
      sx={sx}
    >
      <CardContent>
        <Stack spacing={contentSpacing}>
          <Typography id={headingId} variant="h6" component={headingLevel}>
            {heading}
          </Typography>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
