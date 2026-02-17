export interface Vacancy {
  id: string;
  title: string;
  company: string | null;
  description: string | null;
  url: string;
  source: string;
  published_at: string;
  created_at: string;
}
