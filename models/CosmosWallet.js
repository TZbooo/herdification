const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');

class CosmosWallet {
    #wallet;

    constructor({ wallet }) {
        this.#wallet = wallet;
    }

    static async create({ mnemonic, addressPrefix }) {
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
            prefix: addressPrefix,
        });
        const instance = new CosmosWallet({
            wallet: wallet,
        });
        return instance;
    }

    get wallet() {
        return this.#wallet;
    }
}

module.exports = CosmosWallet;
