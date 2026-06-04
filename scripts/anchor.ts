import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const keypairPath = path.join(process.cwd(), ".local", "solana-devnet-keypair.json");

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: npm run anchor -- results/<result>.json");
  process.exit(2);
}

const result = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
const manifestHash = result?.manifest?.manifestHash;
const resultHash = result?.resultHash;
const datasetHash = result?.dataset?.hash;
if (!manifestHash || !resultHash || !datasetHash) {
  console.error("Result JSON must include manifest.manifestHash, resultHash, and dataset.hash");
  process.exit(2);
}

const memoRecord = {
  schema: "privacy-xai-solana-memo/v1",
  manifestHash,
  resultHash,
  datasetHash,
  dataset: result.dataset.id,
  method: result.manifest.method,
  createdAt: new Date().toISOString()
};
const memo = `PXAI:${JSON.stringify(memoRecord)}`;
const memoHash = sha256(memo);

const connection = new Connection(RPC_URL, "confirmed");
const payer = loadOrCreatePayer();
await ensureFunds(connection, payer);

const transaction = new Transaction().add(
  new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
    data: Buffer.from(memo, "utf-8")
  })
);

const signature = await sendAndConfirmTransaction(connection, transaction, [payer], {
  commitment: "confirmed",
  skipPreflight: false
});

console.log(
  JSON.stringify(
    {
      ok: true,
      network: "devnet",
      rpcUrl: RPC_URL,
      payer: payer.publicKey.toBase58(),
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      memoHash,
      memoRecord
    },
    null,
    2
  )
);

function loadOrCreatePayer(): Keypair {
  fs.mkdirSync(path.dirname(keypairPath), { recursive: true });
  if (fs.existsSync(keypairPath)) {
    return Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")) as number[])
    );
  }
  const payer = Keypair.generate();
  fs.writeFileSync(keypairPath, JSON.stringify([...payer.secretKey]), { mode: 0o600 });
  return payer;
}

async function ensureFunds(connection: Connection, payer: Keypair): Promise<void> {
  const balance = await connection.getBalance(payer.publicKey, "confirmed");
  if (balance > 0.01 * LAMPORTS_PER_SOL) return;
  const sig = await connection.requestAirdrop(payer.publicKey, 0.05 * LAMPORTS_PER_SOL);
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

