import { company } from "../config/company";
import { getTwilioClient, getTwilioFromPhoneNumber } from "../twilio";

async function sendSms(to: string, body: string): Promise<void> {
  const client = await getTwilioClient();
  const fromPhone = await getTwilioFromPhoneNumber();

  await client.messages.create({
    body,
    from: fromPhone,
    to,
  });
}

export async function notifyReadyToBook(
  customerPhone: string,
  notes?: string,
): Promise<void> {
  const primaryOperator = company.phoneNumbers.primaryOperator;
  const ownerPhone = company.phoneNumbers.ownerReadyToBook;

  const operatorMessage = [
    "READY TO BOOK",
    "",
    `Customer: ${customerPhone}`,
    "",
    notes || "No assessment notes available",
  ].join("\n");

  if (primaryOperator) {
    await sendSms(primaryOperator, operatorMessage);
  } else {
    console.warn("Primary operator phone not configured; skipping operator alert");
  }

  if (ownerPhone && ownerPhone !== primaryOperator) {
    const ownerMessage = [
      "Ready to Book Alert",
      `Customer: ${customerPhone}`,
      notes ? `Notes: ${notes}` : undefined,
    ]
      .filter(Boolean)
      .join("\n");

    await sendSms(ownerPhone, ownerMessage);
  }
}
