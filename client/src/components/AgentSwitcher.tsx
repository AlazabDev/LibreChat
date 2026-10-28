import { Bot, Check, ChevronDown, Settings2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { agentModelLabel, type AgentProfile } from "@/lib/agents";

export function AgentSwitcher({
  agents,
  activeId,
  onChange,
}: {
  agents: AgentProfile[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  const active = agents.find((a) => a.id === activeId) ?? agents[0];
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          aria-label="اختيار الوكيل"
        >
          <Bot className="size-4" />
          {active?.name}
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-64">
        <DropdownMenuLabel>الوكلاء</DropdownMenuLabel>
        {agents.map((a) => (
          <DropdownMenuItem
            key={a.id}
            onSelect={() => onChange(a.id)}
            className="flex items-start gap-2"
          >
            <Check
              className={`mt-0.5 size-4 ${a.id === active?.id ? "opacity-100" : "opacity-0"}`}
            />
            <div className="min-w-0">
              <p className="font-medium">{a.name}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {agentModelLabel(a.model)}
              </p>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings" search={{ tab: "agents" }}>
            <Settings2 className="size-4" />
            إدارة الوكلاء
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
