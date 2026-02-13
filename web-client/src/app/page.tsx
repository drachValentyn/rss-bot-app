'use client';

import {
  Button,
  Card,
  CardContent,
  Container,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { IJob } from "@/entities/jobs/model/types";

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 10);
};

export default function Home() {
  const [jobs, setJobs] = useState<IJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadJobs = async () => {
      try {
        const res = await fetch("/api/jobs");
        if (!res.ok) {
          throw new Error(`Failed to load jobs: ${res.status}`);
        }
        const data: IJob[] = await res.json();
        if (isActive) {
          setJobs(data);
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : "Failed to load jobs");
        }
      }
    };

    loadJobs();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Job Listings
      </Typography>

      {error && (
        <Typography variant="body2" color="error" gutterBottom>
          {error}
        </Typography>
      )}

      {jobs.map((job) => (
        <Card key={job.id} style={{ marginBottom: "1rem" }}>
          <CardContent>
            <Typography variant="h5">{job.title}</Typography>
            <Typography variant="body2" color="textSecondary">
              {formatDate(job.published_at)}
            </Typography>
            <Button onClick={() => window.open(job.link, "_blank")}>
              View Details
            </Button>
          </CardContent>
        </Card>
      ))}
    </Container>
  );
}
