import { Client, Wallet, convertStringToHex, type Payment } from "xrpl";

export async function executeSwap(
  client: Client,
  traderWallet: Wallet,
  rlusdIssuer: string,
  xrpAmountToSpendInDrops: string = "5000000", // Trader gasta 5 XRP (Simulação genérica)
  rlusdCurrencyCode: string = "RLUSD"
): Promise<string | null> {
  try {
    const formattedCurrency = rlusdCurrencyCode.length === 3 
      ? rlusdCurrencyCode 
      : convertStringToHex(rlusdCurrencyCode).padEnd(40, "0").toUpperCase();

    const swapTx: Payment = {
      TransactionType: "Payment",
      Account: traderWallet.classicAddress,
      Destination: traderWallet.classicAddress,
      Amount: {
        currency: formattedCurrency,
        issuer: rlusdIssuer,
        value: "1" // Solicita o recebimento do token RLUSD
      },
      SendMax: xrpAmountToSpendInDrops // Limite de gasto em XRP
    };

    const prepared = await client.autofill(swapTx);
    // Extensão da validade da ordem contra latência de rede
    prepared.LastLedgerSequence = (prepared.LastLedgerSequence ?? 0) + 50;

    const signed = traderWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta;
    if (typeof meta === "object" && meta?.TransactionResult === "tesSUCCESS") {
      return result.result.hash;
    } else {
      console.error("Resultado do Swap:", meta);
      return null;
    }

  } catch (error) {
    console.error("Erro ao executar Swap no AMM:", error);
    return null;
  }
}