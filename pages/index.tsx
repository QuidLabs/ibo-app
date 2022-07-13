import { useContext, useEffect, useState } from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { Swiper, SwiperSlide } from 'swiper/react';

import { Mint } from '../components/Mint';
import { Summary } from '../components/Summary';
import { Table } from '../components/Table';
import { ScrollAssistant } from '../components/ScrollAssistant';
import { PaginationResponse, Transaction } from '../types';
import { getNetwork } from '@ethersproject/networks';
import { useWallet } from '../hooks/use-wallet';
import { NotificationContext } from '../components/Notification';

import styles from '../styles/Home.module.scss';
import 'swiper/swiper.min.css';

type HomeProps = {
  transactions: PaginationResponse<Transaction>;
};

const Home: NextPage<HomeProps> = ({ transactions }) => {
  const [swiperRef, setSwiperRef] = useState<any | null>(null);
  const tableData = transactions?.documents || [];
  const { notify } = useContext(NotificationContext);
  const { chainId } = useWallet();

  useEffect(() => {
    const network = getNetwork(process.env.NEXT_PUBLIC_NETWOKR || 'ropsten');

    if (chainId && parseInt(chainId, 16) !== network.chainId) {
      notify({
        autoHideDuration: 3500,
        severity: 'error',
        message: `Wrong network selected please switch to ${process.env.NEXT_PUBLIC_NETWOKR}`,
      });
    }
  }, [chainId, notify]);

  return (
    <div className={styles.root}>
      <Head>
        <title>QuiD</title>
        <meta name="description" content="quid" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Swiper
        onSwiper={(swiper) => setSwiperRef(swiper)}
        slidesPerView={1}
        direction={'vertical'}
        className={styles.carousel}
        allowTouchMove={false}
      >
        <SwiperSlide className={styles.slide}>
          <div className={styles.side}>
            <Summary />
          </div>
          <div className={styles.content}>
            <div className={styles.mintContainer}>
              <Mint />
            </div>
            <div className={styles.videoPlayer}>
              <iframe width="650" height="365" src="https://www.youtube.com/embed/AREzvn3FSWc"
                      title="YouTube video player" frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen />
            </div>
            {/*<Table data={tableData.slice(0, 3)} />*/}
          </div>
          <div className={styles.fakeCol} />
        </SwiperSlide>
        <SwiperSlide className={styles.slide}>
          <div className={styles.tableSlide}>
            <div className={styles.tableWrapper}>
              <h2 className={styles.tableSlideTitle}>Transactions</h2>
              <Table rarefied data={tableData} />
            </div>
          </div>
        </SwiperSlide>
      </Swiper>

      <div className={styles.scrollAssist}>
        {!!transactions?.documents?.length && (
          <ScrollAssistant swiper={swiperRef} />
        )}
      </div>
    </div>
  );
};

export default Home;
