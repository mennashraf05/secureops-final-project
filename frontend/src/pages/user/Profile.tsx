import { useEffect, useState } from 'react';
import { changePassword, updateProfile } from '../../api/client';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../auth/AuthContext';

export default function Profile() {
  const { user, logoutUser, refreshCurrentUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  async function saveProfile() {
    setProfileMessage('');
    setProfileError('');

    if (!name.trim()) {
      setProfileError('Name is required.');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfile(name.trim());
      await refreshCurrentUser();
      setProfileMessage('Profile updated successfully.');
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not update profile.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setProfileError(nextError);
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function savePassword() {
    setPasswordMessage('');
    setPasswordError('');

    if (!currentPassword || !newPassword) {
      setPasswordError('Current password and new password are required.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMessage('Password updated successfully.');
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Could not update password.';
      if (nextError === 'Invalid or expired token.') {
        await logoutUser();
      }
      setPasswordError(nextError);
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <>
      <PageHeader title="My Profile" subtitle="Manage your account details, password, and login activity." />
      <section className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Profile Information" subtitle={`Role: ${user?.role ?? 'user'}`}>
          <div className="grid gap-3">
            <input
              className="rounded-2xl bg-slate-100 px-4 py-3 outline-none ring-1 ring-transparent focus:ring-blue-200"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setProfileMessage('');
                setProfileError('');
              }}
              placeholder="Name"
            />
            <input
              className="cursor-not-allowed rounded-2xl bg-slate-100 px-4 py-3 text-slate-500"
              value={user?.email ?? ''}
              readOnly
              aria-label="Email address"
            />
            <p className="text-xs font-semibold text-slate-500">Email changes require a verified email flow and are not editable here.</p>
            <Button onClick={() => void saveProfile()} disabled={isSavingProfile}>
              {isSavingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
            {profileMessage && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{profileMessage}</div>}
            {profileError && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{profileError}</div>}
          </div>
        </SectionCard>

        <SectionCard title="Password Change" subtitle="Requires your current password.">
          <div className="grid gap-3">
            <input
              className="rounded-2xl bg-slate-100 px-4 py-3 outline-none ring-1 ring-transparent focus:ring-blue-200"
              placeholder="Current password"
              type="password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setPasswordMessage('');
                setPasswordError('');
              }}
            />
            <input
              className="rounded-2xl bg-slate-100 px-4 py-3 outline-none ring-1 ring-transparent focus:ring-blue-200"
              placeholder="New password"
              type="password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setPasswordMessage('');
                setPasswordError('');
              }}
            />
            <p className="text-xs font-semibold text-slate-500">Use at least 8 characters with uppercase, lowercase, and a number or symbol.</p>
            <Button variant="dark" onClick={() => void savePassword()} disabled={isSavingPassword}>
              {isSavingPassword ? 'Updating...' : 'Update Password'}
            </Button>
            {passwordMessage && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{passwordMessage}</div>}
            {passwordError && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{passwordError}</div>}
          </div>
        </SectionCard>
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-2">
        <SectionCard title="Account Security" subtitle="Two-factor authentication is required for all accounts.">
          <div className="flex flex-wrap gap-3">
            <Badge tone={user?.email_verified ? 'green' : 'red'}>{user?.email_verified ? 'Email verified' : 'Email not verified'}</Badge>
            <Badge tone={user?.two_factor_required ? 'green' : 'red'}>{user?.two_factor_required ? '2FA required' : '2FA not required'}</Badge>
            <Badge tone="blue">Method: {user?.two_factor_method ?? 'authenticator'}</Badge>
          </div>
        </SectionCard>
        <SectionCard title="Logout" subtitle="End current session">
          <Button variant="danger" onClick={() => void logoutUser()}>Logout</Button>
        </SectionCard>
      </section>
    </>
  );
}
