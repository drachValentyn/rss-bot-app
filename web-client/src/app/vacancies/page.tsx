import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { getVacanciesPage } from "@/lib/db";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const formatDate = (value: Date) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "n/a";
  return value.toISOString().slice(0, 10);
};

export default async function VacanciesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const pageFromQuery = Array.isArray(params.page)
    ? params.page[0]
    : params.page;
  const page = Number(pageFromQuery ?? "1");
  const data = await getVacanciesPage(page);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="h4" component="h1" fontWeight={700}>
            Vacancies
          </Typography>
          <Chip
            label={`Total: ${data.total}`}
            color="primary"
            variant="outlined"
          />
        </Stack>

        {data.vacancies.length === 0 ? (
          <Card variant="outlined">
            <CardContent>
              <Typography>No vacancies found.</Typography>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2} direction={"row"} flexWrap={"wrap"} >
            {data.vacancies.map((vacancy) => (
              <Grid key={vacancy.id} alignItems="stretch" size={{ xs: 6, md: 4 }} >
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="h6">{vacancy.title}</Typography>
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                      >
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
                      {vacancy.description && (
                        <Typography variant="body2" color="text.secondary">
                          {vacancy.description.slice(0, 280)}
                          {vacancy.description.length > 280 ? "..." : ""}
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Link
                      href={`/vacancies/${vacancy.id}`}
                      style={{ textDecoration: "none" }}
                    >
                      <Button size="small" variant="outlined">
                        Details
                      </Button>
                    </Link>
                    <Button
                      href={vacancy.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      variant="contained"
                    >
                      Open Source
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Link
              href={
                data.page > 1
                  ? `/vacancies?page=${data.page - 1}`
                  : `/vacancies?page=1`
              }
              style={{
                textDecoration: "none",
                pointerEvents: data.page <= 1 ? "none" : "auto",
              }}
            >
              <Button variant="outlined" disabled={data.page <= 1}>
                Previous
              </Button>
            </Link>
            <Chip label={`Page ${data.page} of ${data.totalPages}`} />
            <Link
              href={
                data.page < data.totalPages
                  ? `/vacancies?page=${data.page + 1}`
                  : `/vacancies?page=${data.totalPages}`
              }
              style={{
                textDecoration: "none",
                pointerEvents: data.page >= data.totalPages ? "none" : "auto",
              }}
            >
              <Button variant="outlined" disabled={data.page >= data.totalPages}>
                Next
              </Button>
            </Link>
          </Stack>
        </Box>
      </Stack>
    </Container>
  );
}
