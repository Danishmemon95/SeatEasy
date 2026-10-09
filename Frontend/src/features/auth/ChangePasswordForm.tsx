import type React from 'react';
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useChangePasswordMutation, getFieldErrors, getRtkErrorMessage } from '../../api/authApi';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { PasswordInput } from './PasswordInput';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { useToast } from '../toast/useToast';
import { validatePassword } from '../../utils/validation';

type FieldErrors = { currentPassword?: string; newPassword?: string; confirm?: string };

/**
 * The account page's "Change password" card. Collapsed to one button until
 * opened. The server keeps this device signed in and signs out every other one.
 */
export const ChangePasswordForm: React.FC = () => {
  const toast = useToast();
  const [changePassword, { isLoading, error, reset }] = useChangePasswordMutation();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const close = () => {
    setOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirm('');
    setFieldErrors({});
    reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    if (!currentPassword) errors.currentPassword = 'Please provide your current password';
    const newErr = validatePassword(newPassword);
    if (newErr) errors.newPassword = newErr;
    else if (newPassword === currentPassword) errors.newPassword = 'New password must be different from the current one';
    if (confirm !== newPassword) errors.confirm = 'Passwords do not match';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      await changePassword({ currentPassword, newPassword }).unwrap();
      toast('Password changed. Other devices were signed out.', 'success');
      close();
    } catch (err) {
      const serverFields = getFieldErrors(err);
      if (serverFields) setFieldErrors(serverFields);
    }
  };

  const clearField = (field: keyof FieldErrors) => {
    if (fieldErrors[field]) setFieldErrors((p) => ({ ...p, [field]: undefined }));
    if (error) reset();
  };

  if (!open) {
    return (
      <Button
        variant="secondary"
        size="md"
        leftIcon={<KeyRound className="w-4 h-4" />}
        onClick={() => setOpen(true)}
        className="w-full"
      >
        Change password
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 p-4 rounded-[10px] border border-[var(--rule)] bg-[var(--paper-raised)]"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-caption text-[var(--ink-muted)]">SECURITY</span>
        <h3 className="font-sans font-medium text-[15px] text-[var(--ink)]">Change password</h3>
        <p className="text-[12px] text-[var(--ink-muted)]">
          You'll stay signed in here; other devices will be signed out.
        </p>
      </div>

      {error && !getFieldErrors(error) && (
        <Alert variant="danger" title="Couldn't change your password" onClose={() => reset()}>
          {getRtkErrorMessage(error)}
        </Alert>
      )}

      <PasswordInput
        label="Current password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) => {
          setCurrentPassword(e.target.value);
          clearField('currentPassword');
        }}
        error={fieldErrors.currentPassword}
        autoFocus
        required
      />

      <div className="flex flex-col gap-2">
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            clearField('newPassword');
          }}
          error={fieldErrors.newPassword}
          required
        />
        <PasswordStrengthMeter password={newPassword} />
      </div>

      <PasswordInput
        label="Confirm new password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
          clearField('confirm');
        }}
        error={fieldErrors.confirm}
        required
      />

      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="md" onClick={close} className="flex-1">
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          disabled={isLoading}
          className="flex-1"
        >
          Save
        </Button>
      </div>
    </form>
  );
};
