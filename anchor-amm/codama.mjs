import { createFromRoot } from 'codama';
import { rootNodeFromAnchor } from '@codama/nodes-from-anchor';
import { renderVisitor } from '@codama/renderers-js';
import { existsSync, readFileSync } from 'node:fs';

const IDL_PATH = process.env.IDL_PATH ?? './target/idl/anchor_amm.json';
const SDK_DIR = process.env.SDK_DIR ?? './sdk';

if (!existsSync(IDL_PATH)) {
  console.error(`IDL not found at ${IDL_PATH}. Run \`anchor build\` first.`);
  process.exit(1);
}

const idl = JSON.parse(readFileSync(IDL_PATH, 'utf8'));
const codama = createFromRoot(rootNodeFromAnchor(idl));
codama.accept(
  renderVisitor(SDK_DIR, {
    syncPackageJson: false,
    deleteFolderBeforeRendering: true,
  }),
);

console.log(`SDK generated: ${IDL_PATH} -> ${SDK_DIR}/src/generated`);
