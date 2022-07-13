#!/bin/sh

find .next -type f -print0 | xargs -0 sed -i \
  -e "s#API_URL_PLACEHOLDER#$NEXT_PUBLIC_API_URL#g" \
  -e "s#CONTRACT_ID_USDT_PLACEHOLDER#$NEXT_PUBLIC_USDT_CONTRACT_ID#g" \
  -e "s#CONTRACT_ID_PLACEHOLDER#$NEXT_PUBLIC_CONTRACT_ID#g" \
  -e "s#INFURA_KEY_PLACEHOLDER#$NEXT_PUBLIC_INFURA_KEY#g" \
  -e "s#NETWOKR_PLACEHOLDER#$NEXT_PUBLIC_NETWOKR#g"

cp -r .next /static-data/

npm run start
