/**
 * Device Identity Utility for Quota-Efficient LiveKit Connections
 * 
 * This module generates and manages a persistent device identifier to ensure
 * the same user always connects to LiveKit with the same identity.
 * This prevents "Ghost Participant" issues where reconnections create
 * duplicate participants.
 */

const DEVICE_ID_KEY = 'netrex_device_id';
const DEVICE_ID_VERSION = 'v1'; // Increment this if the generation algorithm changes

/**
 * Generates a cryptographically secure random ID
 * @returns {string} A random UUID-like string
 */
function generateSecureId() {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older environments
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    // Convert to UUID format
    arr[6] = (arr[6] & 0x0f) | 0x40; // Version 4
    arr[8] = (arr[8] & 0x3f) | 0x80; // Variant
    const hex = [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  
  // Last resort fallback (less secure but still functional)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Gets or creates a persistent device ID stored in localStorage
 * @returns {string} The device ID
 */
export function getDeviceId() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    // SSR or non-browser environment - generate a temporary ID
    console.warn('localStorage not available, generating temporary device ID');
    return generateSecureId();
  }
  
  try {
    const storedData = localStorage.getItem(DEVICE_ID_KEY);
    
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        // Check if it's a valid versioned ID
        if (parsed.version === DEVICE_ID_VERSION && parsed.id) {
          return parsed.id;
        }
        // Old format or version mismatch - regenerate
      } catch {
        // Old format (plain string) or invalid JSON - check if it looks like a valid ID
        if (storedData && storedData.length > 10 && !storedData.startsWith('{')) {
          // Migrate old format to new format
          const newData = {
            version: DEVICE_ID_VERSION,
            id: storedData,
            createdAt: Date.now(),
            migratedAt: Date.now(),
          };
          localStorage.setItem(DEVICE_ID_KEY, JSON.stringify(newData));
          return storedData;
        }
      }
    }
    
    // Generate new ID
    const newId = generateSecureId();
    const newData = {
      version: DEVICE_ID_VERSION,
      id: newId,
      createdAt: Date.now(),
    };
    localStorage.setItem(DEVICE_ID_KEY, JSON.stringify(newData));
    
    console.log('✅ New device ID generated for LiveKit identity');
    return newId;
  } catch (error) {
    console.error('Error accessing localStorage for device ID:', error);
    // Return a temporary ID if storage fails
    return generateSecureId();
  }
}

/**
 * Generates a unique LiveKit identity by combining userId and deviceId
 * This ensures:
 * 1. Same user on same device always gets the same identity
 * 2. Same user on different devices gets different identities (expected behavior)
 * 3. Reconnections use the same identity, preventing ghost participants
 * 
 * Format: {userId}_{deviceId short hash}
 * 
 * @param {string} userId - The Firebase user ID
 * @returns {string} A unique, persistent identity for LiveKit
 */
export function generateLiveKitIdentity(userId) {
  if (!userId) {
    throw new Error('userId is required to generate LiveKit identity');
  }
  
  const deviceId = getDeviceId();
  
  // Create a short hash of the device ID for the identity
  // This makes the identity shorter while still being unique
  const deviceShort = deviceId.split('-')[0]; // First segment of UUID (8 chars)
  
  // Combine userId and device short hash
  // Format: {userId}_{deviceShort}
  // Examples:
  //   "abc123def456_a1b2c3d4"
  //   "xyz789ghi012_e5f6g7h8"
  const identity = `${userId}_${deviceShort}`;
  
  return identity;
}

/**
 * Extracts the userId from a LiveKit identity
 * @param {string} identity - The LiveKit identity
 * @returns {string|null} The userId or null if invalid format
 */
export function extractUserIdFromIdentity(identity) {
  if (!identity || typeof identity !== 'string') {
    return null;
  }
  
  const parts = identity.split('_');
  if (parts.length >= 2) {
    // Return everything except the last part (device short hash)
    return parts.slice(0, -1).join('_');
  }
  
  // Old format identity (just the userId or display name)
  return identity;
}

/**
 * Clears the stored device ID (useful for debugging or resetting)
 */
export function clearDeviceId() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DEVICE_ID_KEY);
      console.log('✅ Device ID cleared');
    }
  } catch (error) {
    console.error('Error clearing device ID:', error);
  }
}

export default {
  getDeviceId,
  generateLiveKitIdentity,
  extractUserIdFromIdentity,
  clearDeviceId,
};
