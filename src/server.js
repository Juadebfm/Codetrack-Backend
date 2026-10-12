import mongoose from "mongoose";
import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { environment, assertRuntimeConfiguration } from "./config/environment.js";

let server;
let stopping = false;

async function shutdown(exitCode = 0) {
  if (exitCode) process.exitCode = exitCode;
  if (stopping) return;
  stopping = true;
  // Bound shutdown if requests or database cleanup never finish.
  const timeout = setTimeout(() => {
    console.error("Shutdown timed out");
    process.exit(1);
  }, 10000);
  timeout.unref();
  try {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  } catch (error) {
    process.exitCode = 1;
    console.error("Could not close HTTP server:", error.message);
  } finally {
    try {
      await mongoose.disconnect();
    } catch (error) {
      process.exitCode = 1;
      console.error("Could not disconnect MongoDB:", error.message);
    }
    // The unreferenced deadline remains available if cleanup leaves handles open.
  }
}

process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });

try {
  assertRuntimeConfiguration();
  await connectDatabase();
  if (!stopping) {
    server = app.listen(environment.port);
    server.once("listening", () => {
      console.log(`CodeTrack API listening on port ${environment.port}`);
    });
    server.on("error", (error) => {
      console.error("HTTP server error:", error.message);
      void shutdown(1);
    });
  }
} catch (error) {
  console.error("Could not start CodeTrack:", error.message);
  await shutdown(1);
}
