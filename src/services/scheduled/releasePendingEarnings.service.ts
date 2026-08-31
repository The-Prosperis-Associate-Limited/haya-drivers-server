import { WalletService } from "../earnings/wallet.service";

const walletService = new WalletService();

// Moves earnings past their hold into the withdrawable balance.
export const releasePendingEarnings = async () => {
  const released = await walletService.releaseDuePending();

  return `${released} transaction(s) released`;
};
