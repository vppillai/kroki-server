// Encoding and decoding utilities for Kroki diagrams
class EncodingUtils {
    /**
     * Encode text to UTF-8 bytes
     * @param {string} str - Text to encode
     * @returns {Uint8Array} UTF-8 encoded bytes
     */
    static textEncode(str) {
        if (window.TextEncoder) {
            return new TextEncoder('utf-8').encode(str);
        }
        // Fallback for older browsers
        const utf8 = unescape(encodeURIComponent(str));
        const result = new Uint8Array(utf8.length);
        for (let i = 0; i < utf8.length; i++) {
            result[i] = utf8.charCodeAt(i);
        }
        return result;
    }

    /**
     * Convert Uint8Array to string
     * @param {Uint8Array} array - Byte array to convert
     * @returns {string} String representation
     */
    static uint8ArrayToString(array) {
        let result = '';
        for (let i = 0; i < array.length; i++) {
            result += String.fromCharCode(array[i]);
        }
        return result;
    }

    /**
     * Encode diagram text for Kroki URL
     * @param {string} text - Diagram text to encode
     * @returns {string} Encoded string for URL
     */
    static encodeKrokiDiagram(text) {
        try {
            const bytes = this.textEncode(text);
            const compressed = pako.deflate(bytes);
            const strData = this.uint8ArrayToString(compressed);
            return btoa(strData)
                .replace(/\+/g, '-')
                .replace(/\//g, '_');
        } catch (error) {
            throw new Error(`Failed to encode diagram: ${error.message}`);
        }
    }

    /**
     * Decode a Kroki diagram string back to text
     * @param {string} encodedString - Encoded diagram string
     * @returns {string} Decoded diagram text
     */
    static decodeKrokiDiagram(encodedString) {
        try {
            const base64String = encodedString
                .replace(/-/g, '+')
                .replace(/_/g, '/');

            const binaryString = atob(base64String);

            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const decompressed = pako.inflate(bytes);

            const decoder = new TextDecoder('utf-8');
            return decoder.decode(decompressed);
        } catch (error) {
            throw new Error(`Failed to decode diagram: ${error.message}`);
        }
    }

    /**
     * Extract encoded diagram from a full Kroki URL
     * @param {string} url - Full Kroki URL or just the encoded part
     * @returns {string} Extracted encoded diagram string
     */
    static extractEncodedFromUrl(url) {
        if (url.includes('/')) {
            return url.split('/').pop();
        }
        return url;
    }

    /**
     * Validate if a string appears to be a valid Kroki encoded diagram
     * @param {string} encoded - Encoded string to validate
     * @returns {boolean} Whether the string appears valid
     */
    static isValidKrokiEncoding(encoded) {
        if (!encoded || typeof encoded !== 'string') {
            return false;
        }

        // Basic validation: should be base64-like with URL-safe characters
        const validChars = /^[A-Za-z0-9_-]+$/;
        return validChars.test(encoded) && encoded.length > 0;
    }
}

export default EncodingUtils;
