import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { environment } from "./config/environment.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: environment.frontendUrl, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/api/v1/health", (request, response) => {
  response.json({ status: "ok" });
});

app.use(notFoundHandler);
app.use(errorHandler);
