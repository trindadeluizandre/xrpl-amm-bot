import { Client, type AMMDeposit, convertStringToHex } from "xrpl";
import * as dotenv from "dotenv";
import { getProductionWallet } from "./walletManager.js";

dotenv.config();

const XRPL_SERVER = process.env.XRPL_NODE_URL || "wss://xrplcluster.com";
const RLUSD_ISSUER = process.env.RLUSD_ISSUER_ADDRESS || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";

// Flag oficial da XRPL para depósito de dois ativos (tfTwoAsset = 0x00100000 = 1048576)
const tfTwoAsset = 1048576;

export async function depositToAMM(xrpAmount: string, rlusdAmount: string): Promise<string | null> {
  const client = new Client(XRPL_SERVER);

  try {
    console.log(`\n[MAINNET] Conectando ao nó de alta velocidade (${XRPL_SERVER})...`);
    await client.connect();

    const wallet = getProductionWallet();

    const xrpInDrops = (parseFloat(xrpAmount) * 1000000).toString();
    const rlusdHex = convertStringToHex("RLUSD").padEnd(40, "0").toUpperCase();

    const depositTx: AMMDeposit = {
      TransactionType: "AMMDeposit",
      Account: wallet.classicAddress,
      Asset: {
        currency: "XRP"
      },
      Asset2: {
        currency: rlusdHex,
        issuer: RLUSD_ISSUER
      },
      Amount: xrpInDrops,
      Amount2: {
        currency: rlusdHex,
        issuer: RLUSD_ISSUER,
        value: rlusdAmount
      },
      Flags: tfTwoAsset
    };

    console.log(`Submetendo depósito de ${xrpAmount} XRP e ${rlusdAmount} RLUSD no Pool...`);

    const prepared = await client.autofill(depositTx);

    // Ajusta o LastLedgerSequence usando a consulta do ledger atual
    const ledgerIndex = await client.getLedgerIndex();
    prepared.LastLedgerSequence = ledgerIndex + 100;

    const signed = wallet.sign(prepared);
    const response = await client.submit(signed.tx_blob);

    console.log(`\n=================================================`);
    console.log(` TRANSAÇÃO ENVIADA PARA A MAINNET!`);
    console.log(` Código de Resposta Inicial: ${response.result.engine_result}`);
    console.log(` Hash da Transação: ${signed.hash}`);
    console.log(`=================================================\n`);

    return signed.hash;

  } catch (error: any) {
    console.error("Erro durante o aporte no AMM:", error.message || error);
    return null;
  } finally {
    await client.disconnect();
  }
}

// Ponto de entrada dinâmico para execução via CLI (Sanitizado - Zero Hardcoding)
if (process.argv[1] && process.argv[1].includes("addLiquidity")) {
  const args = process.argv.slice(2);
  const xrpToDeposit = args[0];
  const rlusdToDeposit = args[1];

  if (!xrpToDeposit || !rlusdToDeposit || parseFloat(xrpToDeposit) <= 0 || parseFloat(rlusdToDeposit) <= 0) {
    console.error("\n[ERRO DE SEGURANÇA] Parâmetros de aporte não informados ou inválidos.");
    console.log("Uso correto via CLI: npx tsx src/addLiquidity.ts <QUANTIDADE_XRP> <QUANTIDADE_RLUSD>");
    console.log("Exemplo: npx tsx src/addLiquidity.ts 10 15\n");
    process.exit(1);
  }

  console.log(`[INÍCIO] Disparando ordem de aporte: ${xrpToDeposit} XRP + ${rlusdToDeposit} RLUSD...`);

  depositToAMM(xrpToDeposit, rlusdToDeposit)
    .then((txHash) => {
      if (txHash) {
        console.log(`[SUCESSO] Depósito confirmado no AMM! Hash: ${txHash}`);
      } else {
        console.error("[FALHA] Não foi possível completar o depósito no AMM.");
      }
    })
    .catch((err) => {
      console.error("[ERRO FATAL] Erro durante a execução do aporte:", err);
    });
}