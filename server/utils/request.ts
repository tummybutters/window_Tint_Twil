import type { Request } from "express";

export function getRequestUrl(req: Request): string {
  const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.get("host");
  return `${protocol}://${host}${req.originalUrl}`;
}

export function getBaseUrl(req: Request): string {
  const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.get("host");
  return `${protocol}://${host}`;
}
