/**
 * GraphQL Client for Morpho API
 * Uses graphql-request with SDK-generated types for type safety
 */
import { type RequestDocument } from 'graphql-request';
import { print, type DocumentNode } from 'graphql';
import { API_REQUEST_TIMEOUT_MS } from '@/lib/constants';
import { logger } from '@/lib/utils/logger';
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout';

export type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
};

type GraphQLError = {
  message: string;
  path?: string[];
};

type GraphQLResponseError = {
  response?: {
    errors?: GraphQLError[];
    status?: number;
    statusText?: string;
  };
  message?: string;
  request?: {
    url?: string;
  };
};

/**
 * Get Morpho GraphQL endpoint from environment or default
 * Evaluated at runtime to ensure env vars are available
 */
function getMorphoEndpoint(): string {
  return process.env.MORPHO_GRAPHQL_ENDPOINT || 
         process.env.MORPHO_API_URL || 
         'https://api.morpho.org/graphql';
}

/**
 * Type-safe GraphQL client wrapper
 */
export class MorphoGraphQLClient {
  private endpoint: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || getMorphoEndpoint();
  }

  async request<T = unknown>(
    document: RequestDocument,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const startTime = Date.now();
    const query =
      typeof document === 'string'
        ? document
        : print(document as DocumentNode);

    try {
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('Accept', 'application/json');
      
      const response = await fetchWithTimeout(
        this.endpoint,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query,
            variables,
          }),
        },
        API_REQUEST_TIMEOUT_MS
      );

      if (!response.ok) {
        const error = new Error(
          `GraphQL HTTP Error: ${response.status} ${response.statusText || 'Unknown error'}`
        );
        logger.error('GraphQL HTTP error', error, {
          status: response.status,
          statusText: response.statusText,
          endpoint: this.endpoint,
        });
        throw error;
      }

      const json = await response.json() as { data?: T; errors?: GraphQLError[] };

      if (json.errors && json.errors.length > 0) {
        const errorMessages = json.errors.map((e) => e.message).join(', ');
        const error = new Error(`GraphQL Error: ${errorMessages}`);
        logger.error('GraphQL errors', error, {
          errors: json.errors,
          endpoint: this.endpoint,
        });
        throw error;
      }

      const data = json.data as T;
      const duration = Date.now() - startTime;
      
      return data;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      // Enhanced error handling with logging
      const graphqlError = error as GraphQLResponseError;
      
      logger.error('GraphQL request failed', error instanceof Error ? error : new Error(String(error)), {
        endpoint: this.endpoint,
        endpointFromEnv: getMorphoEndpoint(),
        duration: `${duration}ms`,
        status: graphqlError.response?.status,
        statusText: graphqlError.response?.statusText,
      });

      if (graphqlError.response?.errors) {
        const errors = graphqlError.response.errors;
        const errorMessages = errors.map((e: GraphQLError) => e.message).join(', ');
        const error = new Error(`GraphQL Error: ${errorMessages}`);
        logger.error('GraphQL errors', error, {
          errors: errors,
          endpoint: this.endpoint,
        });
        throw error;
      }
      
      // Handle network/HTTP errors
      if (graphqlError.response?.status) {
        const error = new Error(
          `GraphQL HTTP Error: ${graphqlError.response.status} ${graphqlError.response.statusText || 'Unknown error'}`
        );
        logger.error('GraphQL HTTP error', error, {
          status: graphqlError.response.status,
          statusText: graphqlError.response.statusText,
          endpoint: this.endpoint,
        });
        throw error;
      }
      
      if (error instanceof Error) {
        logger.error('GraphQL request error', error, {
          endpoint: this.endpoint,
          message: error.message,
        });
        throw error;
      }
      
      const unknownError = new Error('Unknown GraphQL error occurred');
      logger.error('Unknown GraphQL error', unknownError, {
        endpoint: this.endpoint,
        originalError: String(error),
      });
      throw unknownError;
    }
  }
}

// Lazy singleton instance - created on first access to ensure env vars are available
let _morphoGraphQLClient: MorphoGraphQLClient | null = null;

function getMorphoGraphQLClient(): MorphoGraphQLClient {
  if (!_morphoGraphQLClient) {
    _morphoGraphQLClient = new MorphoGraphQLClient();
  }
  return _morphoGraphQLClient;
}

// Export singleton with proper lazy initialization
// Access methods directly to avoid Proxy issues in serverless environments
export const morphoGraphQLClient = {
  request: <T = unknown>(
    document: Parameters<MorphoGraphQLClient['request']>[0],
    variables?: Parameters<MorphoGraphQLClient['request']>[1]
  ): Promise<T> => {
    return getMorphoGraphQLClient().request<T>(document, variables);
  },
} as MorphoGraphQLClient;

