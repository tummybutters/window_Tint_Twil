import { env } from "./env";

const fallbackBookingUrl = "https://www.hardyswashnwax.com/";
const bookingUrl = (() => {
  if (env.PUBLIC_BOOKING_URL) return env.PUBLIC_BOOKING_URL;
  if (env.PUBLIC_APP_URL) {
    try {
      return new URL("/book", env.PUBLIC_APP_URL).toString();
    } catch (error) {
      console.error("Invalid PUBLIC_APP_URL; falling back to website.", error);
    }
  }
  return fallbackBookingUrl;
})();

export const company = {
  name: "Obsidian Auto Works",
  assistantName: "ObsidianBot",
  ownerName: "Manager",
  websiteUrl: "https://www.obsidianautoworksoc.com/",
  instagramUrl: "https://www.instagram.com/obsidianautoworksoc/",
  bookingUrl,
  serviceAreas: [
    "Orange County",
    "Los Angeles",
    "Inland Empire",
    "Irvine",
    "Newport Beach",
    "Tustin",
  ],
  phoneNumbers: {
    businessLine: env.TWILIO_PHONE_NUMBER,
    ownerReadyToBook: env.BUSINESS_OWNER_READY_TO_BOOK_PHONE,
    primaryOperator: env.PRIMARY_OPERATOR_PHONE || env.BUSINESS_OWNER_READY_TO_BOOK_PHONE,
  },
  callHandling: {
    forwardToNumber: env.TWILIO_FORWARD_TO_NUMBER,
    forwardTimeoutSeconds: env.callForwardTimeoutSeconds,
    minDurationSeconds: env.callMinDurationSeconds,
    answeredMessage:
      "Thanks for calling Obsidian Auto Works! If you're looking for a quote on our Premium Ceramic Window Tint, check out our work and pricing on our website: https://www.obsidianautoworksoc.com/\n\nIf you have any specific questions about shades or scheduling, feel free to text us here!",
    missedMessage:
      `Hey! Sorry we missed your call. We're likely in the shop working on a car.\n\nWe specialize in Premium IR Ceramic Tint. You can view our services and request a quote here: ${bookingUrl}\n\nFeel free to text us back with your vehicle year/make/model for a quick estimate!`,
  },
};
