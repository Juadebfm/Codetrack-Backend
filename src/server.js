import mongoose from "mongoose";
import { app } from "./app.js";
import { connectToDatabase } from "./config/database.js";
import { environment, assertRuntimeConfiguration } from "./config/environment.js";

try {
  assertRuntimeConfiguration();
  await connectToDatabase();
  const server = app.listen(environment.port);
  server.once("listening", () => {
    console.log(`CodeTrack API listening on port ${environment.port}`);
  });
  server.once("error", async (error) => {
    console.error("Could not start HTTP server:", error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
} catch (error) {
  console.error("Could not start CodeTrack:", error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
}
