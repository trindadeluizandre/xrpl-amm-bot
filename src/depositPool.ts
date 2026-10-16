import { Client, Wallet, convertStringToHex, type AMMDeposit, AMMDepositFlags } from "xrpl";

export async function depositToAMMPool(
  client: Client,
  wallet: Wallet,
  rlusdIssuer: string,
  xrpAmountInDrops: string = "10000000", // 10 XRP (Valor genérico para testes)
  rlusdAmountValue: string = "50",       // 50 RLUSD (Valor genérico para testes)
  rlusdCurrencyCode: string = "RLUSD"
): Promise<string | null> {
  try {
    const formattedCurrency = rlusdCurrencyCode.length === 3 
      ? rlusdCurrencyCode 
      : convertStringToHex(rlusdCurrencyCode).padEnd(40, "0").toUpperCase();

    const ammDepositTx: AMMDeposit = {
      TransactionType: "AMMDeposit",
      Account: wallet.classicAddress,
      Asset: {
        currency: "XRP"
      },
      Asset2: {
        currency: formattedCurrency,
        issuer: rlusdIssuer
      },
      Amount: xrpAmountInDrops,
      Amount2: {
        currency: formattedCurrency,
        issuer: rlusdIssuer,
        value: rlusdAmountValue
      },
      Flags: AMMDepositFlags.tfTwoAsset
    };

    const prepared = await client.autofill(ammDepositTx);
    // Janela de proteção contra desconectividade aumentando a validade da transação
    prepared.LastLedgerSequence = (prepared.LastLedgerSequence ?? 0) + 50;

    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta;
    if (typeof meta === "object" && meta?.TransactionResult === "tesSUCCESS") {
      return result.result.hash;
    } else {
      console.error("Resultado do AMMDeposit:", meta);
      return null;
    }

  } catch (error) {
    console.error("Erro ao executar AMMDeposit:", error);
    return null;
  }
}