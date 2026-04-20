import fs from 'fs';
import path from 'path';

function getLineNumber(content, index) {
  const prefix = content.substring(0, index);
  return prefix.split('\n').length;
}

const content = `This is a test file with a multi-line secret.

-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA75x...
...more base64 data...
...line 3...
...line 4...
-----END RSA PRIVATE KEY-----

And another one:
-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIB...
-----END EC PRIVATE KEY-----

End of file.`;

const regex = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/g;

let match;
while ((match = regex.exec(content)) !== null) {
  console.log(`Found match at index ${match.index}, line ${getLineNumber(content, match.index)}`);
  console.log(`Content:\n${match[0]}`);
  console.log('---');
}
