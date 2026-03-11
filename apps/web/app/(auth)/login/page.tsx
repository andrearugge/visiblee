import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';

export default async function LoginPage() {
  const t = await getTranslations('auth');

  return (
    <div className="w-full max-w-sm space-y-2">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('loginTitle')}</h1>
        <p className="text-sm text-zinc-500">{t('loginSubtitle')}</p>
      </div>
      <LoginForm />
    </div>
  );
}
