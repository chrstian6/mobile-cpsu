import { Request, Response, Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  const htmlPath = path.join(__dirname, "../../faceapi-webview.html");

  if (!fs.existsSync(htmlPath)) {
    res.status(404).send("faceapi-webview.html not found");
    return;
  }

  res.setHeader("Content-Type", "text/html");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.sendFile(path.resolve(htmlPath));
});

export default router;
