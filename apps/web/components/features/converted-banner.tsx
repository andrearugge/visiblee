import { Sparkles } from 'lucide-react';

interface ConvertedBannerProps {
  title: string;
  subtitle: string;
}

export function ConvertedBanner({ title, subtitle }: ConvertedBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-visiblee-green-200 bg-visiblee-green-50 px-4 py-3">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-visiblee-green-500" />
      <div>
        <p className="text-sm font-medium text-visiblee-green-900">{title}</p>
        <p className="text-sm text-visiblee-green-700">{subtitle}</p>
      </div>
    </div>
  );
}
