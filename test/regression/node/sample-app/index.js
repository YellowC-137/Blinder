// Minimal Node.js sample app with hardcoded secrets — used by Blinder regression test.
// After `blinder blind`, the constants below should be rewritten to `process.env.*`
// and the .env file should hold the original values.

const STRIPE_LIVE_SECRET_KEY = "sk_live_abcdefghijklmnopqrstuvwxyz0123";
const GITHUB_PAT = "ghp_abcdefghijklmnopqrstuvwxyzABCDEFGHIJ";
const SLACK_WEBHOOK = "https://hooks.slack.com/services/T01234567/B89012345/abcdefghijklmnopqrstuvwx";

function configure() {
  return {
    stripe: STRIPE_LIVE_SECRET_KEY,
    github: GITHUB_PAT,
    slackWebhook: SLACK_WEBHOOK
  };
}

module.exports = { configure };
