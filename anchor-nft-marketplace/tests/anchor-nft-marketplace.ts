import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorNftMarketplace } from "../target/types/anchor_nft_marketplace";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  fetchAsset,
  mplCore,
  MPL_CORE_PROGRAM_ID,
} from "@metaplex-foundation/mpl-core";

describe("anchor-nft-marketplace", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .anchorNftMarketplace as Program<AnchorNftMarketplace>;
  const name: string = "ablaze";

  const fee: number = 500;
  const price = new anchor.BN(1 * 10e9);

  const admin = provider.wallet.publicKey;

  const maker = Keypair.generate();
  const taker = Keypair.generate();

  const marketplace = PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace"), Buffer.from(name)],
    program.programId,
  )[0];

  const rewardsMint = PublicKey.findProgramAddressSync(
    [Buffer.from("rewards"), marketplace.toBuffer()],
    program.programId,
  )[0];

  const umi = createUmi(provider.connection.rpcEndpoint).use(mplCore());

  // Generate a keypair for the collection
  const collectionKeypair = Keypair.generate();

  // Find the update authority for the collection (PDA)
  const updateAuthority = PublicKey.findProgramAddressSync(
    [Buffer.from("update_authority"), collectionKeypair.publicKey.toBuffer()],
    program.programId,
  )[0];

  // Generate a keypair for the nft asset
  const nftKeypair = Keypair.generate();

  it("Initialize", async () => {
    const tx = await program.methods
      .initialize(name, fee)
      .accountsPartial({
        admin,
        marketplace,
        rewardsMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log("Your transaction signature", tx);
  });

  it("List an NFT", async () => {
    const tx = await program.methods
      .list(price)
      .accountsPartial({
        maker: maker.publicKey,
        asset: nftKeypair.publicKey,
        collection: collectionKeypair.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
      })
      .rpc();
    console.log("Your transaction signature", tx);
  });

  it("Delist an NFT", async () => {
    const tx = await program.methods
      .initialize(name, fee)
      .accountsPartial({
        admin,
        marketplace,
        rewardsMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log("Your transaction signature", tx);
  });
});
