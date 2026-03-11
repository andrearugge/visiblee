import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { UserSettingsForm } from '@/components/features/user-settings-form';

export default async function UserSettingsPage() {
  const [session, t] = await Promise.all([auth(), getTranslations('settings')]);

  const user = await db.user.findUnique({
    where: { id: session!.user.id },
    include: { accounts: { select: { provider: true } } },
  });

  const provider = user?.accounts[0]?.provider ?? 'credentials';

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>
      <UserSettingsForm
        name={user?.name ?? ''}
        email={user?.email ?? ''}
        preferredLocale={user?.preferredLocale ?? 'en'}
        provider={provider}
      />
    </div>
  );
}
