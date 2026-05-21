export interface ParsedEntry {
  key: string;
  value: string;
  line: number;
}

export interface ManifestEntry {
  name: string;
  value: string | null;
  resource: string | null;
  line: number;
}
