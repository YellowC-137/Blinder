const regex = /((?:https?):\/\/(?!(?:[a-zA-Z0-9.-]+\.)?(?:schemas\.android\.com|w3\.org|apple\.com|developer\.apple\.com|github\.com|gitlab\.com|bitbucket\.org|kisa\.or\.kr|googletagmanager\.com|facebook\.com|firebase\.google\.com|google\.com|microsoft\.com|adobe\.com|apache\.org|ns\.adobe\.com))(?![^\s"'<>;]*[\$\\][\({])(?:[a-zA-Z0-9.-]+)(?::\d+)?(?:[^\s"'<>;]*[^.\s"'<>;,])?)/gi;

const tests = [
    'https://lg.usimcert.com/lguplus/mobile/JSONService.do',
    'http://test.com',
    'https://example.com/path?query=val',
    'https://example.com/${path}', // Should fail completely
    'https://example.com/$(path)', // Should fail completely
    'https://example.com/\\(path)', // Should fail completely
    'https://apple.com/api', // Should fail (blacklist)
    'https://example.com/;next' // Should end at ;
];

tests.forEach(t => {
    regex.lastIndex = 0;
    const match = regex.exec(t);
    console.log(`Test: ${t}`);
    if (match) {
        console.log(`  Matched: ${match[1]}`);
    } else {
        console.log(`  No Match`);
    }
});
