function testProtectLogic(match) {
    let secretValue = match;
    // Current logic in protect.js
    if ((match.includes('=') || match.includes(':')) && !match.includes('://')) {
        const parts = match.split(/[=:]/);
        secretValue = parts[parts.length - 1].trim().replace(/^["']|["']$/g, '');
    }
    return secretValue;
}

const url = 'https://lg.usimcert.com/lguplus/mobile/JSONService.do';
const kv = 'API_KEY = "SECRET_VALUE"';

console.log('URL test:', testProtectLogic(url));
console.log('KV test:', testProtectLogic(kv));
