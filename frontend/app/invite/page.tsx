'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useJoinFamilyByToken } from '@/lib/hooks/use-family';
import { ApiError } from '@/lib/api';

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return '邀请链接无效或已过期。';
    if (error.status === 403) return '这个邀请发送给了另一个邮箱地址。';
    if (error.status === 409) return '你已经在一个家庭中了。';
  }
  return '出现问题了，请重试。';
}

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const token = searchParams.get('token');
  const joinByToken = useJoinFamilyByToken();

  useEffect(() => {
    if (!token) {
      router.replace('/dashboard/family');
    } else if (status === 'unauthenticated') {
      router.replace(`/login?callbackUrl=${encodeURIComponent(`/invite?token=${token}`)}`);
    }
  }, [status, router, token]);

  if (!token) {
    return null;
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleAccept = async () => {
    try {
      const result = await joinByToken.mutateAsync(token);
      toast.success(`已加入 ${result.family_name}`);
      router.push('/dashboard/family');
    } catch {
      // error displayed via joinByToken.error below
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            家庭邀请
          </CardTitle>
          <CardDescription>
            你收到了一份 Wardrowbe 家庭邀请
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {joinByToken.isError && (
            <p className="text-sm text-destructive">{getErrorMessage(joinByToken.error)}</p>
          )}
          <Button
            onClick={handleAccept}
            className="w-full"
            disabled={joinByToken.isPending || joinByToken.isSuccess}
          >
            {joinByToken.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            接受邀请
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <InviteContent />
    </Suspense>
  );
}
