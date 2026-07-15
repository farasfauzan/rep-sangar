import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { router } from '@inertiajs/react';

const timeLabel = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'Baru saja';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};

export default function WorkflowNotifications() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const load = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/notifications');
            setNotifications(data.data || []);
            setUnreadCount(data.unread_count || 0);
        } catch {
            // Notifications must not interrupt the rest of the application.
        }
    }, []);

    useEffect(() => {
        load();
        const poll = window.setInterval(load, 30000);
        return () => window.clearInterval(poll);
    }, [load]);

    const openNotification = async (notification) => {
        if (!notification.read_at) {
            try {
                const { data } = await axios.put(`/api/notifications/${notification.id}/read`);
                setUnreadCount(data.unread_count || 0);
                setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
            } catch {
                // The destination may still be opened even when read-state update fails.
            }
        }
        setOpen(false);
        if (notification.data?.url) router.visit(notification.data.url);
    };

    const markAllRead = async () => {
        try {
            await axios.put('/api/notifications/read-all');
            setUnreadCount(0);
            setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
        } catch {
            // Notifications must not interrupt the rest of the application.
        }
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="relative rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Notifikasi workflow"
                aria-expanded={open}
            >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m1 4h4" />
                </svg>
                {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>

            {open && (
                <div className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Notifikasi workflow</p>
                            <p className="text-xs text-slate-500">Dokumen yang membutuhkan tindak lanjut</p>
                        </div>
                        {unreadCount > 0 && <button type="button" onClick={markAllRead} className="text-xs font-medium text-blue-700 hover:text-blue-900">Tandai dibaca</button>}
                    </div>
                    <div className="max-h-[420px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-slate-500">Belum ada notifikasi workflow.</p>
                        ) : notifications.map((notification) => (
                            <button
                                key={notification.id}
                                type="button"
                                onClick={() => openNotification(notification)}
                                className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${notification.read_at ? 'bg-white' : 'bg-blue-50/70'}`}
                            >
                                <div className="flex items-start gap-3">
                                    <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${notification.read_at ? 'bg-slate-300' : 'bg-blue-600'}`} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-semibold text-slate-800">{notification.data?.title}</span>
                                        <span className="mt-0.5 block text-xs leading-5 text-slate-600">{notification.data?.message}</span>
                                        <span className="mt-1 block text-[11px] text-slate-400">{timeLabel(notification.created_at)}</span>
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
