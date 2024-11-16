const { MNEMONIC_LIST, CHAIN_CREDENTIALS_LIST } = require('./config');
const CosmosWallet = require('./models/CosmosWallet');
const CosmosGovernanceAccount = require('./models/CosmosGovernanceAccount');

async function main() {
    for (chainCredentials of CHAIN_CREDENTIALS_LIST) {
        const lavaRestHttpEndpoint = chainCredentials['LAVA_REST_HTTP_ENDPOINT'];
        const lavaTendermintHttpEndpoint = chainCredentials['LAVA_TENDERMINT_HTTP_ENDPOINT'];
        const baseDenomination = chainCredentials['BASE_DENOMINATION'];
        const addressPrefix = chainCredentials['ADDRESS_PREFIX'];

        for (const mnemonic of MNEMONIC_LIST) {
            const cosmosWallet = await CosmosWallet.create({
                mnemonic: mnemonic,
                addressPrefix: addressPrefix,
            });

            const cosmosGovernanceAccount = await CosmosGovernanceAccount.create({
                lavaRestHttpEndpoint: lavaRestHttpEndpoint,
                lavaTendermintHttpEndpoint: lavaTendermintHttpEndpoint,
                baseDenomination: baseDenomination,
                wallet: cosmosWallet.wallet,
            });
            await cosmosGovernanceAccount.startAutoVoteProposals();
        }

        break;
    }
}

main();
