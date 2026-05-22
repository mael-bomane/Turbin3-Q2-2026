#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROGRAM_ID="7f96rDy6EdQzb5PbNbgWeYFfSnioRjFekrk2iah6ufzL"
WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
PROGRAM_KEYPAIR="target/deploy/anchor_amm-keypair.json"
MIN_SOL="2.0"

cyan() { printf "\033[36m%s\033[0m\n" "$1"; }
red()  { printf "\033[31m%s\033[0m\n" "$1" >&2; }
ok()   { printf "\033[32m%s\033[0m\n" "$1"; }

[ -f "$WALLET" ] || { red "wallet not found: $WALLET"; exit 1; }
[ -f "$PROGRAM_KEYPAIR" ] || { red "program keypair missing — run 'anchor build' first"; exit 1; }

cyan "==> using wallet: $WALLET"
solana config set --url devnet --keypair "$WALLET" >/dev/null

PAYER_ADDR=$(solana address)
cyan "==> deployer: $PAYER_ADDR"

ON_CHAIN_ID=$(solana address -k "$PROGRAM_KEYPAIR")
if [ "$ON_CHAIN_ID" != "$PROGRAM_ID" ]; then
  red "program-keypair address ($ON_CHAIN_ID) != declare_id! ($PROGRAM_ID)"
  red "rebuild with 'anchor build' or update declare_id!"
  exit 1
fi

BALANCE=$(solana balance --output json | grep -oE '[0-9.]+' | head -1)
cyan "==> devnet balance: ${BALANCE} SOL"

if awk "BEGIN { exit !($BALANCE < $MIN_SOL) }"; then
  cyan "==> requesting airdrop (devnet)…"
  solana airdrop 2 "$PAYER_ADDR" --url devnet || red "airdrop failed — try https://faucet.solana.com"
  BALANCE=$(solana balance --output json | grep -oE '[0-9.]+' | head -1)
  cyan "==> balance: ${BALANCE} SOL"
fi

cyan "==> anchor build"
anchor build

cyan "==> anchor deploy --provider.cluster devnet"
anchor deploy --provider.cluster devnet

cyan "==> idl init / upgrade (devnet)"
if anchor idl fetch "$PROGRAM_ID" --provider.cluster devnet >/dev/null 2>&1; then
  anchor idl upgrade --filepath target/idl/anchor_amm.json "$PROGRAM_ID" --provider.cluster devnet
else
  anchor idl init --filepath target/idl/anchor_amm.json "$PROGRAM_ID" --provider.cluster devnet
fi

cyan "==> regenerating SDK from updated IDL"
pnpm run sdk:gen

ok "==> deployed to devnet: $PROGRAM_ID"
ok "==> explorer: https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet"
