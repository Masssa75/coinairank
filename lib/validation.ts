// Contract address validation utilities

/**
 * Validates an Ethereum/EVM contract address (0x...)
 */
export function isValidEVMAddress(address: string): boolean {
  // EVM addresses are 42 characters: 0x + 40 hex chars
  const evmRegex = /^0x[a-fA-F0-9]{40}$/;
  return evmRegex.test(address);
}

/**
 * Validates a Solana contract address (base58)
 */
export function isValidSolanaAddress(address: string): boolean {
  // Solana addresses are base58 encoded, typically 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

/**
 * Validates a contract address based on the network
 */
export function isValidContractAddress(address: string, network: string): boolean {
  if (!address || !network) return false;
  
  const normalizedNetwork = network.toLowerCase();
  
  // Solana uses base58 addresses
  if (normalizedNetwork === 'solana') {
    return isValidSolanaAddress(address);
  }
  
  // All EVM chains (Ethereum, BSC, Base, PulseChain) use 0x addresses
  const evmNetworks = ['ethereum', 'eth', 'bsc', 'base', 'pulsechain', 'pulse'];
  if (evmNetworks.includes(normalizedNetwork)) {
    return isValidEVMAddress(address);
  }
  
  // Unknown network - be permissive but log warning
  console.warn(`Unknown network for validation: ${network}`);
  return isValidEVMAddress(address) || isValidSolanaAddress(address);
}

/**
 * Normalizes a contract address (lowercase for EVM)
 */
export function normalizeContractAddress(address: string, network: string): string {
  const normalizedNetwork = network.toLowerCase();
  
  // EVM addresses should be lowercase for consistency
  if (normalizedNetwork !== 'solana') {
    return address.toLowerCase();
  }
  
  // Solana addresses are case-sensitive
  return address;
}

/**
 * Network display names and normalization
 */
export const NETWORKS = {
  ethereum: { display: 'Ethereum', value: 'ethereum', dexscreener: 'ethereum' },
  solana: { display: 'Solana', value: 'solana', dexscreener: 'solana' },
  bsc: { display: 'BNB Chain', value: 'bsc', dexscreener: 'bsc' },
  base: { display: 'Base', value: 'base', dexscreener: 'base' },
  pulsechain: { display: 'PulseChain', value: 'pulsechain', dexscreener: 'pulsechain' }
} as const;

export type NetworkKey = keyof typeof NETWORKS;

/**
 * Get normalized network name for API calls
 */
export function normalizeNetwork(network: string): string {
  const mapping: Record<string, string> = {
    'ethereum': 'ethereum',
    'eth': 'ethereum',
    'solana': 'solana',
    'sol': 'solana',
    'bsc': 'bsc',
    'binance': 'bsc',
    'bnb': 'bsc',
    'base': 'base',
    'pulsechain': 'pulsechain',
    'pulse': 'pulsechain'
  };
  
  return mapping[network.toLowerCase()] || network.toLowerCase();
}