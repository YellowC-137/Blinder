
const regex = /(https?:\/\/(?!schemas\.android\.com|www\.w3\.org|apple\.com|developer\.apple|github\.com|gitlab\.com|bitbucket\.org)(?:[a-zA-Z0-9.-]+)(?::\d+)?(?:[^\s"'<>]*))/gi;
const testUrl = 'http://www.apple.com/DTDs/PropertyList-1.0.dtd';

console.log('Testing old regex:');
console.log('Match:', testUrl.match(regex));

const newRegex = /(https?:\/\/(?!(?:[a-zA-Z0-9.-]+\.)?(?:schemas\.android\.com|w3\.org|apple\.com|developer\.apple\.com|github\.com|gitlab\.com|bitbucket\.org))(?:[a-zA-Z0-9.-]+)(?::\d+)?(?:[^\s"'<>]*))/gi;

console.log('\nTesting new regex:');
console.log('Match:', testUrl.match(newRegex));
