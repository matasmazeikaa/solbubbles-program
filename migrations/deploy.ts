// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

const anchor = require("@project-serum/anchor");

module.exports = async function (provider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);
  // const program = anchor.workspace.GamePool as anchor.Program<GamePool>;

  // await program.methods.initialise().accounts({
  //   gamePoolAccount: gamePoolAccountPDA,
  //   authority: gamePoolAuthorityWallet.publicKey,
  // }).signers([gamePoolAuthorityWallet]).rpc();


  // Add your deploy script here.
}
