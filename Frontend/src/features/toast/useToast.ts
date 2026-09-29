import { useCallback } from 'react';
import { useAppDispatch } from '../../app/hooks';
import { showToast, type ToastTone } from './toastSlice';

/** `const toast = useToast(); toast('Venue created', 'success');` */
export const useToast = () => {
  const dispatch = useAppDispatch();
  return useCallback(
    (message: string, tone: ToastTone = 'neutral') => {
      dispatch(showToast(message, tone));
    },
    [dispatch],
  );
};
