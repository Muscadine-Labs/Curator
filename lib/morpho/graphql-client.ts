/**
 * GraphQL Client for Morpho API
 * Uses graphql-request with SDK-generated types for type safety
 */
import { request, type RequestDocument } from 'graphql-request';
import type { 
  Market, 
  Vault, 
  MarketState,
  VaultState,
  Maybe,
  Scalars
} from '@morpho-org/blue-api-sdk';
import { MORPHO_GRAPHQL_ENDPOINT } from '@/lib/constants';

export type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
};

/**
 * Type-safe GraphQL client wrapper
 */
export class MorphoGraphQLClient {
  private endpoint: string;

  constructor(endpoint: string = MORPHO_GRAPHQL_ENDPOINT) {
    this.endpoint = endpoint;
  }

  async request<T = any>(
    document: RequestDocument,
    variables?: Record<string, any>
  ): Promise<T> {
    try {
      const data = await request<T>(this.endpoint, document, variables);
      return data;
    } catch (error: any) {
      // Enhanced error handling
      if (error.response) {
        const errors = error.response.errors || [];
        const errorMessages = errors.map((e: any) => e.message).join(', ');
        throw new Error(`GraphQL Error: ${errorMessages}`);
      }
      throw error;
    }
  }
}

// Singleton instance
export const morphoGraphQLClient = new MorphoGraphQLClient();

