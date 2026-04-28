// Minimal React+Vite config — used by Blinder regression test.
// After `blinder blind`, hardcoded secrets should be rewritten to
// `import.meta.env.VITE_*` accessors (Vite build tool detected).

export const STRIPE_PUBLISHABLE_KEY = "pk_live_abcdefghijklmnopqrstuvwxyz0123";
export const GENERIC_API_KEY = "AIzaSyA1234567890abcdefghijklmnopqrstuvw";

export function getConfig() {
  return {
    stripe: STRIPE_PUBLISHABLE_KEY,
    api: GENERIC_API_KEY
  };
}
