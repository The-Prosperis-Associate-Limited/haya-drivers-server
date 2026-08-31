import { Router, Request, Response } from "express";
import { handleErrors } from "../helper/handleErrors";
import { UnauthorizedError } from "../helper/errors";
import { IUserRequest } from "../interface";
import { PayoutService } from "../services/earnings/payout.service";
import { resolveProviderByName } from "../services/payments/provider.registry";

const webhookRouter = Router();
const payoutService = new PayoutService();

/*
  Paystack signs the raw body, so this route reads req.rawBody rather than the
  parsed object — re-serialising the parsed JSON produces a different string and
  the signature never matches.
*/
webhookRouter.post("/paystack", async (req: IUserRequest, res: Response) => {
  try {
    const provider = resolveProviderByName("PAYSTACK");
    const signature = req.headers["x-paystack-signature"] as string;

    if (!signature || !provider.verifyWebhookSignature(req.rawBody ?? "", signature)) {
      throw new UnauthorizedError("Invalid webhook signature");
    }

    const { event, data } = req.body as { event: string; data: { reference: string; reason?: string; message?: string } };

    if (event === "transfer.success") await payoutService.settle(data.reference, "PAID");
    if (event === "transfer.failed" || event === "transfer.reversed") {
      await payoutService.settle(data.reference, "FAILED", data.reason ?? data.message);
    }

    // Always 200 on a verified webhook, even for an event we ignore — a non-200
    // makes Paystack retry an event that will never be handled.
    res.status(200).json({ received: true });
  } catch (error) {
    handleErrors({ res, error });
  }
});

export { webhookRouter };
