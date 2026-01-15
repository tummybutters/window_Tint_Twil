import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import cors from "cors";
import { apiRouter } from "../server/routes/api.js";
import { webhooksRouter } from "../server/routes/webhooks.js";
import { requireAuth } from "../server/middleware/requireAuth.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register routes - webhooks don't need auth
app.use(webhooksRouter);
app.use("/api", requireAuth, apiRouter);

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Vercel serverless handler
export default function handler(req: VercelRequest, res: VercelResponse) {
    return app(req as any, res as any);
}
