import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';

interface PlaceholderPageProps {
  pageName: string;
}

export async function PlaceholderPage({ pageName }: PlaceholderPageProps) {
  const t = await getTranslations('placeholder');

  return (
    <div className="p-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{pageName}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">{t('emptyState')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
