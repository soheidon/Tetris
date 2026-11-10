export interface RecordEntry {
  score: number;
  lines: number;
  level: number | null;
  time_ms: number;
  pieces: number | null;
  pps: number | null;
  date: string;
  timestamp_unix: number;
}

export interface RecordsData {
  schema_version: number;
  marathon: RecordEntry[];
  sprint: RecordEntry[];
  ultra: RecordEntry[];
}
