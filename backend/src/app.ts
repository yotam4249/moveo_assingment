import initApp from "./server";
import mongoose from "mongoose";

const PORT = Number(process.env.PORT || 3000);

initApp()
  .then((app) => {
    const server = app.listen(PORT, () => {
      const external =
        process.env.RENDER_EXTERNAL_URL ||
        process.env.RAILWAY_STATIC_URL ||
        `http://0.0.0.0:${PORT}`;
      console.log(`🚀 Listening on ${external} (TLS terminated by host)`);
    });

    // graceful shutdown
    const bye = (sig: string) => {
      console.log(`${sig} received, shutting down...`);
      server.close(async () => {
        try { await mongoose.disconnect(); } finally { process.exit(0); }
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on("SIGTERM", () => bye("SIGTERM"));
    process.on("SIGINT", () => bye("SIGINT"));
  })
  .catch((err) => {
    console.error("❌ Failed to init app:", err);
    process.exit(1);
  });
