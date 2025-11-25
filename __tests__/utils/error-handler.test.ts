/**
 * Tests for error handling utilities
 */

import { AppError, createErrorResponse, handleApiError } from '@/lib/utils/error-handler';

describe('AppError', () => {
  it('should create error with message and status code', () => {
    const error = new AppError('Test error', 400);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
  });

  it('should include code and details', () => {
    const error = new AppError('Test', 400, 'TEST_CODE', { field: 'value' });
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ field: 'value' });
  });
});

describe('createErrorResponse', () => {
  it('should handle AppError', () => {
    const error = new AppError('Test', 400, 'TEST');
    const response = createErrorResponse(error);
    expect(response.statusCode).toBe(400);
    expect(response.error.message).toBe('Test');
    expect(response.error.code).toBe('TEST');
  });

  it('should handle generic Error', () => {
    const error = new Error('Generic error');
    const response = createErrorResponse(error);
    expect(response.statusCode).toBe(500);
    expect(response.error.message).toBe('Generic error');
  });

  it('should handle unknown errors', () => {
    const response = createErrorResponse('string error', 'Default message');
    expect(response.statusCode).toBe(500);
    expect(response.error.message).toBe('Default message');
  });
});

describe('handleApiError', () => {
  it('should return standardized error response', () => {
    const error = new AppError('Test', 404);
    const result = handleApiError(error);
    expect(result.statusCode).toBe(404);
    expect(result.error.message).toBe('Test');
  });
});

