/**
 * API Client for LicenseFlow Edge Functions
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { getApiEndpoint, getApiKey } from './config';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface ActivationResponse {
  success: boolean;
  activation_id: string;
  license: {
    id: string;
    status: string;
    expires_at?: string;
  };
}

export interface ValidationResponse {
  valid: boolean;
  license: {
    id: string;
    status: string;
    expires_at?: string;
    features?: Record<string, unknown>;
  };
}

export interface CheckoutResponse {
  success: boolean;
  lease: {
    lease_key: string;
    license_id: string;
    checked_out_at: string;
    expires_at: string;
    duration_seconds: number;
  };
  message: string;
}

export interface CheckinResponse {
  success: boolean;
  lease: {
    lease_key: string;
    status: string;
    checked_in_at: string;
    used_seconds: number;
  };
  message: string;
}

export interface LeaseStatusResponse {
  lease: {
    lease_key: string;
    status: string;
    remaining_seconds: number;
    expires_at: string;
    requester_id: string;
  };
  license: {
    license_id: string;
    status: string;
  };
  is_valid: boolean;
}

function createClient(): AxiosInstance {
  const apiKey = getApiKey();
  const endpoint = getApiEndpoint();

  return axios.create({
    baseURL: endpoint,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey && { 'apikey': apiKey }),
    },
    timeout: 30000,
  });
}

export async function activateLicense(
  licenseKey: string,
  deviceId: string,
  deviceName?: string,
  fingerprint?: Record<string, unknown>
): Promise<ApiResponse<ActivationResponse>> {
  try {
    const client = createClient();
    const response = await client.post('/activate-license', {
      license_key: licenseKey,
      device_id: deviceId,
      device_name: deviceName,
      fingerprint,
    });
    return { success: true, data: response.data };
  } catch (error) {
    return handleError(error);
  }
}

export async function deactivateLicense(
  licenseKey: string,
  deviceId: string
): Promise<ApiResponse> {
  try {
    const client = createClient();
    const response = await client.post('/deactivate-license', {
      license_key: licenseKey,
      device_id: deviceId,
    });
    return { success: true, data: response.data };
  } catch (error) {
    return handleError(error);
  }
}

export async function validateLicense(
  licenseKey: string,
  environmentId?: string
): Promise<ApiResponse<ValidationResponse>> {
  try {
    const client = createClient();
    const response = await client.post('/verify-license', {
      license_key: licenseKey,
      ...(environmentId && { environment_id: environmentId }),
    });
    return { success: true, data: response.data };
  } catch (error) {
    return handleError(error);
  }
}

export async function checkoutLicense(
  licenseKey: string,
  requesterId: string,
  durationSeconds: number = 7200,
  requesterType: 'ci_job' | 'machine' | 'user' = 'ci_job',
  metadata?: Record<string, unknown>
): Promise<ApiResponse<CheckoutResponse>> {
  try {
    const client = createClient();
    const response = await client.post('/checkout-license', {
      license_key: licenseKey,
      requester_id: requesterId,
      duration_seconds: durationSeconds,
      requester_type: requesterType,
      metadata,
    });
    return { success: true, data: response.data };
  } catch (error) {
    return handleError(error);
  }
}

export async function checkinLicense(
  leaseKey: string
): Promise<ApiResponse<CheckinResponse>> {
  try {
    const client = createClient();
    const response = await client.post('/checkin-license', {
      lease_key: leaseKey,
    });
    return { success: true, data: response.data };
  } catch (error) {
    return handleError(error);
  }
}

export async function getLeaseStatus(
  leaseKey: string
): Promise<ApiResponse<LeaseStatusResponse>> {
  try {
    const client = createClient();
    const response = await client.get('/lease-status', {
      params: { lease_key: leaseKey },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return handleError(error);
  }
}

function handleError<T>(error: unknown): ApiResponse<T> {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.error || error.message;
    const details = error.response?.data?.details;
    return { success: false, error: message, details };
  }
  return { success: false, error: String(error) };
}
