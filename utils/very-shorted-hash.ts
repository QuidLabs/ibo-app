const shortedHash = (hashSum: string): string => {
  if (hashSum) return `${hashSum.slice(0, 3)}...`;

  return hashSum;
};

export default shortedHash;
