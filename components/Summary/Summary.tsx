import { BigNumber } from '@ethersproject/bignumber';
import { getNetwork } from '@ethersproject/networks';
import { formatUnits, parseUnits } from '@ethersproject/units';
import { useEffect, useState } from 'react';
import { useQuidContract } from '../../hooks/use-quid-contract';
import { useUsdtContract } from '../../hooks/use-usdt-contract';
import { useWallet } from '../../hooks/use-wallet';
import { numberWithCommas } from '../../utils/number-with-commas';
import veryShortedHash from '../../utils/very-shorted-hash';
import styles from './Summary.module.scss';

const SECONDS_IN_DAY = 86400;
const currentTimestamp = (Date.now() / 1000).toFixed(0);
const defaultNewtork = process.env.NEXT_PUBLIC_NETWOKR;
const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID;

const Summary: React.VFC = () => {
  const { chainId } = useWallet();
  const contract = useQuidContract();
  const usdtContract = useUsdtContract();
  const [smartContractStartTimestamp, setSmartContractStartTimestamp] =
    useState<string>('');
  const [mintPeriodDays, setMintPeriodDays] = useState<string>('');
  const [totalDeposited, setTotalDeposited] = useState<string>('');
  const [totalMinted, setTotalMinted] = useState<string>('');
  const [ownerDeposit, setOwnerDeposit] = useState<string>('0');
  const [price, setPrice] = useState<string>(' ');
  const networkName = chainId && getNetwork(parseInt(chainId, 16)).name;

  useEffect(() => {
    contract?.SALE_LENGTH().then((data: any) => {
      setMintPeriodDays(String(data.toNumber() / SECONDS_IN_DAY));
    });

    contract?.SALE_START().then((data: BigNumber) => {
      setSmartContractStartTimestamp(data.toString());
    });

    const updateInfo = () => {
      const qdAmount = parseUnits('1', 18);
      contract
        ?.qd_amt_to_usdt_amt(qdAmount, currentTimestamp)
        .then((data: BigNumber) => {
          let n = Number(formatUnits(data, 6)) * 100;
	  if (n > 100) {
	    n = 100
	  }
	  setPrice(String(n));
        });
      
      contract?.totalSupply().then((totalSupply: BigNumber) => {
        setTotalMinted(formatUnits(totalSupply, 18).split('.')[0]);
      });

      usdtContract
        ?.balanceOf(process.env.NEXT_PUBLIC_CONTRACT_ID)
        .then((data: BigNumber) => {
          setTotalDeposited(formatUnits(data, 6));
        });

      usdtContract
        ?.balanceOf(process.env.NEXT_PUBLIC_OWNER_ID)
        .then((data: BigNumber) => {
          setOwnerDeposit(formatUnits(data, 6));
        });
    };

    const timerId = setInterval(updateInfo, 5000);

    updateInfo();

    return () => clearInterval(timerId);
  }, [contract, usdtContract]);

  const daysLeft = smartContractStartTimestamp ? (
    Math.max(
      Math.ceil(
        Number(mintPeriodDays) -
          (Number(currentTimestamp) - Number(smartContractStartTimestamp)) /
            SECONDS_IN_DAY,
      ), 0
    )
  ) : (
    <>&nbsp;</>
  );

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <div className={styles.title}>Days left</div>
        <div className={styles.value}>{daysLeft}</div>
      </div>
      <div className={styles.section}>
        <div className={styles.title}>Current price</div>
        <div className={styles.value}>
          <span className={styles.value}>{Number(price).toFixed(0)}</span>
          <span className={styles.cents}> Cents</span>
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.title}>USDT Deposited</div>
        <div className={styles.value}>
          ${numberWithCommas(parseFloat(String(Number(totalDeposited) + Number(ownerDeposit))).toFixed())}
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.title}>Minted QD</div>
        <div className={styles.value}>{numberWithCommas(Number(totalMinted))}</div>
      </div>
      <div className={styles.section}>
        <div className={styles.title}>Address (QU!D LTD)</div>
        <div className={styles.valueSmall}>
          <a
            href={`https://${
              defaultNewtork === 'mainnet' ? '' : defaultNewtork + '.'
            }etherscan.io/address/${contractId}`}
            target="_blank"
            rel="noreferrer"
          >
            {contractId && veryShortedHash(contractId)}
          </a>
        </div>
      </div>
      {
        networkName && networkName !== 'homestead' ? (
          <div className={styles.section}>
            <div className={styles.title}>Network</div>
            <div className={styles.valueSmall}>
              {chainId && getNetwork(parseInt(chainId, 16)).name}
            </div>
          </div>
        ) : null
      }
    </div>
  );
};

export default Summary;
