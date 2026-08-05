import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import express from "express";
import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Queues
export const reminderQueue = new Queue("reminders", { connection });
export const emailQueue = new Queue("emails", { connection });
export const pdfQueue = new Queue("pdf-generation", { connection });
export const audioQueue = new Queue("audio-analysis", { connection });
export const pitchQueue = new Queue("pitch-generation", { connection });

// Health check
const PORT = parseInt(process.env.WORKER_PORT || "3001", 10);

export async function startWorker() {
  const app = express();

  // Bull Board (dev only)
  if (process.env.NODE_ENV !== "production") {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath("/admin/queues");
    createBullBoard({
      queues: Object.entries({
        reminders: reminderQueue,
        emails: emailQueue,
        "pdf-generation": pdfQueue,
        "audio-analysis": audioQueue,
        "pitch-generation": pitchQueue,
      }).map(([, q]) => new BullMQAdapter(q)),
      serverAdapter,
    });
    app.use("/admin/queues", serverAdapter.getRouter());
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", queues: ["reminders", "emails", "pdf-generation", "audio-analysis", "pitch-generation"] });
  });

  // Default worker: process rules (Prompt 5)
  new Worker(
    "reminders",
    async (job: Job) => {
      console.log(`Processing reminder job ${job.id}: ${job.name}`);
    },
    { connection },
  );

  app.listen(PORT, () => {
    console.log(`Worker running on :${PORT}`);
  });

  return app;
}

// Entry point
if (process.argv[1]?.includes("index")) {
  startWorker().catch(console.error);
}
