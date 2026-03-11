import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';

export default async function LoginPage() {
  const t = await getTranslations('nav');

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('login')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-zinc-500">
          Auth form coming in Task 1.6.
        </p>
      </CardContent>
    </Card>
  );
}
