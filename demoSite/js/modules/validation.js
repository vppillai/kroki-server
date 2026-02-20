/**
 * Input Validation Module
 *
 * Provides validation functions for file inputs, configuration values,
 * and string sanitization.
 *
 * @module validation
 */

import { MAX_FILE_SIZE_BYTES, MAX_CONFIG_STRING_LENGTH } from './constants.js';

/**
 * Validate a file before processing
 * @param {File} file - File to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFile(file) {
    if (!file) {
        return { valid: false, error: 'No file provided' };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const maxMB = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
        return { valid: false, error: `File too large (${sizeMB} MB). Maximum allowed size is ${maxMB} MB.` };
    }

    return { valid: true };
}

/**
 * Validate a configuration value against a schema definition
 * @param {string} key - Configuration key
 * @param {*} value - Value to validate
 * @param {Object} [schema] - Schema definition with type, min, max, options
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateConfigValue(key, value, schema) {
    if (!schema) {
        return { valid: true };
    }

    if (schema.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
            return { valid: false, error: `${key} must be a number` };
        }
        if (schema.min !== undefined && num < schema.min) {
            return { valid: false, error: `${key} must be at least ${schema.min}` };
        }
        if (schema.max !== undefined && num > schema.max) {
            return { valid: false, error: `${key} must be at most ${schema.max}` };
        }
    }

    if (schema.type === 'boolean' && typeof value !== 'boolean') {
        return { valid: false, error: `${key} must be a boolean` };
    }

    if (schema.type === 'select' && schema.options) {
        const validValues = schema.options.map(o => o.value);
        if (!validValues.includes(value)) {
            return { valid: false, error: `${key} must be one of: ${validValues.join(', ')}` };
        }
    }

    if (schema.type === 'text' || schema.type === 'textarea') {
        if (typeof value === 'string' && value.length > MAX_CONFIG_STRING_LENGTH) {
            return { valid: false, error: `${key} exceeds maximum length of ${MAX_CONFIG_STRING_LENGTH}` };
        }
    }

    return { valid: true };
}

/**
 * Sanitize a string by truncating to a maximum length
 * @param {string} input - Input string
 * @param {number} [maxLength=MAX_CONFIG_STRING_LENGTH] - Maximum allowed length
 * @returns {string} Truncated string
 */
export function sanitizeString(input, maxLength = MAX_CONFIG_STRING_LENGTH) {
    if (typeof input !== 'string') {
        return String(input);
    }
    return input.slice(0, maxLength);
}
