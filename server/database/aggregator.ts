import { defaultProvider } from '../../lib/contracts';
import { Interface } from '@ethersproject/abi';
import contractJson from '../../lib/contracts/QD.json';
import { BigNumber } from '@ethersproject/bignumber';
import { EventData } from '../../lib/contracts/types';
import { formatUnits } from '@ethersproject/units';
import { Transaction } from '../../types';
import { databaseClient } from './client';

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ID || '';

export const handleMint = async (
  address: string,
  costInUsd: BigNumber,
  qdAmount: BigNumber,
  { blockHash, transactionHash }: EventData,
) => {
  console.log(`[MintHandler - ${transactionHash}]: Start processing event`);

  try {
    const block = await defaultProvider.getBlock(blockHash);
    const transactionData: Transaction = {
      contractAddress,
      transactionHash,
      address,
      costInUsd: formatUnits(costInUsd, 6),
      qdAmount: formatUnits(qdAmount, 18),
      timestamp: block.timestamp.toString(),
    };

    console.log(
      `[MintHandler - ${transactionHash}]: ${JSON.stringify(transactionData)}`,
    );

    const result = await databaseClient.save(
      `transactions:${transactionHash}`,
      transactionData,
    );

    console.log(`[MintHandler - ${transactionHash}]: Save transaction hash`);

    await databaseClient.set('lastTransactionHash', transactionHash);
    await databaseClient.set('lastBlockHash', blockHash);

    console.log(
      `[MintHandler - ${transactionHash}]: Event successfuly savated to database`,
      result,
    );
  } catch (err) {
    console.error(err);
  }
};

export const runAggregation = async () => {
  console.log('[Aggregator]: Start Aggregation');

  const abiInterface = new Interface(contractJson.abi);
  const fromBlock = await databaseClient.get('lastBlockHash');

  const logs = await defaultProvider.getLogs({
    fromBlock: fromBlock || '0x0',
    address: contractAddress,
  });

  console.log(`[Aggregator]: Count logs(${logs.length})`);

  await Promise.all(
    logs.map(async (item, index) => {
      try {
        const result = abiInterface.decodeEventLog('Mint', item.data);
        const tx = await defaultProvider.getTransaction(item.transactionHash);

        await handleMint(tx.from, result.cost_in_usd, result.qd_amt, item);
      } catch (err) {
        console.error(`[Aggregator]: Error: ${(err as Error).message}`);
        return null;
      }
    }),
  );
};

setInterval(runAggregation, 15000);
