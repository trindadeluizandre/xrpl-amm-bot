import { Client, convertStringToHex } from "xrpl";
import * as dotenv from "dotenv";
import { getProductionWallet } from "./walletManager.js";

dotenv.config();

const XRPL_SERVER = process.env.XRPL_NODE_URL || "wss://xrplcluster.com";
const RLUSD_ISSUER = process.env.RLUSD_ISSUER_ADDRESS || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";

export async function checkMainnetStatus(): Promise<void> {
  const client = new Client(XRPL_SERVER);

  try {
    console.log(`\n[MAINNET] Conectando ao cluster de produção: ${XRPL_SERVER}...`);
    await client.connect();

    const wallet = getProductionWallet();
    console.log(`Carteira Operacional Carregada com Sucesso!`);
    console.log(`Endereço Público: ${wallet.classicAddress}`);

    const xrpBalanceDrops = await client.getXrpBalance(wallet.classicAddress);
    console.log(`Saldo de XRP Disponível : ${xrpBalanceDrops} XRP`);

    const linesResponse = await client.request({
      command: "account_lines",
      account: wallet.classicAddress
    });

    const hexCurrency = convertStringToHex("RLUSD").padEnd(40, "0").toUpperCase();

    // Busca a linha de confiança considerando o emissor do token
    const rlusdLine = linesResponse.result.lines.find(
      (line) => line.account === RLUSD_ISSUER || line.currency === "RLUSD" || line.currency.toUpperCase() === hexCurrency
    );

    if (rlusdLine) {
      console.log(`Saldo de RLUSD Disponível: ${rlusdLine.balance} RLUSD`);
      console.log(`Limite de Confiança     : ${rlusdLine.limit} RLUSD`);
      console.log(`Emissor Registrado      : ${rlusdLine.account}`);
    } else {
      console.log("ALERTA: Linha de Confiança para RLUSD ainda não localizada.");
    }

  } catch (error: any) {
    console.error("Erro na verificação da Mainnet:", error.message || error);
  } finally {
    await client.disconnect();
    console.log("Conexão com a Mainnet encerrada.\n");
  }
}