import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
// IDL
import { AnchorNftStaking } from "../target/types/anchor_nft_staking";
// web3.js
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
// spl
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
// metaplex
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";
import {
  fetchAsset,
  mplCore,
  MPL_CORE_PROGRAM_ID,
} from "@metaplex-foundation/mpl-core";
// testing
import { expect } from "chai";

const REWARDS_BPS = 10000;
const FREEZE_PERIOD_IN_DAYS = 7;
const TIME_TRAVEL_IN_DAYS = 8;

describe("anchor-nft-staking", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .anchorNftStaking as Program<AnchorNftStaking>;

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

  // Find the config pda
  const config = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), collectionKeypair.publicKey.toBuffer()],
    program.programId,
  )[0];

  // Find the rewards mint (PDA)
  const rewardsMint = PublicKey.findProgramAddressSync(
    [Buffer.from("rewards_mint"), config.toBuffer()],
    program.programId,
  )[0];

  // Surfpool time travel is ABSOLUTE and the chain clock persists across test
  // runs on a long-running surfpool instance, so we jump relative to the
  // CURRENT slot (not Date.now()) — otherwise the target can land in the past
  // and surfnet rejects it with "Cannot travel to past timestamp".
  //
  // We jump by SLOT rather than absoluteTimestamp: the on-chain Clock's
  // unix_timestamp is derived from slot progression at ~400ms/slot, and
  // surfnet's absoluteTimestamp lands inexactly (it converts the timestamp to a
  // slot against an internal wall clock that runs ahead of block time, so an
  // 8-day request only advanced block time ~5 days). Advancing slots directly
  // moves the on-chain clock by a precise, predictable amount.
  const SLOTS_PER_DAY = 86400 / 0.4; // 400ms per slot -> 216000 slots/day

  // Helper function to advance the on-chain clock forward by `days` with Surfpool.
  async function advanceDays(days: number): Promise<void> {
    const currentSlot = await provider.connection.getSlot();
    const absoluteSlot = currentSlot + days * SLOTS_PER_DAY;

    const rpcResponse = await fetch(provider.connection.rpcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "surfnet_timeTravel",
        params: [{ absoluteSlot }],
      }),
    });

    const result = (await rpcResponse.json()) as { error?: any; result?: any };
    if (result.error) {
      throw new Error(`Time travel failed: ${JSON.stringify(result.error)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  it("Create a collection !", async () => {
    const collectionName = "Trib3 Q2'26";
    const collectionUri = "https://example.com/collection";
    const tx = await program.methods
      .createCollection(collectionName, collectionUri)
      .accountsPartial({
        payer: provider.wallet.publicKey,
        collection: collectionKeypair.publicKey,
        updateAuthority,
        systemProgram: SystemProgram.programId,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
      })
      .signers([collectionKeypair])
      .rpc();

    console.log(`\nYour transaction signature : `, tx);
    console.log(
      `\nCollection address : `,
      collectionKeypair.publicKey.toBase58(),
    );
  });

  it("Mint an NFT", async () => {
    const nftName = "Test NFT";
    const nftUri = "https://example.com/nft";
    const tx = await program.methods
      .mintAsset(nftName, nftUri)
      .accountsPartial({
        user: provider.wallet.publicKey,
        asset: nftKeypair.publicKey,
        collection: collectionKeypair.publicKey,
        updateAuthority,
        systemProgram: SystemProgram.programId,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
      })
      .signers([nftKeypair])
      .rpc();

    console.log(`\nYour transaction signature : `, tx);
    console.log(`\NFT address : `, nftKeypair.publicKey.toBase58());
  });

  it("Initialize Config", async () => {
    const tx = await program.methods
      .initialize(REWARDS_BPS, FREEZE_PERIOD_IN_DAYS)
      .accountsPartial({
        admin: provider.wallet.publicKey,
        collection: collectionKeypair.publicKey,
        updateAuthority,
        config,
        rewardsMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log(`\nYour transaction signature : `, tx);
    console.log(`Config address : `, config.toBase58());
    console.log(`Rewards BPS : `, REWARDS_BPS);
    console.log(`Freeze period in days : `, FREEZE_PERIOD_IN_DAYS);
    console.log(`Rewards mint address : `, rewardsMint.toBase58());
  });

  it("Stake an NFT", async () => {
    const tx = await program.methods
      .stake()
      .accountsPartial({
        owner: provider.wallet.publicKey,
        updateAuthority,
        config,
        asset: nftKeypair.publicKey,
        collection: collectionKeypair.publicKey,
        systemProgram: SystemProgram.programId,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
      })
      .rpc();
    console.log(`\nYour transaction signature : `, tx);
    const asset = await fetchAsset(
      umi,
      publicKey(nftKeypair.publicKey.toBase58()),
    );
    expect(asset.freezeDelegate).to.exist;
    console.log("FreezeDelegate Found !");
    expect(asset.freezeDelegate?.frozen).to.equal(true);
    console.log("Asset Frozen : ", asset.freezeDelegate?.frozen);
  });

  it("Try to unstake an NFT before the freeze period ends", async () => {
    const userRewardsAta = getAssociatedTokenAddressSync(
      rewardsMint,
      provider.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    try {
      const tx = await program.methods
        .unstake()
        .accountsPartial({
          owner: provider.wallet.publicKey,
          updateAuthority,
          config,
          rewardsMint,
          userRewardsAta,
          asset: nftKeypair.publicKey,
          collection: collectionKeypair.publicKey,
          mplCoreProgram: MPL_CORE_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      throw new Error(
        `Unstake should have failed before the freeze period elapsed, but succeeded with tx : ${tx}`,
      );
    } catch (err) {
      if (
        err instanceof anchor.AnchorError &&
        err.error.errorCode.code === "FreezePeriodNotElapsed"
      ) {
        console.log("\nUnstake failed as expected : ", err.error.errorMessage);
      } else {
        throw err;
      }
    }
  });

  it("Try to claim rewards before the freeze period ends", async () => {
    const userRewardsAta = getAssociatedTokenAddressSync(
      rewardsMint,
      provider.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    try {
      const tx = await program.methods
        .claimRewards()
        .accountsPartial({
          owner: provider.wallet.publicKey,
          updateAuthority,
          config,
          rewardsMint,
          userRewardsAta,
          asset: nftKeypair.publicKey,
          collection: collectionKeypair.publicKey,
          mplCoreProgram: MPL_CORE_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();
      throw new Error(
        `Claiming should have failed before the freeze period elapsed, but succeeded with tx : ${tx}`,
      );
    } catch (err) {
      if (
        err instanceof anchor.AnchorError &&
        err.error.errorCode.code === "FreezePeriodNotElapsed"
      ) {
        console.log("\nClaiming failed as expected : ", err.error.errorMessage);
      } else {
        throw err;
      }
    }
  });

  it("Time travel 8 days to the future", async () => {
    await advanceDays(TIME_TRAVEL_IN_DAYS);
    console.log("\nTime traveled in days ", TIME_TRAVEL_IN_DAYS);
  });

  it("Claim Rewards /wo Unstaking", async () => {
    // Get the user rewards ATA account
    const userRewardsAta = getAssociatedTokenAddressSync(
      rewardsMint,
      provider.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const tx = await program.methods
      .claimRewards()
      .accountsPartial({
        owner: provider.wallet.publicKey,
        updateAuthority,
        config,
        rewardsMint,
        userRewardsAta,
        asset: nftKeypair.publicKey,
        collection: collectionKeypair.publicKey,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log(`\nYour transaction signature : `, tx);
    console.log(
      "User rewards balance : ",
      (await provider.connection.getTokenAccountBalance(userRewardsAta)).value
        .uiAmount,
    );
  });

  it("Time travel 8 days to the future", async () => {
    await advanceDays(TIME_TRAVEL_IN_DAYS);
    console.log("\nTime traveled in days ", TIME_TRAVEL_IN_DAYS);
  });

  it("Unstake an NFT", async () => {
    // Get the user rewards ATA account
    const userRewardsAta = getAssociatedTokenAddressSync(
      rewardsMint,
      provider.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const tx = await program.methods
      .unstake()
      .accountsPartial({
        owner: provider.wallet.publicKey,
        updateAuthority,
        config,
        rewardsMint,
        userRewardsAta,
        asset: nftKeypair.publicKey,
        collection: collectionKeypair.publicKey,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log(`\nYour transaction signature : `, tx);
    console.log(
      "User rewards balance : ",
      (await provider.connection.getTokenAccountBalance(userRewardsAta)).value
        .uiAmount,
    );
  });

  it("Stake an NFT", async () => {
    const tx = await program.methods
      .stake()
      .accountsPartial({
        owner: provider.wallet.publicKey,
        updateAuthority,
        config,
        asset: nftKeypair.publicKey,
        collection: collectionKeypair.publicKey,
        systemProgram: SystemProgram.programId,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
      })
      .rpc();
    console.log(`\nYour transaction signature : `, tx);
    const asset = await fetchAsset(
      umi,
      publicKey(nftKeypair.publicKey.toBase58()),
    );
    expect(asset.freezeDelegate).to.exist;
    console.log("FreezeDelegate Found !");
    expect(asset.freezeDelegate?.frozen).to.equal(true);
    console.log("Asset Frozen : ", asset.freezeDelegate?.frozen);
  });
});
