// Cal.com booking configuration
// These are public values, not secrets - hardcoded for simplicity

export const bookingConfig = {
  // Your Cal.com username (the "obisidianautoworks" part of cal.com/obisidianautoworks)
  calcomUsername: "obisidianautoworks",

  // Cal.com API URL (standard, rarely needs changing)
  calcomApiUrl: "https://api.cal.com/v2",

  // Webhook URL for booking notifications (relative to app)
  bookingWebhookUrl: "/webhook/calcom",

  // Optional: only needed if using Cal.com API directly from client
  // Most setups don't need these - the embed handles everything
  calcomClientId: import.meta.env.VITE_CALCOM_CLIENT_ID ?? "",
  calcomAccessToken: import.meta.env.VITE_CALCOM_ACCESS_TOKEN ?? "",
  calcomEventSlug: import.meta.env.VITE_CALCOM_EVENT_SLUG ?? "",
};
