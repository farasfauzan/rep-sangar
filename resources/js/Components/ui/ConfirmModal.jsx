import Modal from './Modal';
import Button from './Button';

export default function ConfirmModal({
    open = false,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmVariant = 'danger',
    loading = false,
    size = 'sm',
}) {
    return (
        <Modal open={open} onClose={onClose} title={title} size={size}>
            <p className="text-sm text-gray-600 mb-6">{message}</p>
            <div className="flex items-center justify-end gap-3">
                <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={loading}
                >
                    {cancelText}
                </Button>
                <Button
                    variant={confirmVariant}
                    onClick={onConfirm}
                    loading={loading}
                >
                    {confirmText}
                </Button>
            </div>
        </Modal>
    );
}
