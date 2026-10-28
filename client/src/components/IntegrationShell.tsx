import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { ArrowRight, Github, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AzLogo } from '@/components/AzLogo';
export function IntegrationShell({children}: {children:ReactNode}) {
 return <div className="min-h-screen bg-background text-foreground"><header className="border-b border-border"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4"><Link to="/chat" className="flex items-center gap-2"><AzLogo/><span className="font-mono font-semibold">AzCodex</span></Link><nav className="flex flex-wrap gap-2"><Button asChild variant="ghost"><Link to="/github"><Github/>GitHub</Link></Button><Button asChild variant="ghost"><Link to="/frappe"><Database/>Frappe / ERPNext</Link></Button><Button asChild variant="ghost"><Link to="/settings"><ArrowRight/>الإعدادات</Link></Button></nav></div></header><main className="mx-auto max-w-6xl px-5 py-8">{children}</main></div>;
}