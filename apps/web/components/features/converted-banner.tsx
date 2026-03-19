import { Sparkles } from 'lucide-react';

interface ConvertedBannerProps {
  title: string;
  subtitle: string;
}

export function ConvertedBanner({ title, subtitle }: ConvertedBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div>
        <p className="text-sm font-medium text-amber-900">{title}</p>
        <p className="text-sm text-amber-700">{subtitle}</p>
      </div>
    </div>
  );
}
