const regexHost = /\b[a-zA-Z0-9_]*(?:ip|host|domain|addr)\b\s*[:=]\s*@?["']([a-zA-Z0-9.\-]{4,})["']/gi;
const regexPort = /\b[a-zA-Z0-9_]*(?:port|pt)\b\s*(?::\s*[a-zA-Z0-9_]+\s*)?=\s*["']?(\d{2,5})["']?/gi;
const regexURL = /(https?:\/\/(?!schemas\.android\.com|www\.w3\.org|apple\.com|developer\.apple|github\.com|gitlab\.com|bitbucket\.org)(?:[a-zA-Z0-9.-]+)(?::\d+)?(?:[^\s"'<>]*))/gi;
const regexKey = /\b(api[_-]?key|apikey)\s*[:=]\s*@?["']([A-Za-z0-9_\-]{20,})["']/gi;

console.log(regexHost.exec('NSString *const ICRP_IP                 = @"cr.mobisign.or.kr";'));
console.log(regexPort.exec('int const ICRP_PORT                     = 9060;'));
console.log(regexURL.exec('NSString *const SERVER_ADDR             = @"https://mobisr.yessign.or.kr/mSR4/mobisign/MainService.do?";'));
console.log(regexKey.exec('NSString *const HASH_KEY2               =@"29B2EC45B3C3016E38003D297AC91DD993AA0CA6";'));
