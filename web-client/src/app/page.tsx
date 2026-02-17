import { Box, Button, Container, Stack, Typography } from "@mui/material";
import Link from "next/link";

export default function Home() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Stack spacing={3} alignItems="flex-start">
        <Typography variant="h3" component="h1" fontWeight={700}>
          Vacancies Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Browse job vacancies aggregated from RSS feeds and stored in Supabase.
        </Typography>
        <Box>
          <Link href="/vacancies" style={{ textDecoration: "none" }}>
            <Button variant="contained">Open Vacancies</Button>
          </Link>
        </Box>
      </Stack>
    </Container>
  );
}
