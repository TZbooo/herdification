const axios = require('@axios');
const { coins, SigningStargateClient } = require('@cosmjs/stargate');

class CosmosGovernanceAccount {
    constructor({ lavaRestHttpEndpoint, lavaTendermintHttpEndpoint, baseDenomination, address, stargateClient, requiredVotingBalance }) {
        this.lavaRestHttpEndpoint = lavaRestHttpEndpoint;
        this.lavaTendermintHttpEndpoint = lavaTendermintHttpEndpoint;
        this.baseDenomination = baseDenomination;
        this.address = address;
        this.stargateClient = stargateClient;
        this.requiredVotingBalance = requiredVotingBalance;
    }

    static async create({ lavaRestHttpEndpoint, lavaTendermintHttpEndpoint, baseDenomination, requiredVotingBalance, wallet }) {
        const [account] = await wallet.getAccounts();
        const address = account.address;
        const stargateClient = await SigningStargateClient.connectWithSigner(lavaTendermintHttpEndpoint, wallet);
        const instance = new CosmosGovernanceAccount({
            lavaRestHttpEndpoint: lavaRestHttpEndpoint,
            lavaTendermintHttpEndpoint: lavaTendermintHttpEndpoint,
            baseDenomination: baseDenomination,
            address: address,
            stargateClient: stargateClient,
            requiredVotingBalance: requiredVotingBalance,
        });
        return instance;
    }

    async hasNoStakedBalance() {
        const url = `${this.lavaRestHttpEndpoint}/cosmos/staking/v1beta1/delegations/${this.address}`;
        const response = await axios.get(url);

        if (!response.data.delegation_responses.length) return true;

        const totalAmount = response.data.delegation_responses.reduce((sum, delegation) => {
            return sum + parseInt(delegation.balance.amount, 10);
        }, 0);
        if (totalAmount < this.requiredVotingBalance) {
            return true;
        }

        return false;
    }

    async getVotingPeriodProposals() {
        const url = `${this.lavaRestHttpEndpoint}/cosmos/gov/v1/proposals`;

        try {
            const response = await axios.get(url, {
                params: {
                    'pagination.reverse': true,
                },
            });

            const proposals = response.data.proposals || [];
            return proposals.filter((proposal) => proposal.status === 'PROPOSAL_STATUS_VOTING_PERIOD');
        } catch (error) {
            console.error('Error fetching proposals:');
            return [];
        }
    }

    async findDominantVote(proposalId) {
        const url = `${this.lavaRestHttpEndpoint}/cosmos/gov/v1beta1/proposals/${proposalId}/tally`;

        try {
            const response = await axios.get(url);

            const tally = response.data.tally || {};
            console.log(tally);
            const voteCounts = {
                1: parseInt(tally.yes || 0, 10),
                2: parseInt(tally.abstain || 0, 10),
                3: parseInt(tally.no || 0, 10),
                4: parseInt(tally.no_with_veto || 0, 10),
            };

            return Object.keys(voteCounts).reduce((a, b) => (voteCounts[a] > voteCounts[b] ? a : b));
        } catch (error) {
            console.error(`Error fetching tally for proposal ${proposalId}:`);
            return 'unknown';
        }
    }

    async voteOnProposal(proposalId, voteOption) {
        const msgVote = {
            typeUrl: '/cosmos.gov.v1beta1.MsgVote',
            value: {
                proposalId: proposalId.toString(),
                voter: this.address,
                option: voteOption,
            },
        };

        const fee = {
            amount: coins(2000, this.baseDenomination),
            gas: '200000',
        };

        const result = await this.stargateClient.signAndBroadcast(this.address, [msgVote], fee, 'Voting transaction');

        if (result.code !== 0) {
            throw new Error(`Transaction failed with code ${result.code}`);
        }

        console.log('Voting is done.');
    }

    async hasVoted(proposalId) {
        try {
            const url = `${this.lavaRestHttpEndpoint}/cosmos/gov/v1beta1/proposals/${proposalId}/votes/${this.address}`;
            const response = await axios.get(url);

            if (response.data && response.data.vote) {
                console.log('The vote has already been cast.');
                return true;
            }
        } catch (error) {
            return false;
        }
    }

    async startAutoVoteProposals() {
        if (await this.hasNoStakedBalance()) {
            console.log('No staked balance.');
            return;
        }

        const proposals = await this.getVotingPeriodProposals();
        if (proposals.length === 0) {
            console.log('No proposals in voting period.');
            return;
        }
        for (const proposal of proposals) {
            const dominantVote = await this.findDominantVote(proposal.id);
            console.log(`Proposal ${proposal.id} dominant vote: ${dominantVote}`);
            if (await this.hasVoted(proposal.id)) {
                continue;
            }
            await this.voteOnProposal(proposal.id, dominantVote);
        }
    }
}

module.exports = CosmosGovernanceAccount;
