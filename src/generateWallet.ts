import { Wallet } from "xrpl";

const newWallet = Wallet.generate();

console.log("\n================ NOVA CARTEIRA OPERACIONAL (MAINNET) ================");
console.log(`POSITION_WALLET_ADDRESS=${newWallet.classicAddress}`);
console.log(`POSITION_WALLET_SEED=${newWallet.seed}`);
console.log("=====================================================================\n");