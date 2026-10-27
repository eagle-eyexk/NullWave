import { Router, type IRouter } from "express";
import { GetSecurityStatusResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/security-status", (_req, res) => {
  const status = GetSecurityStatusResponse.parse({
    releaseStage: "preview",
    authentication: "clerk",
    messageEncryption: "not-enabled",
    postQuantum: "not-enabled",
    metadataProtection: "not-enabled",
    warning:
      "Early-access preview. Message content is stored in this application's database and is not end-to-end encrypted. Do not use this service for sensitive conversations.",
  });

  res.json(status);
});

export default router;
