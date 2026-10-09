import type React from 'react';
import { useEffect, useState } from 'react';
import { MailPlus } from 'lucide-react';
import { useResendVerificationMutation, getRtkErrorMessage } from '../../api/authApi';
import { Button, type ButtonProps } from '../../components/ui/Button';
import { validateEmail } from '../../utils/validation';

const COOLDOWN_SECONDS = 60;

export interface ResendVerificationButtonProps {
  email: string;
  label?: string;
  variant?: ButtonProps['variant'];
  className?: string;
}

/**
 * "Resend verification email", with a 60 s cooldown after each send so a
 * double click or an impatient user doesn't burn the per-email rate limit.
 * The server always answers 202, so success only means "sent if it applies".
 */
export const ResendVerificationButton: React.FC<ResendVerificationButtonProps> = ({
  email,
  label = 'Resend verification email',
  variant = 'secondary',
  className = '',
}) => {
  const [resend, { isLoading }] = useResendVerificationMutation();
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const emailError = validateEmail(email);

  const handleClick = async () => {
    if (emailError) {
      setStatus({ tone: 'danger', text: emailError });
      return;
    }
    try {
      const result = await resend({ email: email.trim().toLowerCase() }).unwrap();
      setStatus({ tone: 'success', text: result.message });
      setSecondsLeft(COOLDOWN_SECONDS);
    } catch (err) {
      setStatus({ tone: 'danger', text: getRtkErrorMessage(err) });
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Button
        type="button"
        variant={variant}
        size="md"
        onClick={handleClick}
        isLoading={isLoading}
        disabled={isLoading || secondsLeft > 0}
        leftIcon={<MailPlus className="w-4 h-4" />}
        className="w-full"
      >
        {secondsLeft > 0 ? `Resend again in ${secondsLeft}s` : label}
      </Button>
      {status && (
        <p
          role="status"
          className={`text-[12px] leading-relaxed ${
            status.tone === 'success' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
};
