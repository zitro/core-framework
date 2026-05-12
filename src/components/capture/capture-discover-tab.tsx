"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyResearchPanel } from "@/components/capture/discover/company-research-panel";
import { M365Panel } from "@/components/capture/discover/m365-panel";
import { WebSearchPanel } from "@/components/capture/discover/web-search-panel";

export function CaptureDiscoverTab(): React.ReactElement {
  return (
    <Tabs defaultValue="web" className="space-y-4">
      <TabsList>
        <TabsTrigger value="web">Web Search</TabsTrigger>
        <TabsTrigger value="m365">Microsoft 365</TabsTrigger>
        <TabsTrigger value="company">Company Research</TabsTrigger>
      </TabsList>
      <TabsContent value="web">
        <WebSearchPanel />
      </TabsContent>
      <TabsContent value="m365">
        <M365Panel />
      </TabsContent>
      <TabsContent value="company">
        <CompanyResearchPanel />
      </TabsContent>
    </Tabs>
  );
}
