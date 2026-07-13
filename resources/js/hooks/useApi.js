import { useState, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '@/Components/ui/Toast';

/**
 * Centralized API hook with consistent error handling and toast notifications.
 *
 * Usage:
 *   const api = useApi();
 *   const data = await api.get('/api/pos');
 *   await api.post('/api/pos', payload);
 *   await api.put(`/api/pos/${id}/submit`);
 *   await api.del(`/api/pos/${id}`);
 *
 * Options (3rd arg for get/post/put, 2nd for del):
 *   { silent: true }  — suppress automatic toast.error (caller handles it)
 */
export function useApi() {
    const toast = useToast();
    const [loading, setLoading] = useState(false);

    const request = useCallback(async (method, url, bodyOrParams, options = {}) => {
        const { silent = false, ...axiosOptions } = options;
        try {
            let res;
            if (method === 'get') {
                res = await axios.get(url, { params: bodyOrParams, ...axiosOptions });
            } else if (method === 'post') {
                res = await axios.post(url, bodyOrParams, axiosOptions);
            } else if (method === 'put') {
                res = await axios.put(url, bodyOrParams, axiosOptions);
            } else if (method === 'delete') {
                res = await axios.delete(url, axiosOptions);
            }
            return res.data;
        } catch (err) {
            if (!silent) {
                const message =
                    err.response?.data?.message ||
                    err.response?.data?.error ||
                    'Terjadi kesalahan pada server.';
                toast.error(message);
            }
            throw err;
        }
    }, [toast]);

    return {
        /** GET request. Returns response data. Throws on error. */
        get: useCallback((url, params, options) => request('get', url, params, options), [request]),
        /** POST request. Returns response data. Throws on error. */
        post: useCallback((url, data, options) => request('post', url, data, options), [request]),
        /** PUT request. Returns response data. Throws on error. */
        put: useCallback((url, data, options) => request('put', url, data, options), [request]),
        /** DELETE request. Returns response data. Throws on error. */
        del: useCallback((url, options) => request('delete', url, null, options), [request]),
        /** Shared loading boolean — set manually in page code. */
        loading,
        setLoading,
    };
}
