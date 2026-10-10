import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import {
  assertRuntimeConfiguration,
  environment,
} from "./config/environment.js";

async function startServer() {
  assertRuntimeConfiguration();
  await connectDatabase();

  app.listen(environment.port, () => {
    console.log(`CodeTrack API is listening on port ${environment.port}`);
  });
}

startServer().catch((error) => {
  console.log("The server could not start:", error.message);
});
