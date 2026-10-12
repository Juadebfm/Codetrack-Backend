import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import learningRouter from "./routes/learning.routes.js";
import authRouter from "./routes/auth.routes.js";
import { environment } from "./config/environment.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: (origin, callback) => callback(null, origin === environment.frontendUrl), credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/api/v1/health", (request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/v1/ready", (request, response) => {
  const ready = mongoose.connection.readyState === 1;
  response.status(ready ? 200 : 503).json({ status: ready ? "ready" : "unavailable" });
});
app.use("/api/v1/auth", authRouter);
app.use("/api/v1", learningRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;