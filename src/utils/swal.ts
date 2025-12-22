import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { MESSAGES } from '../constants/messages';

const MySwal = withReactContent(Swal);

// -- Sound Effects --
const playSound = (soundName?: string) => {
    if (!soundName || soundName === 'none') return;

    let audioSrc = '';
    switch (soundName) {
        case 'success': audioSrc = 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg'; break;
        case 'error': audioSrc = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg'; break;
        case 'chime': audioSrc = 'https://actions.google.com/sounds/v1/cartoon/pop.ogg'; break;
        default: break;
    }

    if (audioSrc) {
        const audio = new Audio(audioSrc);
        audio.volume = 0.5;
        audio.play().catch(e => console.warn("Sound play failed", e));
    }
};

// -- Toast Configuration --
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
});

// Helper to fire generic toast with style overrides
const fireToast = (icon: 'success' | 'error' | 'info' | 'warning', msg: any) => {
    const text = typeof msg === 'string' ? msg : msg.text;
    const style = typeof msg === 'string' ? undefined : msg.style;

    if (style?.sound) playSound(style.sound);

    return Toast.fire({
        icon: icon,
        title: text,
        background: style?.color ? style.color : undefined,
        color: style?.color ? '#fff' : undefined,
        iconColor: style?.color ? '#fff' : undefined
    });
};

// -- Toast API --
export const toast = {
    // Generic
    success: (message: string) => fireToast('success', message),
    error: (message: string) => fireToast('error', message),
    info: (message: string) => fireToast('info', message),
    warning: (message: string) => fireToast('warning', message),

    // Smart Actions (Context-Aware)
    saved: (target: string, count: number = 1) => {
        const msg = MESSAGES.SUCCESS.SAVE(target, count);
        return fireToast('success', {
            ...msg,
            style: {
                ...msg.style,
                sound: msg.style?.sound ?? 'success'
            }
        });
    },
    deleted: (target: string, count: number = 1) => {
        const msg = MESSAGES.SUCCESS.DELETE(target, count);
        return fireToast('success', {
            ...msg,
            style: {
                ...msg.style,
                sound: msg.style?.sound ?? 'error'
            }
        });
    },
    updated: (target: string) => {
        const msg = MESSAGES.SUCCESS.UPDATE(target);
        return fireToast('success', {
            ...msg,
            style: {
                ...msg.style,
                sound: msg.style?.sound ?? 'chime'
            }
        });
    },
    processed: (action: string) => {
        const msg = MESSAGES.SUCCESS.PROCESS(action);
        return fireToast('success', {
            ...msg,
            style: {
                ...msg.style,
                sound: msg.style?.sound ?? 'success'
            }
        });
    },
};

// -- Existing Alert API (Blocking) --
export const showSuccessAlert = (title: string, text?: string) => {
    return MySwal.fire({
        icon: 'success',
        title: title,
        text: text,
        confirmButtonColor: '#1abc9c',
        confirmButtonText: '확인'
    });
};

export const showErrorAlert = (title: string, text?: string) => {
    return MySwal.fire({
        icon: 'error',
        title: title,
        text: text,
        confirmButtonColor: '#e74c3c',
        confirmButtonText: '확인'
    });
};

// -- Smart Confirm Helper --
const fireConfirm = (
    baseIcon: 'warning' | 'question' | 'error' | 'success',
    title: string,
    msg: any,
    confirmText: string,
    cancelText: string = '취소',
    confirmColor: string = '#3498db'
) => {
    const text = typeof msg === 'string' ? msg : msg.text;
    const style = typeof msg === 'string' ? undefined : msg.style;

    if (style?.sound) playSound(style.sound);

    return MySwal.fire({
        icon: baseIcon,
        title: title,
        text: text,
        background: style?.color ? style.color : undefined,
        color: style?.color ? '#fff' : undefined,
        showCancelButton: true,
        confirmButtonColor: confirmColor,
        cancelButtonColor: '#95a5a6',
        confirmButtonText: confirmText,
        cancelButtonText: cancelText
    });
};

// -- Smart Confirm API --
export const confirm = {
    save: (title: string = '저장 확인') => fireConfirm('question', title, MESSAGES.CONFIRM.SAVE(), '저장'),
    delete: (title: string = '삭제 확인') => fireConfirm('warning', title, MESSAGES.CONFIRM.DELETE(), '삭제', '취소', '#e74c3c'),
    action: (action: string) => fireConfirm('question', `${action} 확인`, MESSAGES.CONFIRM.ACTION(action), '확인'),
    batch: (target: string, count: number) => fireConfirm('question', '일괄 수정 확인', MESSAGES.CONFIRM.BATCH(target, count), '일괄 수정', '취소', '#e74c3c'),
    overwrite: (target: string) => fireConfirm('warning', '덮어쓰기 확인', MESSAGES.CONFIRM.OVERWRITE(target), '덮어쓰기', '건너뛰기', '#e74c3c')
};

export const showConfirmAlert = (title: string, text: string, confirmButtonText: string = '확인') => {
    return MySwal.fire({
        icon: 'warning',
        title: title,
        text: text,
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#95a5a6',
        confirmButtonText: confirmButtonText,
        cancelButtonText: '취소'
    });
};

export const showInfoAlert = (title: string, text?: string) => {
    return MySwal.fire({
        icon: 'info',
        title: title,
        text: text,
        confirmButtonColor: '#3498db',
        confirmButtonText: '확인'
    });
};

