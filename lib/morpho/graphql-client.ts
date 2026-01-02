/**
 * GraphQL Client for Morpho API
 * Uses graphql-request with SDK-generated types for type safety
 */
import { request, type RequestDocument } from 'graphql-request';
import { MORPHO_GRAPHQL_ENDPOINT } from '@/lib/constants';
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
    try {
      const data = await request<T>(this.endpoint, document, variables);
      return data;
    } catch (error: unknown) {
      // Enhanced error handling with logging
      const graphqlError = error as GraphQLResponseError;
      
      // Log the error for debugging
      logger.error('GraphQL request failed', error instanceof Error ? error : new Error(String(error)), {
        endpoint: this.endpoint,
        status: graphqlError.response?.status,
        statusText: graphqlError.response?.statusText,
        hasErrors: !!graphqlError.response?.errors,
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

