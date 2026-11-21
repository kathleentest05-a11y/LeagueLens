import type { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

export interface TableCardColumn {
  label: string;
  align?: 'left' | 'right';
}

interface TableCardProps {
  /** Visible heading text; also the table's accessible name via aria-labelledby. */
  heading: ReactNode;
  headingId: string;
  headingLevel?: 'h2' | 'h3';
  /** Render the card as a <section> landmark labelled by its heading. */
  section?: boolean;
  columns: TableCardColumn[];
  /** When true, renders emptyText instead of the table. */
  empty?: boolean;
  emptyText?: string;
  /** TableRow elements rendered inside the table body. */
  children?: ReactNode;
}

/**
 * Card with a heading and a horizontally scrollable table. The heading is
 * the single source for both the visible title and the table's accessible
 * name (aria-labelledby, never a duplicated aria-label).
 */
export default function TableCard({
  heading,
  headingId,
  headingLevel = 'h2',
  section = false,
  columns,
  empty = false,
  emptyText = 'Nothing to show.',
  children,
}: TableCardProps) {
  return (
    <Card component={section ? 'section' : 'div'} aria-labelledby={section ? headingId : undefined}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Typography id={headingId} variant="h6" component={headingLevel} sx={{ px: 2, pt: 2 }}>
          {heading}
        </Typography>
        {empty ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
            {emptyText}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small" sx={{ minWidth: 480 }} aria-labelledby={headingId}>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell key={column.label} scope="col" align={column.align ?? 'left'}>
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>{children}</TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
