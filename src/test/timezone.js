// Jest globalSetup: tests run far from UTC, so a local calendar day computed through UTC
// (toISOString().slice(0, 10)) fails loudly instead of passing on a UTC machine (ADR-0005).
export default function pinTimezone() {
  process.env.TZ = 'Pacific/Auckland';
}
