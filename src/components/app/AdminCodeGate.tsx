import { FormEvent, ReactNode, useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const ACCESS_CODE = "4171";
const STORAGE_KEY = "testio-admin-code-granted";

type AdminCodeGateProps = {
  title: string;
  description: string;
  children: (code: string) => ReactNode;
};

const AdminCodeGate = ({ title, description, children }: AdminCodeGateProps) => {
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUnlocked(window.sessionStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (code.trim() !== ACCESS_CODE) {
      toast.error("Incorrect code");
      return;
    }

    window.sessionStorage.setItem(STORAGE_KEY, "true");
    setUnlocked(true);
  };

  if (unlocked) {
    return <>{children(ACCESS_CODE)}</>;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
        <Card className="w-full">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary/60">
              <LockKeyhole className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                autoFocus
                inputMode="numeric"
                maxLength={4}
                placeholder="Enter code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <Button type="submit" className="w-full">
                Enter
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminCodeGate;