import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { RegisterForm } from '@/components/auth/register-form';

interface RegisterPageProps {
  searchParams: Promise<{ preview?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const [t, { preview: previewId }] = await Promise.all([
    getTranslations('auth'),
    searchParams,
  ]);

  let defaultEmail: string | undefined;
  if (previewId) {
    const preview = await db.previewAnalysis.findUnique({
      where: { id: previewId },
      select: { reportEmail: true },
    });
    defaultEmail = preview?.reportEmail ?? undefined;
  }

  return (
    <div className="w-full max-w-sm space-y-2">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('registerTitle')}</h1>
        <p className="text-sm text-zinc-500">{t('registerSubtitle')}</p>
      </div>
      <RegisterForm previewId={previewId} defaultEmail={defaultEmail} />
    </div>
  );
}
