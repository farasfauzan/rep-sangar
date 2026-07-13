import { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Shared projects cache. Fetches /api/projects once and shares
 * the result across all components that call useProjects().
 *
 * Usage:
 *   const { projects, loading, refresh } = useProjects();
 */
let _cache = null;
let _promise = null;

export function useProjects() {
    const [projects, setProjects] = useState(_cache || []);
    const [loading, setLoading] = useState(!_cache);

    useEffect(() => {
        let cancelled = false;

        if (_cache) {
            setProjects(_cache);
            setLoading(false);
            return;
        }

        if (!_promise) {
            _promise = axios
                .get('/api/projects')
                .then((res) => {
                    const list = res.data?.data ?? res.data ?? [];
                    _cache = Array.isArray(list) ? list : [];
                    return _cache;
                })
                .catch(() => {
                    _promise = null; // allow retry
                    return [];
                });
        }

        _promise.then((list) => {
            if (!cancelled) {
                setProjects(list);
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    /** Force re-fetch (e.g. after adding/editing a project). */
    const refresh = async () => {
        _promise = null;
        _cache = null;
        setLoading(true);
        try {
            const res = await axios.get('/api/projects');
            const list = res.data?.data ?? res.data ?? [];
            _cache = Array.isArray(list) ? list : [];
            setProjects(_cache);
        } catch {
            setProjects([]);
        } finally {
            setLoading(false);
        }
    };

    return { projects, loading, refresh };
}

/** Update the shared cache from outside a component (e.g. after a mutation). */
export function updateProjectsCache(list) {
    _cache = Array.isArray(list) ? list : [];
}
