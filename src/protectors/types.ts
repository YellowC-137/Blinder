export interface ClassifyResult {
  allowed: boolean;
  reason: string;
}

export interface ClassifyKeyInput {
  fileType: 'plist' | 'xcconfig' | 'manifest' | 'properties' | 'spring';
  key: string;
  filename?: string;
}
