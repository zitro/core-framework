import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface SurfacedAssumption {
  text: string;
  source: string;
}

interface SurfacedAssumptionsProps {
  items: SurfacedAssumption[];
  onAdd: () => void;
}

export function SurfacedAssumptions({ items, onAdd }: SurfacedAssumptionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-amber-500" />
          Assumptions Surfaced by Experts
        </CardTitle>
        <CardDescription>Move these into the validation tracker when they should be tested before Execute.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {items.map((item) => (
            <div key={`${item.source}-${item.text}`} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm">{item.text}</p>
                <Badge variant="secondary" className="shrink-0 text-[10px]">{item.source}</Badge>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" onClick={onAdd}>Add New Assumptions</Button>
      </CardContent>
    </Card>
  );
}
