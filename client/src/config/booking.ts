export const bookingConfig = {
  calcomClientId: import.meta.env.VITE_CALCOM_CLIENT_ID ?? "",
  calcomAccessToken: import.meta.env.VITE_CALCOM_ACCESS_TOKEN ?? "",
  calcomUsername: import.meta.env.VITE_CALCOM_USERNAME ?? "",
  calcomEventSlug: import.meta.env.VITE_CALCOM_EVENT_SLUG ?? "",
  calcomApiUrl: import.meta.env.VITE_CALCOM_API_URL ?? "https://api.cal.com/v2",
  bookingWebhookUrl: import.meta.env.VITE_BOOKING_WEBHOOK_URL ?? "/webhook/calcom",
};
