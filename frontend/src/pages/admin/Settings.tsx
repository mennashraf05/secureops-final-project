import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/layout/Page';
import { SectionCard } from '../../components/cards/SectionCard';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/AuthContext';
import {
  getNotificationSettings,
  updateTelegramNotificationSetting,
  type NotificationSettings,
} from '../../api/settings';
import { SETTINGS_PREFS_KEY, applyThemePreference, type ThemePreference } from '../../utils/themePreference';

type StatusTone = 'blue' | 'cyan' | 'green' | 'orange' | 'red' | 'violet' | 'gray';

const defaultPreferences = {
  showNotifications: true,
  themePreference: 'system' as ThemePreference,
};

type LocalPreferences = typeof defaultPreferences;

function readLocalPreferences(): LocalPreferences {
  const raw = localStorage.getItem(SETTINGS_PREFS_KEY);
  if (!raw) return defaultPreferences;

  try {
    return { ...defaultPreferences, ...JSON.parse(raw) };
  } catch {
    return defaultPreferences;
  }
}

function formatBoolean(value?: boolean) {
  if (value === undefined) return 'Loading';
  return value ? 'Yes' : 'No';
}

function formatTwoFactorMethod(method?: string) {
  if (method === 'authenticator') return 'Authenticator app';
  if (method === 'email') return 'Email code';
  return 'Not available';
}

function SettingRow({
  label,
  value,
  status,
  tone = 'gray',
}: {
  label: string;
  value: string;
  status?: string;
  tone?: StatusTone;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 text-sm text-slate-500">{value}</p>
      </div>
      {status && <Badge tone={tone}>{status}</Badge>}
    </div>
  );
}

function ThemeOption({
  value,
  label,
  current,
  onChange,
}: {
  value: ThemePreference;
  label: string;
  current: ThemePreference;
  onChange: (value: ThemePreference) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ring-1 transition ${
        current === value
          ? 'bg-slate-900 text-white ring-slate-900'
          : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function NotificationDisplayOption({
  enabled,
  current,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  current: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  const isActive = enabled === current;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(enabled)}
      className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ring-1 transition ${
        disabled
          ? 'cursor-not-allowed bg-white text-slate-400 opacity-70 ring-slate-200'
          : isActive
          ? enabled
            ? 'bg-emerald-600 text-white ring-emerald-600'
            : 'bg-red-600 text-white ring-red-600'
          : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {enabled ? 'Accept' : 'Reject'}
    </button>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<LocalPreferences>(() => readLocalPreferences());
  const [saveMessage, setSaveMessage] = useState('');
  const [telegramSettings, setTelegramSettings] = useState<NotificationSettings | null>(null);
  const [telegramMessage, setTelegramMessage] = useState('');
  const [telegramError, setTelegramError] = useState('');
  const [isTelegramSaving, setIsTelegramSaving] = useState(false);

  useEffect(() => {
    applyThemePreference(preferences.themePreference);
  }, []);

  useEffect(() => {
    let isMounted = true;

    getNotificationSettings()
      .then((response) => {
        if (!isMounted) return;
        setTelegramSettings(response.data);
        setTelegramError('');
      })
      .catch(() => {
        if (!isMounted) return;
        setTelegramError('Telegram notification settings are unavailable.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updatePreference = <K extends keyof LocalPreferences>(key: K, value: LocalPreferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    setSaveMessage('');
  };

  const saveLocalPreferences = () => {
    localStorage.setItem(SETTINGS_PREFS_KEY, JSON.stringify(preferences));
    applyThemePreference(preferences.themePreference);
    window.dispatchEvent(new Event('secureops-preferences-updated'));
    setSaveMessage('Local preferences saved successfully.');
  };

  const saveTelegramPreference = async (enabled: boolean) => {
    if (!telegramSettings?.telegram_env_configured || !telegramSettings.telegram_global_enabled) return;

    setIsTelegramSaving(true);
    setTelegramError('');
    setTelegramMessage('');
    try {
      const response = await updateTelegramNotificationSetting(enabled);
      setTelegramSettings(response.data);
      setTelegramMessage(enabled ? 'Telegram admin notifications accepted.' : 'Telegram admin notifications disabled.');
    } catch {
      setTelegramError('Could not update Telegram notification settings.');
    } finally {
      setIsTelegramSaving(false);
    }
  };

  const twoFactorValue = user ? (user.two_factor_required ? 'Required' : 'Not required') : 'Loading';
  const twoFactorStatus = user ? (user.two_factor_required ? 'Required' : 'Read-only') : 'Read-only';
  const twoFactorTone = user?.two_factor_required ? 'green' : 'gray';
  const telegramConfigured = Boolean(telegramSettings?.telegram_env_configured && telegramSettings.telegram_global_enabled);
  const telegramAccepted = Boolean(telegramSettings?.telegram_admin_notifications_enabled);

  return (
    <>
      <PageHeader title="Settings" subtitle="Review SecureOps security, platform, and local UI configuration." />

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-card">
        Security and platform settings are read-only because they are managed by backend policy, .env, Docker, or Nginx.
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Profile Settings" subtitle="Current admin identity from the authenticated session.">
          <div className="grid gap-3">
            <SettingRow label="Email" value={user?.email ?? 'Loading session'} status="Read-only" tone="blue" />
            <SettingRow label="Role" value={user?.role ?? 'Loading'} status="Admin only" tone="violet" />
            <SettingRow label="Email verified" value={formatBoolean(user?.email_verified)} status={user?.email_verified ? 'Enabled' : 'Required'} tone={user?.email_verified ? 'green' : 'orange'} />
            <SettingRow label="2FA" value={twoFactorValue} status={twoFactorStatus} tone={twoFactorTone} />
            <SettingRow label="Method" value={formatTwoFactorMethod(user?.two_factor_method)} status={user?.two_factor_enabled ? 'Enabled' : 'Read-only'} tone={user?.two_factor_enabled ? 'green' : 'gray'} />
          </div>
        </SectionCard>

        <SectionCard title="Security Settings" subtitle="Implemented platform controls.">
          <div className="grid gap-3">
            <SettingRow label="JWT authentication" value="Public API requests use bearer tokens." status="Enabled" tone="green" />
            <SettingRow label="RBAC" value="Admin and user roles protect routes and APIs." status="Enabled" tone="green" />
            <SettingRow label="Mandatory 2FA" value="Tokens are issued after two-factor verification." status="Enabled" tone="green" />
            <SettingRow label="Email verification" value="New accounts must verify email before access." status="Enabled" tone="green" />
            <SettingRow label="Audit logging" value="Critical actions are recorded by Audit Service." status="Enabled" tone="green" />
            <SettingRow label="Internal API key protection" value="Service-only endpoints require internal headers." status="Enabled" tone="green" />
          </div>
        </SectionCard>

        <SectionCard title="Notification Preferences" subtitle="In-app notifications stay local; Telegram is controlled by backend policy.">
          <div className="grid gap-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">In-App Notifications</p>
                  <p className="mt-0.5 text-sm text-slate-500">Controls bell notifications in this browser.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <NotificationDisplayOption enabled current={preferences.showNotifications} onChange={(enabled) => updatePreference('showNotifications', enabled)} />
                  <NotificationDisplayOption enabled={false} current={preferences.showNotifications} onChange={(enabled) => updatePreference('showNotifications', enabled)} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <span>{preferences.showNotifications ? 'Notifications are accepted in this browser.' : 'Notifications are rejected in this browser.'}</span>
              <Badge tone={preferences.showNotifications ? 'green' : 'red'}>{preferences.showNotifications ? 'Accepted' : 'Rejected'}</Badge>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Telegram Admin Notifications</p>
                  <p className="mt-0.5 text-sm text-slate-500">Controls whether important admin alerts are sent to Telegram.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <NotificationDisplayOption
                    enabled
                    current={telegramAccepted}
                    disabled={!telegramConfigured || isTelegramSaving}
                    onChange={() => saveTelegramPreference(true)}
                  />
                  <NotificationDisplayOption
                    enabled={false}
                    current={telegramAccepted}
                    disabled={!telegramConfigured || isTelegramSaving}
                    onChange={() => saveTelegramPreference(false)}
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SettingRow
                  label="Global Telegram"
                  value={telegramSettings ? (telegramSettings.telegram_global_enabled ? 'Enabled in environment' : 'Disabled in environment') : 'Loading'}
                  status={telegramSettings?.telegram_global_enabled ? 'Enabled' : 'Disabled'}
                  tone={telegramSettings?.telegram_global_enabled ? 'green' : 'orange'}
                />
                <SettingRow label="Target" value={telegramSettings?.telegram_target ?? 'Admin Telegram channel'} status="Hidden target" tone="blue" />
                <SettingRow label="Token" value="Hidden" status="Secret" tone="cyan" />
                <SettingRow label="Chat ID" value="Hidden" status="Secret" tone="cyan" />
              </div>
            </div>
            {telegramSettings && !telegramConfigured && (
              <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700">
                Telegram is not configured in environment.
              </div>
            )}
            {telegramMessage && (
              <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <span>{telegramMessage}</span>
                <Badge tone="green">{telegramAccepted ? 'Accepted' : 'Rejected'}</Badge>
              </div>
            )}
            {telegramError && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{telegramError}</div>
            )}
            {telegramSettings && telegramConfigured && !telegramMessage && (
              <div className="flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <span>
                  {telegramAccepted
                    ? 'Telegram admin notifications are accepted.'
                    : 'Telegram admin notifications are rejected.'}
                </span>
                <Badge tone={telegramAccepted ? 'green' : 'red'}>{telegramAccepted ? 'Accepted' : 'Rejected'}</Badge>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="API / Internal Service Settings" subtitle="Read-only gateway and service communication model.">
          <div className="grid gap-3">
            <SettingRow label="API Gateway" value="Nginx" status="Read-only" tone="blue" />
            <SettingRow label="Internal service auth" value="X-Internal-API-Key" status="Enabled" tone="green" />
            <SettingRow label="Public API auth" value="JWT Bearer Token" status="Enabled" tone="green" />
            <SettingRow label="Service-to-service audit ingestion" value="Audit events are accepted through protected internal endpoints." status="Enabled" tone="green" />
            <SettingRow label="Stock deduction internal call" value="Orders call Inventory through internal service auth." status="Enabled" tone="green" />
          </div>
        </SectionCard>

        <SectionCard title="Rate Limit Settings" subtitle="Configured in Nginx gateway.">
          <div className="grid gap-3">
            <SettingRow label="General API" value="60 requests/minute" status="Read-only" tone="blue" />
            <SettingRow label="Auth endpoints" value="10 requests/minute" status="Read-only" tone="blue" />
            <SettingRow label="Strict 2FA/verification endpoints" value="5 requests/minute" status="Read-only" tone="blue" />
            <SettingRow label="Rate-limit response" value="HTTP 429" status="Enabled" tone="green" />
            <SettingRow label="Request size limit" value="10 MB" status="Read-only" tone="blue" />
          </div>
        </SectionCard>

        <SectionCard title="File Upload Policy" subtitle="Secure File Vault controls are not active in this part.">
          <div className="grid gap-3">
            <SettingRow label="Status" value="Secure File Vault / File Encryption is planned." status="Coming soon" tone="orange" />
            <SettingRow label="Allowed extensions" value="Planned control" status="Coming soon" tone="orange" />
            <SettingRow label="Blocked dangerous extensions" value="Planned control" status="Coming soon" tone="orange" />
            <SettingRow label="File size limit" value="Planned control" status="Coming soon" tone="orange" />
            <SettingRow label="Encrypted storage" value="Planned control" status="Coming soon" tone="orange" />
            <SettingRow label="SHA-256 integrity verification" value="Planned control" status="Coming soon" tone="orange" />
          </div>
        </SectionCard>

        <SectionCard title="OAuth Settings" subtitle="Documented flow requiring provider credentials.">
          <div className="grid gap-3">
            <SettingRow label="Status" value="OAuth flow is documented/placeholder and requires provider credentials for full activation." status="Partial" tone="orange" />
            <SettingRow label="Provider" value="GitHub planned or placeholder" status="Coming soon" tone="orange" />
          </div>
        </SectionCard>

        <SectionCard title="Secrets Management" subtitle="Configuration sources without secret disclosure.">
          <div className="grid gap-3">
            <SettingRow label="Secrets source" value="Loaded from .env" status="Managed by .env" tone="cyan" />
            <SettingRow label=".env file" value="Ignored by Git" status="Protected" tone="green" />
            <SettingRow label=".env.example" value="Uses placeholders only" status="Read-only" tone="blue" />
            <SettingRow label="SMTP password" value="Hidden" status="Managed by .env" tone="cyan" />
            <SettingRow label="Internal API key" value="Hidden" status="Managed by .env" tone="cyan" />
            <SettingRow label="RabbitMQ credentials" value="Hidden" status="Managed by .env" tone="cyan" />
          </div>
        </SectionCard>

        <SectionCard title="Theme Preference" subtitle="Stored locally and applied to this browser.">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-3">
              <ThemeOption value="system" label="System default" current={preferences.themePreference} onChange={(value) => updatePreference('themePreference', value)} />
              <ThemeOption value="light" label="Light" current={preferences.themePreference} onChange={(value) => updatePreference('themePreference', value)} />
              <ThemeOption value="dark" label="Dark" current={preferences.themePreference} onChange={(value) => updatePreference('themePreference', value)} />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-500">Applies after saving and persists in localStorage.</span>
              <Badge tone="green">Local only</Badge>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="System Preferences" subtitle="Read-only system behavior.">
          <div className="grid gap-3">
            <SettingRow label="Frontend route protection" value="Authenticated routes are guarded." status="Enabled" tone="green" />
            <SettingRow label="Admin-only pages" value="Admin routes require the admin role." status="Enabled" tone="green" />
            <SettingRow label="User portal separation" value="User pages are separate from admin workflows." status="Enabled" tone="green" />
            <SettingRow label="Audit trail visibility" value="Admin only" status="Enabled" tone="green" />
            <SettingRow label="RabbitMQ Management UI" value="localhost only" status="Read-only" tone="blue" />
            <SettingRow label="Worker jobs" value="Report jobs are processed asynchronously." status="Enabled" tone="green" />
          </div>
        </SectionCard>
      </section>

      <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900">Local Preferences</h3>
            <p className="mt-1 text-sm text-slate-500">Only notification display and theme preference are editable from this page.</p>
          </div>
          <Button onClick={saveLocalPreferences}>Save Local Preferences</Button>
        </div>
        {saveMessage && <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{saveMessage}</div>}
      </section>

      <section className="mt-7 rounded-3xl border border-red-200 bg-red-50 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-extrabold text-red-700">Danger Zone</h3>
            <p className="mt-1 text-sm text-red-600">Danger Zone actions are intentionally disabled in the demo UI to avoid unsafe configuration changes.</p>
          </div>
          <Badge tone="red">Disabled</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button variant="danger" disabled className="cursor-not-allowed opacity-60 hover:translate-y-0 hover:bg-red-600">Revoke OAuth clients - Coming soon</Button>
          <Button variant="danger" disabled className="cursor-not-allowed opacity-60 hover:translate-y-0 hover:bg-red-600">Rotate internal API key - Managed by environment</Button>
          <Button variant="danger" disabled className="cursor-not-allowed opacity-60 hover:translate-y-0 hover:bg-red-600">Reset secrets - Managed outside app</Button>
          <Button variant="danger" disabled className="cursor-not-allowed opacity-60 hover:translate-y-0 hover:bg-red-600">Disable services - Not available from UI</Button>
        </div>
      </section>
    </>
  );
}
