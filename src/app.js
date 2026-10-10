import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { environment } from "./config/environment.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import authRoutes from "./routes/auth.routes.js";

// Init express app
const app = express();

// Codebase level middle (system level middle)
app.use(helmet());
app.use(cors({ origin: environment.frontendUrl, credentials: true }));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

// test health of server
app.get("/api/v1/health", (request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/v1/auth", authRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
