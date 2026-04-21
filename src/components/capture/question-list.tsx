import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Question } from "@/types/core";

export function QuestionList({ questions }: { questions: Question[] }) {
  if (questions.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Generated Questions
          <Badge variant="secondary" className="ml-2">
            {questions.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Use these in your next stakeholder session. Click to copy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={i} className="group">
                <div
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigator.clipboard.writeText(q.text)}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{q.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">Purpose: {q.purpose}</p>
                    {q.follow_ups?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Follow-ups
                        </p>
                        {q.follow_ups.map((f, j) => (
                          <p key={j} className="text-xs text-muted-foreground pl-3 border-l">
                            {f}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {i < questions.length - 1 && <Separator className="mt-2" />}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
