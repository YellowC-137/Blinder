/**
 * Database of regex patterns to detect secrets with word boundaries for precision.
 */
export const patterns = [
  {
    name: 'Google API Key',
    regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'AWS Access Key',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'Generic API Key',
    regex: /\b(api[_-]?key|apikey)\s*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/gi,
    severity: 'HIGH'
  },
  {
    name: 'Generic Secret',
    regex: /\b(secret|api[_-]?secret)\s*[:=]\s*["']([A-Za-z0-9_\-]{16,})["']/gi,
    severity: 'HIGH'
  },
  {
    name: 'Generic Token',
    regex: /\b(token|auth[_-]?token|authtoken)\s*[:=]\s*["']([A-Za-z0-9_\-\.]{20,})["']/gi,
    severity: 'HIGH'
  },
  {
    name: 'Firebase API Key',
    regex: /"api_key":\s*"([^"]+)"/g,
    severity: 'HIGH'
  },
  {
    name: 'GitHub PAT',
    regex: /\bghp_[a-zA-Z0-9]{36}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'GitHub Fine-grained PAT',
    regex: /\bgithub_pat_[a-zA-Z0-9_]{82}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'Stripe Live Secret Key',
    regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'Stripe Test Secret Key',
    regex: /\bsk_test_[0-9a-zA-Z]{24,}\b/g,
    severity: 'CRITICAL'
  },
  {
    name: 'GitLab Personal Access Token',
    regex: /\bglpat-[0-9a-zA-Z\-_]{20}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'GitLab Pipeline Trigger Token',
    regex: /\bglptt-[0-9a-f]{40}\b/g,
    severity: 'HIGH'
  },
  {
    name: 'GitLab Runner Token',
    regex: /\bglrt-[0-9a-zA-Z\-_]{20,}\b/g,
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
