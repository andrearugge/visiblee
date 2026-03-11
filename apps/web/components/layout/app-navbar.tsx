'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';
import { Bell, ChevronDown, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { buttonVariants } from "@/lib/button-variants";
import { cn } from '@/lib/utils';

interface AppNavbarProps {
  userName?: string;
  userEmail?: string;
}

export function AppNavbar({ userName, userEmail }: AppNavbarProps) {
  const t = useTranslations('nav');
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-1 items-center gap-4">
        <Link href="/app" className="text-base font-bold tracking-tight">
          Visiblee
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Link
          href="/app/notifications"
          aria-label={t('notifications')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
        >
          <Bell className="size-4" />
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'flex items-center gap-2 px-2'
            )}
          >
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">
                {userName ? userName[0].toUpperCase() : <User className="size-3" />}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm sm:inline">{userName ?? userEmail}</span>
            <ChevronDown className="size-3 text-zinc-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {userEmail ? (
              <>
                <div className="px-2 py-1.5">
                  <p className="text-xs text-zinc-500">{userEmail}</p>
                </div>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem onClick={() => router.push('/app/settings')}>
              {t('settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              {t('signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
