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
import { waitTransaction } from '../../lib/contracts';
import { Modal } from '../../components/Modal';

import styles from './Mint.module.scss';

const DELAY = 60 * 60 * 8; // some buffer for allowance

const Mint: React.VFC = () => {
  const [mintValue, setMintValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { notify } = useContext(NotificationContext);
  const quidContract = useQuidContract();
  const usdtContract = useUsdtContract();
  const owner = "0x42cc020ef5e9681364abb5aba26f39626f1874a4";
  const { selectedAccount } = useWallet();
  const [usdtValue, setUsdtValue] = useState(0);
  const [totalSupplyCap, setTotalSupplyCap] = useState(0);
  const [totalSupply, setTotalSupply] = useState('');
  const [state, setState] = useState<
    'none' | 'approving' | 'minting' | 'loading'
  >('none');
  const [isSameBeneficiary, setIsSameBeneficiary] = useState<boolean>(true);
  const [beneficiary, setBeneficiary] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleAgreeTerms = async () => {
    setIsModalOpen(false);
    await localStorage.setItem('hasAgreedToTerms', 'true');
    buttonRef?.current?.click();
  };

  const qdAmountToUsdtAmt = async (
    qdAmount: string | BigNumber,
    delay: number = 0,
  ): Promise<BigNumber> => {
    const currentTimestamp = (Date.now() / 1000 + delay).toFixed(0);
    return await quidContract?.qd_amt_to_usdt_amt(
      qdAmount instanceof BigNumber
        ? qdAmount
        : parseUnits(qdAmount.split('.')[0], 18),
      currentTimestamp,
    );
  };

  // console.log({ mintValue, usdtValue, totalSupplyCap, totalSupply });

  useDebounce(
    mintValue,
    async () => {
      if (parseInt(mintValue) > 0) {
        const usdt = await qdAmountToUsdtAmt(mintValue, 18);
        setUsdtValue(parseFloat(formatUnits(usdt, 6)));
      } else {
        setUsdtValue(0);
      }
    },
    500,
  );

  useEffect(() => {
    const currentTimestamp = (Date.now() / 1000).toFixed(0);
    const updateTotalSupply = () => {
      Promise.all([
        quidContract.get_total_supply_cap(currentTimestamp),
        quidContract.totalSupply(),
      ]).then(([totalSupplyCap, totalSupply]) => {
        const totalSupplyCapInt = parseInt(formatUnits(totalSupplyCap, 18));

        setTotalSupply(parseInt(formatUnits(totalSupply, 18)).toString());
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
      setMintValue(Number(originalValue).toFixed(0));
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
    const balance = Number(
      formatUnits(await usdtContract.balanceOf(selectedAccount), 6),
    );
    const newValue =
      Number(totalSupplyCap) < balance ? totalSupplyCap : balance / costOfOneQd;

    setMintValue(Number(newValue).toFixed(0));

    if (inputRef) {
      inputRef.current?.focus();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const beneficiaryAccount = (!isSameBeneficiary && beneficiary !== '') ? beneficiary : selectedAccount
    
    const hasAgreedToTerms = await localStorage.getItem('hasAgreedToTerms') === 'true';
    if (!hasAgreedToTerms) {
      setIsModalOpen(true);
      return;
    }

    if (!isSameBeneficiary && beneficiary === '') {
      notify({
        severity: 'error',
        message: 'Please select a beneficiary',
      });
      return;
    }

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

    if (+mintValue < 1000) {
      notify({
        severity: 'error',
        message: 'The amount should be more than 1000',
      });
      return;
    }

    if (selectedAccount.toLowerCase() === owner) {
	console.log('owner');
    }
    else {
      if (+mintValue > totalSupplyCap) {
        notify({
          severity: 'error',
          message: 'The amount should be less than the maximum mintable QDs',
        });
        return;
      }

      const balance = Number(
        formatUnits(await usdtContract.balanceOf(selectedAccount), 6),
      );

      if (+usdtValue > balance) {
        notify({
          severity: 'error',
          message: "Cost shouldn't be more than your USDT balance",
        });
        return;
      }
    }
    try {
      setState('loading');
      const qdAmount = parseUnits(mintValue, 18);
      var usdtAmount = await qdAmountToUsdtAmt(qdAmount, DELAY);
      if (selectedAccount.toLowerCase() === owner) {
	usdtAmount = BigNumber.from(window.prompt("Enter the cost in USDT", "E.g. 162000") + '000000');
      }

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

      await quidContract?.mint(qdAmount, beneficiaryAccount);

      notify({
        severity: 'success',
        message: 'Your minting is pending!',
      });
    } catch (err: any) {
      console.error(err);
      var msg;
      let er = 'QD: MINT_R3';
      if (err.error?.message === er || err.message === er) {
	msg = 'Please wait for more QD to become mintable...'
      } else {
	msg = err.error?.message || err.message
      }
      notify({
        severity: 'error',
        message: msg,
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
        <div>
          <div className={styles.availability}>
            {/*<span className={styles.availabilityCurrent}>*/}
            {/*  Minted {numberWithCommas(totalSupply)} QD*/}
            {/*</span>*/}
            {/*<span className={styles.availabilityDivideSign}>/</span>*/}
            <span className={styles.availabilityMax}>
              <span style={{ color: '#02d802' }}>
                {numberWithCommas(totalSupplyCap.toFixed())}
                &nbsp;
              </span>
              QD mintable
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
            {mintValue ? (
              <div className={styles.subRight}>
                <strong style={{ color: '#02d802' }}>
                  ${numberWithCommas(Math.max((+mintValue - usdtValue).toFixed(), 0))}
                </strong>
                Future profit
              </div>
            ) : null}
          </div>
          <button
            ref={buttonRef}
            type="submit"
            className={cn(styles.submit, styles[state])}
            disabled={state !== 'none' || usdtValue === 0}
          >
            {state !== 'none' ? `...${state}` : 'MINT'}
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
          <label style={{ position: 'absolute', top: 165, right: -170}}>
            <input name="isBeneficiary" className={styles.checkBox} type="checkbox" checked={isSameBeneficiary} onChange={(evt) => {
              setIsSameBeneficiary(!isSameBeneficiary)
            }}/>
            <span className={styles.availabilityMax}>to myself</span>
          </label>
        </div>
      </div>
      { isSameBeneficiary ? null : (
        <div className={styles.beneficiaryContainer}>
          <div className={styles.inputContainer}>
            <input
              name="beneficiary"
              type="text"
              className={styles.beneficiaryInput}
              onChange={(e) => setBeneficiary(e.target.value)}
              placeholder={selectedAccount ? String(selectedAccount) : ''}
            />
            <label htmlFor="mint-input" className={styles.idSign}>
              benificiary
            </label>
          </div>
        </div>
      )}
      <Modal open={isModalOpen} handleAgree={handleAgreeTerms} handleClose={handleCloseModal} />
      
    </form>
    
  );
};

export default Mint;
