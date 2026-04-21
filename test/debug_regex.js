const regex = /(?:NSString\s*\*\s*const|const\s+NSString\s*\*)\s+([a-zA-Z0-9_]+)\s*=\s*@?["']([^"']+)["']\s*;/gi;
const line = 'NSString *const SERVER_ADDR = @"https://api.example.com";';
const match = regex.exec(line);

if (match) {
    console.log('✅ Match found!');
    console.log('Group 1 (Name):', match[1]);
    console.log('Group 2 (Value):', match[2]);
} else {
    console.log('❌ No match found');
}
