import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { env } from "../config/env";

interface JwtPayload {
  exp?: number;
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function verifyJwt(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token");
  }

  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;

  const expectedSignature = crypto
    .createHmac("sha256", env.SUPABASE_JWT_SECRET)
    .update(data)
    .digest("base64url");

  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length) {
    throw new Error("Invalid signature");
  }

  if (!crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("Invalid signature");
  }

  const payloadJson = base64UrlDecode(payload);
  const parsed = JSON.parse(payloadJson) as JwtPayload;

  if (parsed.exp && Date.now() / 1000 > parsed.exp) {
    throw new Error("Token expired");
  }

  return parsed;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers["x-api-key"];

  if (env.INTEGRATION_API_KEY && apiKey === env.INTEGRATION_API_KEY) {
    next();
    return;
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  try {
    verifyJwt(token);
    next();
  } catch (error) {
    console.error("Auth verification failed:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
}
