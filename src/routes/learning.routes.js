import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { resourceController, dashboard } from "../controllers/learning.controller.js";

const router = Router();

for (const kind of ["logs", "goals"]) {
  const controller = resourceController(kind);
  router.route("/" + kind).all(authenticate).get(controller.list).post(controller.create);
  router.route("/" + kind + "/:id").all(authenticate).get(controller.get).patch(controller.update).delete(controller.remove);
}
router.get("/dashboard", authenticate, dashboard);
export default router;
