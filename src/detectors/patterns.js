/**
 * Database of regex patterns to detect secrets.
 */
export const patterns = [
  {
    name: 'Google API Key',
    regex: /AIza[0-9A-Za-z\-_]{35}/g,
    severity: 'HIGH'
  },
  {
    name: 'AWS Access Key',
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: 'HIGH'
  },
  {
    name: 'Generic API Key',
    regex: /api[_-]?key\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/gi,
    severity: 'HIGH'
  },
  {
    name: 'Generic Secret',
    regex: /secret\s*[:=]\s*["']([A-Za-z0-9_\-]{16,})["']/gi,
    severity: 'HIGH'
  },
  {
    name: 'Generic Token',
    regex: /token\s*[:=]\s*["']([A-Za-z0-9_\-\.]{20,})["']/gi,
    severity: 'HIGH'
  },
  {
    name: 'Firebase API Key',
    regex: /"api_key":\s*"([^"]+)"/g,
    severity: 'HIGH'
  },
  {
    name: 'Private Key',
    regex: /-----BEGIN (RSA|EC|DSA|OPENSSH)? ?PRIVATE KEY-----/g,
    severity: 'HIGH'
  },
  {
    name: 'Slack Webhook',
    regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9_]{8}\/B[A-Z0-9_]{8}\/[A-Za-z0-9_]{24}/g,
    severity: 'HIGH'
  }
];

export const platformExtensions = {
  flutter: ['.dart', '.yaml', '.xml', '.plist'],
  ios: ['.swift', '.m', '.h', '.plist', '.xcconfig'],
  android: ['.kt', '.java', '.xml', '.gradle', '.properties', '.json']
};
