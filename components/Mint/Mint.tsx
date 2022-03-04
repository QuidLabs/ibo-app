import {
  ChangeEvent,
  FormEvent,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import cn from 'classnames';
import { BigNumber } from '@ethersproject/bignumber';
import { formatUnits, parseUnits } from '@ethersproject/units';
import { useQuidContract } from '../../hooks/use-quid-contract';
import { useWallet } from '../../hooks/use-wallet';
import { NotificationContext } from '../Notification/NotificationProvider';
import { Icon } from '../Lib/Icon';
import { useUsdtContract } from '../../hooks/use-usdt-contract';
import { useDebounce } from '../../hooks/use-debounce';
import { numberWithCommas } from '../../utils/number-with-commas';

import styles from './Mint.module.scss';
import { waitTransaction } from '../../lib/contracts';
import _ from 'lodash';

const DELAY = 60 * 60 * 8; // some buffer for allowance

const Mint: React.VFC = () => {
  const [mintValue, setMintValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { notify } = useContext(NotificationContext);
  const quidContract = useQuidContract();
  const usdtContract = useUsdtContract();
  const { selectedAccount } = useWallet();
  const [usdtValue, setUsdtValue] = useState(0);
  const [totalSupplyCap, setTotalSupplyCap] = useState(0);
  const [totalSupply, setTotalSupply] = useState('');
  const [state, setState] = useState<'none' | 'approving' | 'minting'>('none');

  const qdAmountToUsdtAmt = async (
    qdAmount: string | BigNumber,
    delay: number = 0,
  ): Promise<BigNumber> => {
    const currentTimestamp = (Date.now() / 1000 + delay).toFixed(0);
    return await quidContract?.qd_amt_to_usdt_amt(
      qdAmount instanceof BigNumber
        ? qdAmount
        : parseUnits(qdAmount.split('.')[0], 24),
      currentTimestamp,
    );
  };
  
  // console.log({ mintValue, usdtValue, totalSupplyCap, totalSupply });

  useDebounce(
    mintValue,
    async () => {
      if (parseInt(mintValue) > 0) {
        const usdt = await qdAmountToUsdtAmt(mintValue, 24);
        setUsdtValue(parseFloat(formatUnits(usdt, 6)));
      } else {
        setUsdtValue(0);
      }
    },
    500,
  );

  useEffect(() => {
    const updateTotalSupply = () => {
      Promise.all([
        quidContract.get_total_supply_cap(),
        quidContract.totalSupply(),
      ]).then(([totalSupplyCap, totalSupply]) => {
        const totalSupplyCapInt = parseInt(formatUnits(totalSupplyCap, 24));

        setTotalSupply(parseInt(formatUnits(totalSupply, 24)).toString());
        setTotalSupplyCap(totalSupplyCapInt);
      });
    };

    if (quidContract) {
      updateTotalSupply();
    }

    const timerId = setInterval(updateTotalSupply, 5000);

    return () => clearInterval(timerId);
  }, [quidContract, selectedAccount]);

  const handleChangeValue = (e: ChangeEvent<HTMLInputElement>) => {
    const regex = /^\d*(\.\d*)?$|^$/;
    let originalValue = e.target.value;

    if (
      originalValue.length > 1 &&
      originalValue[0] === '0' &&
      originalValue[1] !== '.'
    ) {
      originalValue = originalValue.substring(1);
    }

    if (originalValue[0] === '.') {
      originalValue = '0' + originalValue;
    }

    if (regex.test(originalValue)) {
      setMintValue(originalValue);
    }
  };

  const handleSetMaxValue = async () => {
    if (!selectedAccount) {
      notify({
        message: 'Please connect your wallet',
        severity: 'error',
      });

      return;
    }

    const costOfOneQd = Number(formatUnits(await qdAmountToUsdtAmt('1'), 6));
    const balance = Number(formatUnits(await usdtContract.balanceOf(selectedAccount), 6));
    const newValue = Number(totalSupplyCap) < balance ? totalSupplyCap : (balance / costOfOneQd);
    // console.log({ costOfOneQd, balance, newValue, totalSupplyCap });c
    
    setMintValue(
      `${newValue}`,
    );

    if (inputRef) {
      inputRef.current?.focus();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedAccount) {
      notify({
        severity: 'error',
        message: 'Please connect your wallet',
      });
      return;
    }

    if (!mintValue.length) {
      notify({
        severity: 'error',
        message: 'Please enter amount',
      });
      return;
    }

    if (+mintValue <= 100) {
      notify({
        severity: 'error',
        message: 'The amount should be more than 100',
      });
      return;
    }

    try {
      const qdAmount = parseUnits(mintValue, 24);
      const usdtAmount = await qdAmountToUsdtAmt(qdAmount, DELAY);

      const allowanceBigNumber: BigNumber = await usdtContract.allowance(
        selectedAccount,
        quidContract.address,
      );

      console.log(
        'Start minting:',
        '\nCurrent allowance: ',
        formatUnits(allowanceBigNumber, 6),
        '\nUsdt amount: ',
        formatUnits(usdtAmount, 6),
      );

      if (parseInt(formatUnits(allowanceBigNumber, 6)) !== 0) {
        setState('approving');

        const { hash } = await usdtContract?.decreaseAllowance(
          quidContract?.address,
          allowanceBigNumber,
        );

        await waitTransaction(hash);
      }

      setState('approving');

      const { hash } = await usdtContract?.approve(
        quidContract?.address,
        usdtAmount,
      );

      notify({
        severity: 'success',
        message: 'Please wait for approving',
        autoHideDuration: 4500,
      });

      await waitTransaction(hash);

      setState('minting');

      notify({
        severity: 'success',
        message: 'Please check your wallet',
      });

      const allowanceBeforeMinting: BigNumber = await usdtContract.allowance(
        selectedAccount,
        quidContract.address,
      );

      console.log(
        'Start minting:',
        '\nQD amount: ',
        mintValue,
        '\nCurrent account: ',
        selectedAccount,
        '\nAllowance: ',
        formatUnits(allowanceBeforeMinting, 6),
      );

      await quidContract?.mint(qdAmount, selectedAccount);

      notify({
        severity: 'success',
        message: 'Your minting is pending!',
      });
    } catch (err: any) {
      console.error(err);

      notify({
        severity: 'error',
        message: err.error?.message || err.message,
        autoHideDuration: 3200,
      });
    } finally {
      setState('none');
      setMintValue('');
    }
  };

  return (
    <form className={styles.root} onSubmit={handleSubmit}>
      <div>
        <div className={styles.availability}>
          {/*<span className={styles.availabilityCurrent}>*/}
          {/*  Minted {numberWithCommas(totalSupply)} QD*/}
          {/*</span>*/}
          {/*<span className={styles.availabilityDivideSign}>/</span>*/}
          <span className={styles.availabilityMax}>
            {numberWithCommas(totalSupplyCap.toFixed())} QD mintable
          </span>
        </div>
        <div className={styles.inputContainer}>
          <input
            type="text"
            id="mint-input"
            className={styles.input}
            value={mintValue}
            onChange={handleChangeValue}
            placeholder="Mint amount"
            ref={inputRef}
          />
          <label htmlFor="mint-input" className={styles.dollarSign}>
            QD
          </label>
          <button
            className={styles.maxButton}
            onClick={handleSetMaxValue}
            type="button"
          >
            Max
            <Icon
              preserveAspectRatio="none"
              className={styles.maxButtonBackground}
              name="btn-bg"
            />
          </button>
        </div>
        <div className={styles.sub}>
          <div className={styles.subLeft}>
            Cost in $
            <strong>
              {usdtValue === 0
                ? 'USDT Amount'
                : numberWithCommas(usdtValue.toFixed())}
            </strong>
          </div>
          { mintValue ? (<div className={styles.subRight}>
            <strong>
              ${numberWithCommas((+mintValue - usdtValue).toFixed())}
            </strong>
            Future profit
          </div>) : null}
        </div>
      </div>
      <button
        type="submit"
        className={cn(styles.submit, styles[state])}
        disabled={state !== 'none'}
      >
        {state !== 'none' ? `...${state}` : 'Mint'}
        <Icon
          preserveAspectRatio="none"
          className={styles.submitBtnL1}
          name="composite-btn-l1"
        />
        <Icon
          preserveAspectRatio="none"
          className={styles.submitBtnL2}
          name="composite-btn-l2"
        />
        <Icon
          preserveAspectRatio="none"
          className={styles.submitBtnL3}
          name="composite-btn-l3"
        />
        <div className={styles.glowEffect} />
      </button>
    </form>
  );
};

export default Mint;
