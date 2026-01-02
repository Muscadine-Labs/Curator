/**
 * GraphQL Client for Morpho API
 * Uses graphql-request with SDK-generated types for type safety
 */
import { request, type RequestDocument } from 'graphql-request';
import { MORPHO_GRAPHQL_ENDPOINT, API_REQUEST_TIMEOUT_MS } from '@/lib/constants';
import { logger } from '@/lib/utils/logger';

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
 * Type-safe GraphQL client wrapper
 */
export class MorphoGraphQLClient {
  private endpoint: string;

  constructor(endpoint: string = MORPHO_GRAPHQL_ENDPOINT) {
    this.endpoint = endpoint;
  }

  async request<T = unknown>(
    document: RequestDocument,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const startTime = Date.now();
    try {
      logger.debug('GraphQL request starting', {
        endpoint: this.endpoint,
        hasVariables: !!variables,
      });

      // Wrap request in a timeout promise for better Vercel compatibility
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('Accept', 'application/json');
      
      const requestPromise = request<T>(this.endpoint, document, variables, headers);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`GraphQL request timeout after ${API_REQUEST_TIMEOUT_MS}ms`));
        }, API_REQUEST_TIMEOUT_MS);
      });

      const data = await Promise.race([requestPromise, timeoutPromise]);
      const duration = Date.now() - startTime;
      
      logger.debug('GraphQL request succeeded', {
        endpoint: this.endpoint,
        duration: `${duration}ms`,
      });

      return data;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      // Enhanced error handling with logging
      const graphqlError = error as GraphQLResponseError;
      
      // Log the error for debugging
      const isTimeout = error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout'));
      logger.error('GraphQL request failed', error instanceof Error ? error : new Error(String(error)), {
        endpoint: this.endpoint,
        duration: `${duration}ms`,
        status: graphqlError.response?.status,
        statusText: graphqlError.response?.statusText,
        hasErrors: !!graphqlError.response?.errors,
        isTimeout,
        timeoutMs: API_REQUEST_TIMEOUT_MS,
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

// Singleton instance
export const morphoGraphQLClient = new MorphoGraphQLClient();

