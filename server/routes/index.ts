import type { Express } from "express";
import { createServer, type Server } from "http";
import { apiRouter } from "./api";
import { webhooksRouter } from "./webhooks";
import { requireAuth } from "../middleware/requireAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(webhooksRouter);
  app.use("/api", requireAuth, apiRouter);

  const httpServer = createServer(app);
  return httpServer;
}
