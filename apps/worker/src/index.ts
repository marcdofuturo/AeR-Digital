import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import express from "express";
import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { processNextPresentationJob } from "./presentation/processor";
import { createPresentationDependencies } from "./presentation/runtime";

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
  const presentationDependencies = createPresentationDependencies();
  let presentationCycleRunning = false;
  let presentationWorkerStatus: "ready" | "processing" | "error" = "ready";

  const processPresentationJobs = async () => {
    if (presentationCycleRunning) return;
    presentationCycleRunning = true;
    presentationWorkerStatus = "processing";
    try {
      while (await processNextPresentationJob(presentationDependencies)) {
        // Drain the current queue before waiting for the next polling interval.
      }
      presentationWorkerStatus = "ready";
    } catch {
      presentationWorkerStatus = "error";
      console.error("Presentation worker cycle failed");
    } finally {
      presentationCycleRunning = false;
    }
  };

  const presentationTimer = setInterval(processPresentationJobs, 5_000);
  presentationTimer.unref();
  void processPresentationJobs();

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
    res.json({
      status: presentationWorkerStatus === "error" ? "degraded" : "ok",
      presentation: presentationWorkerStatus,
      queues: ["reminders", "emails", "pdf-generation", "audio-analysis", "pitch-generation", "presentation-db"],
    });
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
