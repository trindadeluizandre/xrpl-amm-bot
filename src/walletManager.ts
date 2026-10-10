import { Wallet } from "xrpl";
import * as dotenv from "dotenv";

dotenv.config();

export function getProductionWallet(): Wallet {
  const seed = process.env.POSITION_WALLET_SEED?.trim();
  const address = process.env.POSITION_WALLET_ADDRESS?.trim();

  if (!seed || !seed.startsWith("s")) {
    throw new Error(
      "ERRO CRÍTICO DE SEGURANÇA: 'POSITION_WALLET_SEED' inválida no arquivo .env."
    );
  }

  // O SDK xrpl.js auto-detecta algoritmos secp256k1 e ed25519
  const wallet = Wallet.fromSeed(seed);

  if (address && wallet.classicAddress !== address) {
    throw new Error(
      `DIVERGÊNCIA DE ENDEREÇO: O endereço gerado (${wallet.classicAddress}) não coincide com (${address}).`
    );
  }

  return wallet;
}