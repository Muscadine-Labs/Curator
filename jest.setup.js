// Jest setup file
// This file runs before each test file

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for TextEncoder/TextDecoder (required by viem)
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
