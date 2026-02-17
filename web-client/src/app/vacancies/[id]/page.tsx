import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVacancyById } from "@/lib/db";

type PageProps = {
  params: Promise<{ id: string }>;
};

const formatDate = (value: Date) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "n/a";
  return value.toISOString();
};

export default async function VacancyDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const vacancy = await getVacancyById(id);

  if (!vacancy) {
    notFound();
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Link href="/vacancies" style={{ textDecoration: "none" }}>
            <Button variant="text">Back to vacancies</Button>
          </Link>
        </Box>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h4" component="h1">
                {vacancy.title}
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={vacancy.source.toUpperCase()} />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Published: ${formatDate(vacancy.published_at)}`}
                />
                {vacancy.company && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={vacancy.company}
                  />
                )}
              </Stack>

              {vacancy.description ? (
                <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
                  {vacancy.description}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No description available.
                </Typography>
              )}

              <Box>
                <Button
                  href={vacancy.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="contained"
                >
                  Open original vacancy
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
