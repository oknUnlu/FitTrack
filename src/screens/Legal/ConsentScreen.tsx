/**
 * ConsentScreen — RETIRED.
 *
 * Originally this was the standalone KVKK/GDPR consent gate that ran
 * before onboarding. The privacy refactor folded the four required
 * consents (privacyPolicy, ToS, KVKK aydınlatma, medical disclaimer) plus
 * AI data-sharing into the welcome step's click-to-consent on
 * OnboardingScreen, so this screen is no longer wired into navigation.
 *
 * The file is kept as an empty no-op stub instead of deleted because the
 * runtime sandbox forbids file deletion. Removing it from `src/screens/Legal/`
 * altogether is a one-liner once the codebase moves out of this sandbox.
 */

export function ConsentScreen(): null {
  return null;
}
