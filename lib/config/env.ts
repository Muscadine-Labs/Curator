/**
 * Environment Variable Validation and Configuration
 * Validates required environment variables at startup
 */

// Server-side environment variables
export const getServerEnv = () => {
  const alchemyApiKey = process.env.ALCHEMY_API_KEY;
  const duneApiKey = process.env.DUNE_API_KEY;

  return {
    alchemyApiKey: alchemyApiKey || null,
    duneApiKey: duneApiKey || null,
  };
};

// Client-side environment variables
export const getClientEnv = () => {
  const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const onchainKitApiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;

  return {
    alchemyApiKey: alchemyApiKey || null,
    onchainKitApiKey: onchainKitApiKey || null,
  };
};

// Validate required environment variables
export const validateEnv = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Server-side required
  if (!process.env.ALCHEMY_API_KEY) {
    errors.push('ALCHEMY_API_KEY is required for server-side RPC calls');
  }

  // Client-side required
  if (!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY) {
    errors.push('NEXT_PUBLIC_ALCHEMY_API_KEY is required for client-side RPC calls');
  }

  // Optional but recommended
  const warnings: string[] = [];
  if (!process.env.DUNE_API_KEY) {
    warnings.push('DUNE_API_KEY is not set - Dune Analytics features will be disabled');
  }
  if (!process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY) {
    warnings.push('NEXT_PUBLIC_ONCHAINKIT_API_KEY is not set - some wallet features may be limited');
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn('Environment variable warnings:', warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Validate on module load (only in development)
if (process.env.NODE_ENV === 'development') {
  const validation = validateEnv();
  if (!validation.valid) {
    console.error('❌ Environment variable validation failed:');
    validation.errors.forEach((error) => console.error(`  - ${error}`));
    console.error('\nPlease check your .env.local file and ensure all required variables are set.');
  }
}




