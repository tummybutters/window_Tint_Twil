import type { Request, Response, NextFunction } from "express";
import twilio from "twilio";
import { env } from "../config/env";
import { getRequestUrl } from "../utils/request";

interface SignatureOptions {
  context: string;
  requireAuthTokenInProduction?: boolean;
}

export function validateTwilioSignature({
  context,
  requireAuthTokenInProduction = true,
}: SignatureOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const twilioSignature = req.headers["x-twilio-signature"] as string | undefined;

    if (requireAuthTokenInProduction && env.isProduction && !env.TWILIO_AUTH_TOKEN) {
      console.error(`[${context}] TWILIO_AUTH_TOKEN required in production but not set`);
      res.status(500).json({ error: "Server configuration error" });
      return;
    }

    if (!env.TWILIO_AUTH_TOKEN) {
      console.warn(
        `[${context}] TWILIO_AUTH_TOKEN not set - signature validation skipped (development only).`,
      );
      next();
      return;
    }

    if (!twilioSignature) {
      if (env.isProduction) {
        console.error(`[${context}] X-Twilio-Signature header missing in production`);
        res.status(403).json({ error: "Signature required" });
        return;
      }
      console.warn(`[${context}] X-Twilio-Signature header missing`);
      next();
      return;
    }

    const isValid = twilio.validateRequest(
      env.TWILIO_AUTH_TOKEN,
      twilioSignature,
      getRequestUrl(req),
      req.body,
    );

    if (!isValid) {
      console.error(`[${context}] Invalid Twilio signature`);
      res.status(403).json({ error: "Invalid signature" });
      return;
    }

    next();
  };
}
