"use client";

import { LogIn, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/auth-context";

export function AuthButton() {
  const { enabled, ready, account, signIn, signOut } = useAuth();

  if (!enabled) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <UserRound className="h-3 w-3" />
        <span>Local mode</span>
      </div>
    );
  }

  if (!ready) {
    return <span className="text-[10px] text-muted-foreground">Signing in…</span>;
  }

  if (!account) {
    return (
      <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => signIn()}>
        <LogIn className="h-3.5 w-3.5" />
        <span className="text-xs">Sign in</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs">
        <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="max-w-[160px] truncate">{account.name}</span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2"
        onClick={() => signOut()}
        title="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
