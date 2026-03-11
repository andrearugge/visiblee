import { getTranslations } from 'next-intl/server';
import { RegisterForm } from '@/components/auth/register-form';

export default async function RegisterPage() {
  const t = await getTranslations('auth');

  return (
    <div className="w-full max-w-sm space-y-2">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('registerTitle')}</h1>
        <p className="text-sm text-zinc-500">{t('registerSubtitle')}</p>
      </div>
      <RegisterForm />
    </div>
  );
}
